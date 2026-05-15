'use client';

import { useAuth } from '@/contexts/auth-context';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { Header } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';
import { BrandContextShell } from '@/components/brand-context/brand-context-shell';

export default function AdminBrandContextPage() {
  const { user, loading } = useAuth();
  const companyId = useResolvedCompanyId();

  if (loading || !user) {
    return (
      <>
        <Header title="Manual de Marca" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  if (!companyId) return null;

  return <BrandContextShell companyId={companyId} />;
}
