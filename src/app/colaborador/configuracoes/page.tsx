// src/app/colaborador/configuracoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Select removido — voice agora é textarea livre
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, Linkedin, ExternalLink, Unlink, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from '@/lib/auth-client';
import { getLinkedInAuthUrl, disconnectLinkedIn } from "@/app/actions/linkedin";
import { useT } from '@/lib/i18n/context';

type ProfileData = {
    name: string;
    email: string;
    company: string;
  photoURL?: string;
};

type BrandingData = {
    voice: string;
    expertise: string;
    value: string;
    position: string;
    languageStyle: string;
    contentPillars: string;
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
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}

function SettingsPageContent() {
    const t = useT();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { user: authUser } = useAuth();
    const currentUserId = authUser?.uid || null;
    const [profile, setProfile] = useState<ProfileData>({ name: '', email: '', company: '' });
    const [branding, setBranding] = useState<BrandingData>({ voice: '', expertise: '', value: '', position: '', languageStyle: '', contentPillars: '' });
    const [linkedinConnection, setLinkedinConnection] = useState<LinkedInConnectionData>(null);
    const [isConnectingLinkedin, setIsConnectingLinkedin] = useState(false);
    const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);

    const fetchData = useCallback(async (userId: string) => {
        try {
            setIsLoading(true);
            const userDocRef = doc(db, 'users', userId);
            const userSnapshot = await getDoc(userDocRef);

            if (userSnapshot.exists()) {
                const data = userSnapshot.data();
          setProfile({
            name: data.profile?.name || data.name || '',
            email: data.profile?.email || data.email || '',
            company: data.companyName || '',
            photoURL: data.photoURL || '',
          });
                setBranding({
                    voice: data.voice || '',
                    expertise: data.expertise || '',
                    value: data.value || '',
                    position: data.position || '',
                    languageStyle: data.languageStyle || '',
                    contentPillars: Array.isArray(data.contentPillars) ? data.contentPillars.join(', ') : (data.contentPillars || ''),
                });
                if (data.linkedinConnection) {
                    setLinkedinConnection(data.linkedinConnection);
                }
            } else {
                toast({
                    title: "Perfil não encontrado",
                    description: "Não foi possível encontrar os dados do seu perfil.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Erro ao buscar dados do usuário:", error);
            toast({
                title: "Erro ao carregar dados",
                description: "Ocorreu um erro ao carregar suas configurações. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (currentUserId) fetchData(currentUserId);
    }, [currentUserId, fetchData]);

    const searchParams = useSearchParams();
    useEffect(() => {
        const linkedinStatus = searchParams.get('linkedin');
        if (linkedinStatus === 'success') {
            toast({ title: "LinkedIn conectado!", description: "Sua conta do LinkedIn foi vinculada com sucesso." });
            if (currentUserId) fetchData(currentUserId);
            window.history.replaceState({}, '', window.location.pathname);
        } else if (linkedinStatus === 'error') {
            const message = searchParams.get('message') || 'Erro ao conectar com LinkedIn.';
            toast({ variant: "destructive", title: "Erro no LinkedIn", description: message });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [searchParams, toast, currentUserId, fetchData]);

    const handleConnectLinkedin = async () => {
        if (!currentUserId) return;
        setIsConnectingLinkedin(true);
        try {
            const token = await getAuthToken();
            const result = await getLinkedInAuthUrl(token, currentUserId);
            if (result.error) {
                toast({ variant: "destructive", title: "Erro", description: result.error });
            } else if (result.url) {
                window.location.href = result.url;
                return;
            }
        } catch {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível iniciar a conexão com o LinkedIn." });
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
                toast({ variant: "destructive", title: "Erro", description: result.error });
            } else {
                setLinkedinConnection(null);
                toast({ title: "LinkedIn desconectado", description: "Sua conta do LinkedIn foi desvinculada." });
            }
        } catch {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível desconectar o LinkedIn." });
        }
        setIsDisconnectingLinkedin(false);
    };

    const isLinkedinTokenValid = useMemo(() => {
        if (!linkedinConnection) return false;
        const bufferMs = 5 * 60 * 1000;
        return Date.now() < linkedinConnection.tokenExpiresAt - bufferMs;
    }, [linkedinConnection]);

    // Photo is now synced automatically from LinkedIn when connecting

    const handleSave = async () => {
        if (!currentUserId) {
            toast({
                title: "Erro",
                description: "Usuário não identificado. Faça login novamente.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', currentUserId);
            await setDoc(userDocRef, {
                voice: branding.voice,
                expertise: branding.expertise,
                value: branding.value,
                position: branding.position,
                languageStyle: branding.languageStyle,
                contentPillars: branding.contentPillars.split(',').map(s => s.trim()).filter(Boolean),
            }, { merge: true });

            toast({
                title: "Configurações salvas",
                description: "Suas configurações foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Erro ao salvar configurações:", error);
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar suas configurações. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 p-6 md:p-10">
                <div className="mx-auto max-w-4xl space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t.adminSettings.title}</h1>
                        <p className="text-muted-foreground">
                            Gerencie suas configurações de conta e preferências de marca pessoal.
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
                                    <CardDescription>
                                        Suas informações pessoais e dados de contato.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage src={profile?.photoURL || ""} />
                                            <AvatarFallback>
                                                {profile?.name?.[0]?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            {!profile?.photoURL && (
                                                <p className="text-xs text-muted-foreground">
                                                    Conecte seu LinkedIn abaixo para sincronizar sua foto de perfil.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Nome completo</Label>
                                            <Input
                                                id="name"
                                                value={profile.name}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">E-mail</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={profile.email}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="company">Empresa</Label>
                                            <Input
                                                id="company"
                                                value={profile.company}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                            <p className="text-xs text-muted-foreground">Estes campos são gerenciados pelo administrador da sua empresa.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Marca Pessoal */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Marca Pessoal</CardTitle>
                                    <CardDescription>
                                        Configure sua identidade de marca para geração de conteúdo.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="voice">Tom de voz</Label>
                                        <Textarea
                                            id="voice"
                                            placeholder="Como você se comunica? Ex: informal e direto, técnico e analítico, inspiracional com humor..."
                                            value={branding.voice}
                                            onChange={(e) =>
                                                setBranding({ ...branding, voice: e.target.value })
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">Descreva livremente como você fala e escreve. A IA vai calibrar o tom do conteúdo com base nisso.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="expertise">Áreas de expertise</Label>
                                        <Textarea
                                            id="expertise"
                                            placeholder="Ex: Marketing Digital, Vendas B2B, Liderança..."
                                            value={branding.expertise}
                                            onChange={(e) =>
                                                setBranding({ ...branding, expertise: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="value">Proposta de valor</Label>
                                        <Textarea
                                            id="value"
                                            placeholder="O que você oferece de único para sua audiência?"
                                            value={branding.value}
                                            onChange={(e) =>
                                                setBranding({ ...branding, value: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="position">Cargo / Posição</Label>
                                        <Input
                                            id="position"
                                            placeholder="Ex: CEO, Diretor de Marketing, Consultor..."
                                            value={branding.position}
                                            onChange={(e) =>
                                                setBranding({ ...branding, position: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="languageStyle">Estilo de linguagem</Label>
                                        <Textarea
                                            id="languageStyle"
                                            placeholder="Preferências de escrita: usa gírias? é formal? escreve curto? usa analogias? Ex: 'direto, frases curtas, sem formalidade, gosto de analogias do esporte'"
                                            value={branding.languageStyle}
                                            onChange={(e) =>
                                                setBranding({ ...branding, languageStyle: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contentPillars">Pilares de conteúdo</Label>
                                        <Textarea
                                            id="contentPillars"
                                            placeholder="Os 2-4 temas que você aborda no LinkedIn, separados por vírgula (ex: liderança, vendas consultivas, cultura de feedback)"
                                            value={branding.contentPillars}
                                            onChange={(e) =>
                                                setBranding({ ...branding, contentPillars: e.target.value })
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">Separe por vírgula. A IA garante que todo conteúdo se encaixe nesses pilares.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* LinkedIn */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2]">
                                                <Linkedin className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">LinkedIn</CardTitle>
                                                <CardDescription>
                                                    Conecte sua conta para publicar conteúdo diretamente.
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {linkedinConnection && (
                                            <Badge
                                                variant={isLinkedinTokenValid ? "default" : "secondary"}
                                                className={isLinkedinTokenValid
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
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
                                                    <Button
                                                        onClick={handleConnectLinkedin}
                                                        disabled={isConnectingLinkedin}
                                                        size="sm"
                                                    >
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
                                                Conecte sua conta do LinkedIn para publicar conteúdo alinhado diretamente na plataforma.
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

                            {/* Notificações */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t.adminSettings.notificationsTitle}</CardTitle>
                                    <CardDescription>
                                        {t.adminSettings.notificationsDescription}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Notificações por e-mail</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Receba atualizações sobre novos conteúdos e análises.
                                            </p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Lembretes de postagem</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Seja lembrado quando houver conteúdo pronto para publicar.
                                            </p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Relatórios semanais</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Receba um resumo semanal do desempenho dos seus posts.
                                            </p>
                                        </div>
                                        <Switch />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Botão Salvar */}
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {t.common.saving}
                                        </>
                                    ) : (
                                        t.common.saveChanges
                                    )}
                                </Button>
                            </div>

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

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen flex-col"><Header /><main className="flex-1 p-6 md:p-10"><div className="mx-auto max-w-4xl"><SettingsSkeleton /></div></main></div>}>
            <SettingsPageContent />
        </Suspense>
    );
}
