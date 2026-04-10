// src/contexts/auth-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  role: 'admin' | 'colaborador' | 'master' | string;
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
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  firebaseUser: null,
  loading: true,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
