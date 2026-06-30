'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { AnalyticsDashboard } from '@/components/linkedin-analytics/analytics-dashboard';
import { Loader2, User } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { getAdminExecutiveData, type AdminExecutiveTL } from '@/app/actions/content-pipeline';

export default function AdminExecutiveAnalyticsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tlSlug = searchParams.get('tl');

  const [tls, setTls] = useState<AdminExecutiveTL[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const result = await getAdminExecutiveData(token);
        if (result.tls) setTls(result.tls);
      } catch (e) {
        console.error('Error loading executive analytics:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  // Resolve ?tl=slug → TL. Sem ?tl=, cai no primeiro líder disponível.
  const selectedTl = useMemo(() => {
    if (tls.length === 0) return null;
    if (tlSlug) return tls.find(tl => tl.slug === tlSlug) ?? null;
    return tls[0];
  }, [tls, tlSlug]);

  if (isLoading) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (tls.length === 0) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum executivo disponível.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  // ?tl= presente mas não encontrado entre os líderes da empresa
  if (tlSlug && !selectedTl) {
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

  if (!selectedTl) {
    return (
      <>
        <Header title="Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecione um executivo no menu lateral para visualizar o Analytics.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={`Analytics — ${selectedTl.name}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AnalyticsDashboard
          userId={selectedTl.id}
          userName={selectedTl.name}
          userAvatarUrl={selectedTl.photoUrl}
          role="admin"
          showActionPlan={true}
          readOnlyActionPlan={true}
          showIcpScore={false}
          showMediaValue={true}
          uploadPending={false}
        />
      </main>
    </>
  );
}
