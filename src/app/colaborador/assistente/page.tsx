// src/app/colaborador/assistente/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { AiAssistantForm } from "@/components/ai-assistant-form";
import { HotTopicsBox } from "@/components/hot-topics-box";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
  const { user, loading } = useAuth();
  const [topicPrompt, setTopicPrompt] = useState<string | undefined>();

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

  return (
    <>
      <Header title="Assistente de Conteúdo IA" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {/* Hot Topics Box */}
        {!loading && user && (
          <HotTopicsBox onSelectTopic={setTopicPrompt} />
        )}

        {/* Assistant Form */}
        {loading ? (
          <AssistantPageSkeleton />
        ) : user ? (
          <AiAssistantForm
            companyId={user.companyId || ''}
            userId={user.uid}
            externalContent={topicPrompt}
            userProfile={userProfile}
          />
        ) : (
          <p className="text-center text-muted-foreground">Ocorreu um erro ao carregar os dados do usuario.</p>
        )}
      </main>
    </>
  );
}
