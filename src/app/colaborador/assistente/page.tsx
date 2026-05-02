// src/app/colaborador/assistente/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { useT } from '@/lib/i18n/context';
import { AiAssistantForm } from "@/components/ai-assistant-form";
import { HotTopicsBox } from "@/components/hot-topics-box";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useAiCredits } from '@/hooks/use-ai-credits';

function AiCreditsTag() {
  const { remaining, bonusCredits, monthlyLimit, totalAvailable, loading } = useAiCredits();
  if (loading) return null;
  const isExhausted = totalAvailable <= 0;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Monthly credits */}
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${isExhausted ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'}`}>
        <Sparkles className="h-3 w-3" />
        {remaining}/{monthlyLimit} mensais
      </span>
      {/* Bonus credits (redeemed) — only show if > 0 */}
      {bonusCredits > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          <ShoppingCart className="h-3 w-3" />
          +{bonusCredits} resgatados
        </span>
      )}
    </div>
  );
}

function CreditExhaustedCard() {
  const { daysUntilRenewal } = useAiCredits();
  return (
    <Card className="border-dashed border-red-200 dark:border-red-900">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">Créditos esgotados</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Você usou todos os seus créditos de IA deste mês.
          {daysUntilRenewal != null && (
            <> Seus créditos mensais renovam em <strong>{daysUntilRenewal} dia{daysUntilRenewal !== 1 ? 's' : ''}</strong>.</>
          )}
          {' '}Você também pode trocar seus pontos por créditos extras na loja de recompensas.
        </p>
        <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700">
          <Link href="/colaborador/recompensas">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Resgatar créditos extras
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const AssistantPageSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Skeleton className="h-16 w-16 rounded-full mb-4" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </CardContent>
    </Card>
  </div>
);

export default function AiAssistantPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const [topicPrompt, setTopicPrompt] = useState<string | undefined>();
  const { totalAvailable, loading: creditsLoading } = useAiCredits();

  // Build user profile for the LinkedIn preview mockup
  const userProfile = useMemo(() => {
    if (!user) return undefined;
    const raw = user.rawData || {};
    return {
      name: user.name,
      avatarUrl: user.profile?.avatarUrl || (raw.photoURL as string) || undefined,
      headline: (raw.position as string) || undefined,
    };
  }, [user]);

  const isBlocked = !creditsLoading && totalAvailable <= 0;

  return (
    <>
      <Header title={t.ai.pageTitle}>
        {!loading && user && <AiCreditsTag />}
      </Header>
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">

        {/* Hot Topics Box */}
        {!loading && user && !isBlocked && (
          <HotTopicsBox onSelectTopic={setTopicPrompt} />
        )}

        {/* Assistant Form or Block Overlay */}
        {loading ? (
          <AssistantPageSkeleton />
        ) : user ? (
          isBlocked ? (
            <CreditExhaustedCard />
          ) : (
            <AiAssistantForm
              companyId={user.companyId || ''}
              userId={user.uid}
              externalContent={topicPrompt}
              userProfile={userProfile}
            />
          )
        ) : (
          <p className="text-center text-muted-foreground">{t.ai.errorLoadUser}</p>
        )}
      </main>
    </>
  );
}
