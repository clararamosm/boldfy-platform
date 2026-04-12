'use client';

import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { BrandContextShell } from '@/components/brand-context/brand-context-shell';

export default function StrategistBrandContextPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return (
      <>
        <Header title="Brand Context" />
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

  return <BrandContextShell companyId={companyId} />;
}
