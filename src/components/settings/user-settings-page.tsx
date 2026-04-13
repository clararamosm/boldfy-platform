// src/components/settings/user-settings-page.tsx
// Shared settings page for Colaborador and Thought Leader.
// Shows: Profile (read-only) + LinkedIn connection + Notifications.

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from '@/components/dashboard/header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationSettings } from '@/components/notification-settings';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { getLinkedInAuthUrl, disconnectLinkedIn } from '@/app/actions/linkedin';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import {
  Loader2, Linkedin, ExternalLink, Unlink,
  CheckCircle2, AlertCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type NotifOption = {
  key: string;
  label: string;
  description: string;
};

type LinkedInConnectionData = {
  linkedinId: string;
  name: string;
  email?: string;
  picture?: string;
  tokenExpiresAt: number;
  connectedAt: number;
  scopes: string;
} | null;

type UserSettingsPageProps = {
  notificationOptions: NotifOption[];
};

// ─── Skeleton ───────────────────────────────────────────────

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

// ─── Main content ───────────────────────────────────────────

function UserSettingsContent({ notificationOptions }: UserSettingsPageProps) {
  const t = useT();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.uid || null;

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState({ name: '', email: '', company: '', photoURL: '' });
  const [linkedinConnection, setLinkedinConnection] = useState<LinkedInConnectionData>(null);
  const [isConnectingLinkedin, setIsConnectingLinkedin] = useState(false);
  const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);

  // ── Fetch user data ──
  const fetchData = useCallback(async (userId: string, companyId?: string) => {
    try {
      setIsLoading(true);
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();

        // Fetch company name
        let companyName = data.companyName || '';
        if (!companyName && companyId) {
          try {
            const compDoc = await getDoc(doc(db, 'companies', companyId));
            if (compDoc.exists()) {
              companyName = compDoc.data()?.companyName || compDoc.data()?.name || '';
            }
          } catch { /* fallback — empty */ }
        }

        setProfile({
          name: data.profile?.name || data.name || '',
          email: data.profile?.email || data.email || '',
          company: companyName,
          photoURL: data.photoURL || '',
        });

        setLinkedinConnection(data.linkedinConnection || null);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar dados', description: 'Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUserId) fetchData(currentUserId, authUser?.companyId);
  }, [currentUserId, authUser?.companyId, fetchData]);

  // ── Handle LinkedIn OAuth redirect ──
  const searchParams = useSearchParams();
  useEffect(() => {
    const linkedinStatus = searchParams.get('linkedin');
    if (linkedinStatus === 'success') {
      toast({ title: 'LinkedIn conectado!', description: 'Sua conta do LinkedIn foi vinculada com sucesso.' });
      completeOnboardingItem(currentUserId ?? undefined, 'connect-linkedin');
      if (currentUserId) fetchData(currentUserId, authUser?.companyId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (linkedinStatus === 'error') {
      const message = searchParams.get('message') || 'Erro ao conectar com LinkedIn.';
      toast({ variant: 'destructive', title: 'Erro no LinkedIn', description: message });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, toast, currentUserId, authUser?.companyId, fetchData]);

  // ── LinkedIn actions ──
  const handleConnectLinkedin = async () => {
    if (!currentUserId) return;
    setIsConnectingLinkedin(true);
    try {
      const token = await getAuthToken();
      const result = await getLinkedInAuthUrl(token, currentUserId);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      } else if (result.url) {
        window.location.href = result.url;
        return;
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar a conexão.' });
    }
    setIsConnectingLinkedin(false);
  };

  const handleDisconnectLinkedin = async () => {
    if (!currentUserId) return;
    setIsDisconnectingLinkedin(true);
    try {
      const token = await getAuthToken();
      const result = await disconnectLinkedIn(token, currentUserId);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      } else {
        setLinkedinConnection(null);
        toast({ title: 'LinkedIn desconectado', description: 'Sua conta do LinkedIn foi desvinculada.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desconectar.' });
    }
    setIsDisconnectingLinkedin(false);
  };

  const isLinkedinTokenValid = useMemo(() => {
    if (!linkedinConnection) return false;
    return Date.now() < linkedinConnection.tokenExpiresAt - 5 * 60 * 1000;
  }, [linkedinConnection]);

  // ── Render ──
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
              {/* ── Perfil ── */}
              <Card>
                <CardHeader>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Suas informações pessoais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.photoURL || ''} />
                      <AvatarFallback>{profile.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    {!profile.photoURL && (
                      <p className="text-xs text-muted-foreground">
                        Conecte seu LinkedIn abaixo para sincronizar sua foto de perfil.
                      </p>
                    )}
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
                      <p className="text-xs text-muted-foreground">
                        Estes campos são gerenciados pelo administrador da sua empresa.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── LinkedIn ── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2]">
                        <Linkedin className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">LinkedIn</CardTitle>
                        <CardDescription>Conecte sua conta para publicar conteúdo diretamente.</CardDescription>
                      </div>
                    </div>
                    {linkedinConnection && (
                      <Badge
                        variant={isLinkedinTokenValid ? 'default' : 'secondary'}
                        className={isLinkedinTokenValid
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }
                      >
                        {isLinkedinTokenValid ? (
                          <><CheckCircle2 className="mr-1 h-3 w-3" /> Conectado</>
                        ) : (
                          <><AlertCircle className="mr-1 h-3 w-3" /> Token expirado</>
                        )}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedinConnection ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        {linkedinConnection.picture ? (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={linkedinConnection.picture} />
                            <AvatarFallback>{linkedinConnection.name?.[0]?.toUpperCase() || 'L'}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2]/10">
                            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{linkedinConnection.name}</p>
                          {linkedinConnection.email && (
                            <p className="text-xs text-muted-foreground truncate">{linkedinConnection.email}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Conectado em</p>
                          <p>{new Date(linkedinConnection.connectedAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      {!isLinkedinTokenValid && (
                        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <p>Seu token de acesso expirou. Reconecte sua conta para continuar publicando.</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {!isLinkedinTokenValid && (
                          <Button onClick={handleConnectLinkedin} disabled={isConnectingLinkedin} size="sm">
                            {isConnectingLinkedin ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reconectando...</>
                            ) : (
                              <><ExternalLink className="mr-2 h-4 w-4" /> Reconectar</>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectLinkedin}
                          disabled={isDisconnectingLinkedin}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                        >
                          {isDisconnectingLinkedin ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Desconectando...</>
                          ) : (
                            <><Unlink className="mr-2 h-4 w-4" /> Desconectar</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Conecte sua conta do LinkedIn para publicar conteúdo diretamente na plataforma.
                        Seus dados são armazenados com segurança.
                      </p>
                      <Button
                        onClick={handleConnectLinkedin}
                        disabled={isConnectingLinkedin}
                        className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                      >
                        {isConnectingLinkedin ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
                        ) : (
                          <><Linkedin className="mr-2 h-4 w-4" /> Conectar LinkedIn</>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Notificações ── */}
              <NotificationSettings options={notificationOptions} />

              {/* ── Privacy policy ── */}
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

// ─── Exported wrapper with Suspense ─────────────────────────

export function UserSettingsPage(props: UserSettingsPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header title="Configurações" />
          <main className="flex-1 p-6 md:p-10">
            <div className="mx-auto max-w-4xl">
              <SettingsSkeleton />
            </div>
          </main>
        </div>
      }
    >
      <UserSettingsContent {...props} />
    </Suspense>
  );
}
