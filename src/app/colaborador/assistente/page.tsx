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
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useAiCredits } from '@/hooks/use-ai-credits';

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

function AiCreditsBar() {
  const { totalAvailable, monthlyLimit, bonusCredits, daysUntilRenewal, loading } = useAiCredits();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  const isExhausted = totalAvailable <= 0;
  const percentage = monthlyLimit > 0 ? Math.min(100, (totalAvailable / monthlyLimit) * 100) : 0;

  return (
    <Card className={isExhausted ? 'border-red-200 bg-red-50/50' : 'border-purple-200 bg-purple-50/30'}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${isExhausted ? 'text-red-500' : 'text-purple-600'}`} />
            <span className="text-sm font-medium">
              {isExhausted ? 'Seus creditos de IA acabaram' : 'Creditos de IA'}
            </span>
          </div>
          <span className={`text-sm font-bold ${isExhausted ? 'text-red-600' : 'text-purple-700'}`}>
            {totalAvailable}/{monthlyLimit}
          </span>
        </div>

        <Progress
          value={percentage}
          className={`h-2 ${isExhausted ? '[&>div]:bg-red-500' : '[&>div]:bg-purple-600'}`}
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {daysUntilRenewal !== null
                ? `Renovam em ${daysUntilRenewal} dia${daysUntilRenewal !== 1 ? 's' : ''}`
                : 'Renovacao mensal'
              }
            </span>
            {bonusCredits > 0 && (
              <span className="ml-2 text-purple-600">+{bonusCredits} bonus</span>
            )}
          </div>
          {isExhausted && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50">
              <Link href="/colaborador/recompensas">
                <ShoppingCart className="h-3 w-3 mr-1" />
                Comprar mais creditos
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
      <Header title={t.ai.pageTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {/* AI Credits Bar */}
        {!loading && user && <AiCreditsBar />}

        {/* Hot Topics Box */}
        {!loading && user && !isBlocked && (
          <HotTopicsBox onSelectTopic={setTopicPrompt} />
        )}

        {/* Assistant Form or Block Overlay */}
        {loading ? (
          <AssistantPageSkeleton />
        ) : user ? (
          isBlocked ? (
            <Card className="border-dashed border-red-200">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-red-700 mb-1">Creditos esgotados</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Voce usou todos os seus creditos de IA deste mes.
                  Troque seus pontos por mais creditos na loja de recompensas ou aguarde a renovacao mensal.
                </p>
                <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700">
                  <Link href="/colaborador/recompensas">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Ir para a loja
                  </Link>
                </Button>
              </CardContent>
            </Card>
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
