// src/app/influencer/assistente/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { AiAssistantForm } from "@/components/ai-assistant-form";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

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
                     </div>
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                     </div>
                 </div>
                 <div className="flex justify-end">
                    <Skeleton className="h-10 w-36" />
                 </div>
                 <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </CardContent>
        </Card>
     </div>
)


export default function AiAssistantPage() {
  const [userInfo, setUserInfo] = useState<{ userId: string; companyId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userCompanyId = userDocSnap.data().companyId;
                setUserInfo({ userId: user.uid, companyId: userCompanyId });
            } else {
                 toast({ variant: "destructive", title: "Erro de autenticação", description: "Não foi possível encontrar os dados do seu usuário."});
            }
        }
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  

  return (
    <>
      <Header title="Assistente de Conteúdo IA" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
            <AssistantPageSkeleton />
        ) : userInfo ? (
            <AiAssistantForm companyId={userInfo.companyId} userId={userInfo.userId} />
        ) : (
            <p className="text-center text-muted-foreground">Faça login para usar o assistente.</p>
        )}
      </main>
    </>
  );
}
