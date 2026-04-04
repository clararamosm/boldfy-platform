// src/app/colaborador/assistente/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { AiAssistantForm } from "@/components/ai-assistant-form";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

const AssistantPageSkeleton = () => (
  <div className="mx-auto max-w-3xl">
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-5/6" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default function AiAssistantPage() {
  const [userInfo, setUserInfo] = useState<{ userId: string; companyId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUserInfo({
            userId: firebaseUser.uid,
            companyId: userData.companyId || '',
          });
        } else {
          toast({
            title: "Erro",
            description: "Dados do usuário não encontrados.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Erro",
          description: "Falha ao carregar dados do usuário.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  return (
    <>
      <Header title="Assistente de Conteúdo IA" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <AssistantPageSkeleton />
        ) : userInfo ? (
          <AiAssistantForm companyId={userInfo.companyId} userId={userInfo.userId} />
        ) : (
          <p className="text-center text-muted-foreground">Ocorreu um erro ao carregar os dados do usuário.</p>
        )}
      </main>
    </>
  );
}
