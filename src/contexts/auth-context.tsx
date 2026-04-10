// src/contexts/auth-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Session cookie helpers — used by middleware.ts for server-side route protection
function setSessionCookie(role: string) {
  document.cookie = `boldfy-session=${role}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
}
function clearSessionCookie() {
  document.cookie = 'boldfy-session=; path=/; max-age=0';
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
        clearSessionCookie();
        setLoading(false);
        return;
      }

      setFirebaseUser(fbUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const role = data.role || '';
          setUser({
            uid: fbUser.uid,
            name: data.profile?.name || data.name || '',
            email: data.profile?.email || data.email || fbUser.email || '',
            role,
            companyId: data.companyId,
            profile: data.profile,
            rawData: data,
          });
          setSessionCookie(role);
        } else {
          setUser(null);
          clearSessionCookie();
        }
      } catch (err) {
        console.error('AuthProvider: Error fetching user data:', err);
        setUser(null);
        clearSessionCookie();
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
