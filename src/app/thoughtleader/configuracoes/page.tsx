// src/app/thoughtleader/configuracoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback, Suspense } from "react";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { NotificationSettings } from '@/components/notification-settings';
import { useT } from '@/lib/i18n/context';

type ProfileData = {
  name: string;
  email: string;
  company: string;
  photoURL?: string;
};

const TL_NOTIF_OPTIONS = [
  { key: 'post_ready_for_review', label: 'Posts prontos para revisão', description: 'Receber quando um post estiver pronto para sua aprovação.' },
];

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function TLSettingsContent() {
  const t = useT();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.uid || null;
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({ name: '', email: '', company: '' });

  const fetchData = useCallback(async (userId: string, companyId?: string) => {
    try {
      setIsLoading(true);
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();

        // Fetch company name from companies collection (user doc may not have it)
        let companyName = data.companyName || '';
        if (!companyName && companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
              companyName = companyDoc.data()?.companyName || companyDoc.data()?.name || '';
            }
          } catch {
            // Fallback — company name stays empty
          }
        }

        setProfile({
          name: data.profile?.name || data.name || '',
          email: data.profile?.email || data.email || '',
          company: companyName,
          photoURL: data.photoURL || '',
        });
      }
    } catch (error) {
      console.error("Erro ao buscar dados do TL:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um erro ao carregar suas configurações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUserId) fetchData(currentUserId, authUser?.companyId);
  }, [currentUserId, authUser?.companyId, fetchData]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header title={t.adminSettings.title} />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.adminSettings.title}</h1>
            <p className="text-muted-foreground">
              Gerencie suas preferências de conta e notificações.
            </p>
          </div>

          {isLoading ? (
            <SettingsSkeleton />
          ) : (
            <>
              {/* Perfil */}
              <Card>
                <CardHeader>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Suas informações pessoais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.photoURL || ""} />
                      <AvatarFallback>{profile.name?.[0]?.toUpperCase() || "T"}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo</Label>
                      <Input id="name" value={profile.name} readOnly disabled className="bg-muted cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" value={profile.email} readOnly disabled className="bg-muted cursor-not-allowed" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company">Empresa</Label>
                      <Input id="company" value={profile.company} readOnly disabled className="bg-muted cursor-not-allowed" />
                      <p className="text-xs text-muted-foreground">Estes campos são gerenciados pelo administrador da sua empresa.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notificações */}
              <NotificationSettings options={TL_NOTIF_OPTIONS} />

              {/* Privacy policy link */}
              <div className="text-center pt-4 border-t">
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                >
                  {t.common.privacyPolicy}
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function TLSettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen flex-col"><Header title="Configurações" /><main className="flex-1 p-6 md:p-10"><div className="mx-auto max-w-4xl"><SettingsSkeleton /></div></main></div>}>
      <TLSettingsContent />
    </Suspense>
  );
}
