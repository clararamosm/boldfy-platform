'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';
import { BrandContextShell } from '@/components/brand-context/brand-context-shell';
import { getAuthToken } from '@/lib/auth-client';
import { resolveSlugs } from '@/app/actions/content-pipeline';

export default function StrategistBrandContextPage() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(!!companySlug);

  useEffect(() => {
    if (!companySlug) return;
    const resolve = async () => {
      setIsResolving(true);
      try {
        const token = await getAuthToken();
        const result = await resolveSlugs(token, companySlug);
        if (result.companyId) setCompanyId(result.companyId);
      } catch {
        // silent
      } finally {
        setIsResolving(false);
      }
    };
    resolve();
  }, [companySlug]);

  if (!companySlug) {
    return (
      <>
        <Header title="Manual de Marca" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Selecione uma empresa no menu lateral.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (isResolving || !companyId) {
    return (
      <>
        <Header title="Manual de Marca" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </>
    );
  }

  return <BrandContextShell companyId={companyId} />;
}
