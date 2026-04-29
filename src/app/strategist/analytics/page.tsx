// src/app/strategist/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { AnalyticsDashboard } from '@/components/linkedin-analytics/analytics-dashboard';
import { Loader2, User } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';

export default function StrategistAnalyticsPage() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const tlSlug = searchParams.get('tl');

  const [tlId, setTlId] = useState<string | null>(null);
  const [tlName, setTlName] = useState('');
  const [tlAvatarUrl, setTlAvatarUrl] = useState<string | undefined>();
  const [isResolving, setIsResolving] = useState(false);

  // Resolver slug → ID do Firestore
  useEffect(() => {
    if (!companySlug || !tlSlug) {
      setTlId(null);
      return;
    }

    const resolve = async () => {
      setIsResolving(true);
      try {
        const token = await getAuthToken();
        const { resolveSlugs } = await import('@/app/actions/content-pipeline');
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.tlId) {
          setTlId(result.tlId);
          setTlName(result.tlName ?? '');
          // photoUrl não vem do resolveSlugs — deixar undefined (AnalyticsDashboard lida com isso)
        } else {
          setTlId(null);
        }
      } catch {
        setTlId(null);
      } finally {
        setIsResolving(false);
      }
    };

    resolve();
  }, [companySlug, tlSlug]);

  // Estado: nenhum TL selecionado
  if (!tlSlug || !companySlug) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecione um perfil no menu lateral para visualizar o Analytics.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  // Estado: resolvendo slug
  if (isResolving || (!tlId && tlSlug)) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  // Estado: TL não encontrado
  if (!tlId) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={`Analytics${tlName ? ` — ${tlName}` : ''}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AnalyticsDashboard
          userId={tlId}
          userName={tlName || undefined}
          userAvatarUrl={tlAvatarUrl}
          role="strategist"
          showActionPlan={true}
          readOnlyActionPlan={false}
          showMediaValue={false}
          uploadPending={false}
        />
      </main>
    </>
  );
}
