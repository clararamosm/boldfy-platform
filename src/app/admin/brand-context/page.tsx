'use client';

import { useAuth } from '@/contexts/auth-context';
import { Header } from '@/components/dashboard/header';
import { Loader2 } from 'lucide-react';
import { BrandContextShell } from '@/components/brand-context/brand-context-shell';

export default function AdminBrandContextPage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <>
        <Header title="Brand Context" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  const companyId = user.companyId;
  if (!companyId) return null;

  return <BrandContextShell companyId={companyId} />;
}
