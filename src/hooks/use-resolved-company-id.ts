// src/hooks/use-resolved-company-id.ts
// Returns the correct companyId for the current context:
// - Admin user → from user doc
// - Master/Strategist viewing admin → from ?companyId= URL param
// Use this in every admin page instead of user?.companyId directly.

'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

/**
 * Resolves the companyId for the current session.
 * Handles master mode (companyId from URL) and normal admin mode (companyId from user doc).
 */
export function useResolvedCompanyId(): string | null {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  if (!user) return null;

  // Master or Strategist viewing admin panel → companyId from URL
  if (user.role === 'master' || user.role === 'strategist') {
    return searchParams.get('companyId') || user.companyId || null;
  }

  // Normal admin/colaborador/TL → companyId from user doc
  return user.companyId || null;
}
