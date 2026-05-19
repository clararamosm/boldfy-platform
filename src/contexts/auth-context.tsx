// src/contexts/auth-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { syncPlatformSeatsForCurrentUser } from '@/app/actions/billing';

// Session cookie helpers — calls server API to set signed HttpOnly cookie
async function setSessionCookie(idToken: string) {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    console.error('Failed to set session cookie:', err);
  }
}
async function clearSessionCookie() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to clear session cookie:', err);
  }
}

// ─── Types ──────────────────────────────────────────────────

export type AuthUser = {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'colaborador' | 'master' | 'thoughtleader' | 'strategist' | string;
  companyId?: string;
  profile?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  // Raw Firestore data for additional fields (linkedinConnection, etc.)
  rawData?: Record<string, unknown>;
};

type AuthContextValue = {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  /**
   * Re-fetch the user doc from Firestore and update the in-memory AuthUser.
   * Use after server-side mutations that update fields the client cares about
   * (e.g. linkedinSnapshotStatus.lastUploadMonth after an extract upload).
   */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  firebaseUser: null,
  loading: true,
  refreshUser: async () => {},
});

// ─── Hook ───────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────

/**
 * Read the user doc from Firestore and shape it into an AuthUser.
 * Used both at login (inside onAuthStateChanged) and at runtime
 * by refreshUser() so we don't duplicate the shaping logic.
 */
async function buildAuthUserFromDoc(
  uid: string,
  fallbackEmail: string | null,
): Promise<AuthUser | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  const safeData = { ...data };
  if (safeData.linkedinConnection) {
    const { accessToken: _at, refreshToken: _rt, ...safeConnection } = safeData.linkedinConnection as Record<string, unknown>;
    void _at; void _rt;
    safeData.linkedinConnection = safeConnection;
  }
  return {
    uid,
    name: data.profile?.name || data.name || '',
    email: data.profile?.email || data.email || fallbackEmail || '',
    role: data.role || '',
    companyId: data.companyId,
    profile: data.profile,
    rawData: safeData,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const refreshed = await buildAuthUserFromDoc(firebaseUser.uid, firebaseUser.email);
      if (refreshed) setUser(refreshed);
    } catch (err) {
      console.error('AuthProvider: refreshUser failed:', err);
    }
  }, [firebaseUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setFirebaseUser(null);
        await clearSessionCookie();
        setLoading(false);
        return;
      }

      setFirebaseUser(fbUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const role = data.role || '';
          // Strip sensitive tokens from rawData before storing in client state
          const safeData = { ...data };
          if (safeData.linkedinConnection) {
            const { accessToken, refreshToken, ...safeConnection } = safeData.linkedinConnection as Record<string, unknown>;
            safeData.linkedinConnection = safeConnection;
          }

          // Auto-activate users on first login. Admin entra junto pra que o painel
          // Master pare de mostrar "Convite pendente" depois do primeiro acesso.
          if (
            (role === 'colaborador' || role === 'thoughtleader' || role === 'admin') &&
            data.status === 'Pendente'
          ) {
            try {
              await updateDoc(doc(db, 'users', fbUser.uid), {
                status: 'Ativo',
                lastLoginAt: serverTimestamp(),
              });
              // Colaborador ativando = novo seat pago. Dispara o resync que
              // atualiza billing.platform.seats no Firestore e a quantity da
              // subscription no Stripe (com proration). Admin/TL nao geram
              // seat de Platform — resyncPlatformSeats filtra por role e
              // ignora ambos. Falha aqui nao bloqueia o login do user.
              if (role === 'colaborador') {
                const idToken = await fbUser.getIdToken();
                syncPlatformSeatsForCurrentUser(idToken).catch(err =>
                  console.error('Failed to sync platform seats on activation:', err),
                );
              }
            } catch (err) {
              console.error('Failed to activate user:', err);
            }
          } else if (role === 'admin' && !data.lastLoginAt) {
            // Admins legados ja com status='Ativo' mas sem lastLoginAt: backfill no proximo login.
            updateDoc(doc(db, 'users', fbUser.uid), {
              lastLoginAt: serverTimestamp(),
            }).catch(err => console.error('Failed to backfill admin lastLoginAt:', err));
          }

          setUser({
            uid: fbUser.uid,
            name: data.profile?.name || data.name || '',
            email: data.profile?.email || data.email || fbUser.email || '',
            role,
            companyId: data.companyId,
            profile: data.profile,
            rawData: safeData,
          });
          // Set signed HttpOnly session cookie via server API
          const idToken = await fbUser.getIdToken();
          await setSessionCookie(idToken);
        } else {
          setUser(null);
          await clearSessionCookie();
        }
      } catch (err) {
        console.error('AuthProvider: Error fetching user data:', err);
        setUser(null);
        await clearSessionCookie();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
