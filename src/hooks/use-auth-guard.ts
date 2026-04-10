// src/hooks/use-auth-guard.ts
// Centralized auth guard hook for layout components.
// Replaces duplicated auth-checking logic in admin, colaborador, and master layouts.

'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, type AuthUser } from '@/contexts/auth-context';
import type { Locale } from '@/lib/i18n/types';

type TokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'not_connected';

type TokenInfo = {
  status: TokenStatus;
  daysLeft: number;
};

type UseAuthGuardOptions = {
  /** The required role for this route */
  role: 'master' | 'admin' | 'colaborador';
  /** If true, check LinkedIn token status (colaborador only) */
  checkLinkedInToken?: boolean;
};

type UseAuthGuardReturn = {
  /** The authenticated user (null while loading or unauthorized) */
  user: AuthUser | null;
  /** The company ID for this session */
  companyId: string | undefined;
  /** The company locale */
  locale: Locale;
  /** Whether the auth check is complete and the user is authorized */
  ready: boolean;
  /** Whether auth is still loading */
  loading: boolean;
  /** LinkedIn token status (only if checkLinkedInToken=true) */
  tokenStatus: TokenInfo;
  /** Whether a master is viewing as admin */
  isMasterMode: boolean;
  /** Company name when in master mode */
  masterCompanyName: string;
};

function getTokenStatus(rawData: Record<string, unknown> | undefined): TokenInfo {
  if (!rawData) return { status: 'not_connected', daysLeft: 0 };
  const connection = rawData?.linkedinConnection as { tokenExpiresAt?: number } | undefined;
  if (!connection?.tokenExpiresAt) return { status: 'not_connected', daysLeft: 0 };
  const now = Date.now();
  const msLeft = connection.tokenExpiresAt - now;
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  if (msLeft <= 0) return { status: 'expired', daysLeft: 0 };
  if (daysLeft <= 7) return { status: 'expiring_soon', daysLeft };
  return { status: 'valid', daysLeft };
}

export function useAuthGuard(options: UseAuthGuardOptions): UseAuthGuardReturn {
  const { role, checkLinkedInToken = false } = options;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [locale, setLocale] = useState<Locale>('pt-BR');
  const [ready, setReady] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenInfo>({ status: 'not_connected', daysLeft: 0 });
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [masterCompanyName, setMasterCompanyName] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Role validation
    if (role === 'master' && user.role !== 'master') {
      router.push('/login');
      return;
    }
    if (role === 'admin' && user.role !== 'admin' && user.role !== 'master') {
      router.push('/login');
      return;
    }
    if (role === 'colaborador' && user.role !== 'colaborador') {
      router.push('/login');
      return;
    }

    // Determine companyId
    if (role === 'admin' && user.role === 'master') {
      // Master viewing admin panel — companyId from URL
      const urlCompanyId = searchParams.get('companyId');
      if (urlCompanyId) {
        setCompanyId(urlCompanyId);
        setIsMasterMode(true);
        // Fetch company name + locale
        getDoc(doc(db, 'companies', urlCompanyId)).then((compDoc) => {
          if (compDoc.exists()) {
            const data = compDoc.data();
            setMasterCompanyName(data.companyName || '');
            setLocale((data.locale as Locale) || 'pt-BR');
          }
        });
      } else {
        router.push('/master/empresas');
        return;
      }
    } else if (role === 'master') {
      // Master in master panel — no companyId needed
      setCompanyId(undefined);
      setLocale('pt-BR');
    } else {
      // Admin or Colaborador — companyId from user doc
      setCompanyId(user.companyId);
      if (user.companyId) {
        getDoc(doc(db, 'companies', user.companyId)).then((compDoc) => {
          if (compDoc.exists()) {
            setLocale((compDoc.data().locale as Locale) || 'pt-BR');
          }
        });
      }
    }

    // LinkedIn token check (colaborador only)
    if (checkLinkedInToken && user.rawData) {
      setTokenStatus(getTokenStatus(user.rawData));
    }

    setReady(true);
  }, [user, authLoading, router, searchParams, role, checkLinkedInToken]);

  return {
    user: ready ? user : null,
    companyId,
    locale,
    ready,
    loading: authLoading,
    tokenStatus,
    isMasterMode,
    masterCompanyName,
  };
}
