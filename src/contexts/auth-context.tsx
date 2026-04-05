// src/contexts/auth-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
        setLoading(false);
        return;
      }

      setFirebaseUser(fbUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUser({
            uid: fbUser.uid,
            name: data.profile?.name || data.name || '',
            email: data.profile?.email || data.email || fbUser.email || '',
            role: data.role || '',
            companyId: data.companyId,
            profile: data.profile,
            rawData: data,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('AuthProvider: Error fetching user data:', err);
        setUser(null);
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
