// src/hooks/use-company-data.ts
// Centralized hook for fetching company document data.
// Eliminates repeated onAuthStateChanged + getDoc(companies/...) patterns
// scattered across admin pages.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type CompanyDoc = {
  id: string;
  companyName: string;
  status: 'Ativa' | 'Inativa' | 'Trial' | 'pending_payment';
  licenses: number;
  tlLicenses?: number;
  strategistId?: string | null;
  strategistIds?: string[];
  locale: string;
  trialEndsAt?: string;
  trialEndDate?: string;
  monthlyPrize?: string;
  adminPhotoURL?: string;
  adminProfile?: {
    name?: string;
    email?: string;
  };
  brandContext?: {
    valueProposition?: string;
    tagline?: string;
    businessKeywords?: string[] | string;
    solutions?: string[] | string;
    targetPainPoints?: string[] | string;
    targetAudience?: string;
    approvedTopics?: string[] | string;
    prohibitedPhrases?: string[] | string;
  };
  /** Raw Firestore data for any fields not typed above */
  raw: Record<string, unknown>;
};

type UseCompanyDataReturn = {
  /** Company document data (null while loading) */
  company: CompanyDoc | null;
  /** Whether the data is still loading */
  isLoading: boolean;
  /** Error if any occurred during fetch */
  error: string | null;
  /** Re-fetch company data */
  refetch: () => Promise<void>;
};

/**
 * Fetches and caches the company document for the given companyId.
 * Call this from any admin page to avoid duplicating the
 * onAuthStateChanged + getDoc(users/uid) + getDoc(companies/id) pattern.
 *
 * Typical usage:
 * ```ts
 * const { companyId } = useAuthGuard({ role: 'admin' });
 * const { company, isLoading } = useCompanyData(companyId);
 * ```
 */
export function useCompanyData(companyId: string | undefined | null): UseCompanyDataReturn {
  const [company, setCompany] = useState<CompanyDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      if (snap.exists()) {
        const data = snap.data();
        setCompany({
          id: snap.id,
          companyName: data.companyName || '',
          status: data.status || 'Trial',
          licenses: data.licenses || 0,
          tlLicenses: data.tlLicenses || 0,
          strategistId: data.strategistId || null,
          strategistIds: data.strategistIds || (data.strategistId ? [data.strategistId] : []),
          locale: data.locale || 'pt-BR',
          trialEndsAt: data.trialEndsAt,
          trialEndDate: data.trialEndDate,
          monthlyPrize: data.monthlyPrize,
          adminPhotoURL: data.adminPhotoURL,
          adminProfile: data.adminProfile,
          brandContext: data.brandContext || data.branding,
          raw: data,
        });
      } else {
        setError('Company document not found');
        setCompany(null);
      }
    } catch (err) {
      console.error('useCompanyData: Error fetching company:', err);
      setError('Failed to fetch company data');
      setCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return {
    company,
    isLoading,
    error,
    refetch: fetchCompany,
  };
}
