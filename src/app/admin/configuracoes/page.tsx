// src/app/admin/configuracoes/page.tsx
'use client';

import { useState, useEffect, useCallback, useActionState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { createCheckoutSession } from "@/app/actions";
import { getStripe } from "@/lib/stripe-client";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";

type CompanyData = {
    id: string;
    adminName: string;
    companyName: string;
    email: string;
    tagline: string;
    audience: string;
    tone: string;
    messages: string;
    status: 'Ativa' | 'Inativa' | 'Trial' | 'pending_payment';
    licenses: number;
    trialEndsAt?: string;
};

function ActivationForm({ companyData }: { companyData: CompanyData }) {
    const { pending } = useFormStatus();
    
    if (!companyData) return null;

    const isTrial = companyData.status === 'Trial';

    return (
        <div className="space-y-4">
             <input type="hidden" name="companyId" value={companyData.id} />
             <input type="hidden" name="companyName" value={companyData.companyName} />
             <input type="hidden" name="adminEmail" value={companyData.email} />
             <input type="hidden" name="adminName" value={companyData.adminName} />
             <input type="hidden" name="licenses" value={companyData.licenses} />
             <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
                {pending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecionando...
                    </>
                ) : (
                    isTrial ? "Iniciar Assinatura com 30 Dias Grátis" : "Ativar Assinatura"
                )}
             </Button>
        </div>
    )
}


const SettingsSkeleton = () => (
    <>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
          {/* Admin Profile Skeleton */}
          <Card>
            <CardHeader>
              <CardTitle><Skeleton className="h-7 w-48" /></CardTitle>
              <CardDescription><Skeleton className="h-4 w-full max-w-sm" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-10 w-28" />
              </div>
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
            </CardContent>
          </Card>
          {/* Company Settings Skeleton */}
          <Card>
            <CardHeader>
                <CardTitle><Skeleton className="h-7 w-56" /></CardTitle>
                <CardDescription><Skeleton className="h-4 w-full max-w-md" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-20 w-full" /></div>
            </CardContent>
             <CardFooter className="border-t px-6 py-4">
                <Skeleton className="h-10 w-48" />
            </CardFooter>
          </Card>
        </div>
      </main>
    </>
);


function ConfiguracoesPageContent() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [checkoutState, formAction] = useActionState(createCheckoutSession, { error: undefined, sessionId: undefined });
    const searchParams = useSearchParams();

    const fetchData = useCallback(async (userId: string) => {
        try {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                throw new Error("Documento do usuário não encontrado.");
            }
            const companyId = userDocSnap.data()?.companyId;
            if (!companyId) {
                throw new Error("ID da empresa não encontrado no perfil do usuário.");
            }

            const companyDocRef = doc(db, "companies", companyId);
            const companyDocSnap = await getDoc(companyDocRef);

            if (companyDocSnap.exists()) {
                const data = companyDocSnap.data();
                setCompanyData({
                    id: companyDocSnap.id,
                    adminName: data.adminProfile?.name || '',
                    companyName: data.companyName || '',
                    email: data.adminProfile?.email || '',
                    tagline: data.branding?.tagline || '',
                    audience: data.branding?.audience || '',
                    tone: data.branding?.tone || '',
                    messages: data.branding?.messages || '',
                    status: data.status || 'Inativa',
                    licenses: data.licenses || 0,
                    trialEndsAt: data.trialEndsAt
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: "Erro ao carregar empresa",
                    description: "Os dados da sua empresa não foram encontrados.",
                });
            }
        } catch (error) {
            console.error("Error fetching settings: ", error);
            toast({
                variant: 'destructive',
                title: "Erro ao carregar configurações",
                description: "Não foi possível buscar os dados. Tente novamente mais tarde.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

     // Listen to auth state changes to get the current user ID and fetch data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUserId(user.uid);
                fetchData(user.uid);
            } else {
                setCurrentUserId(null);
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchData]);

    // Handle toast notifications for payment status
    useEffect(() => {
        if (searchParams.get('payment_success') && currentUserId) {
            toast({
                title: 'Assinatura Iniciada!',
                description: 'Seu período de teste começou. Bem-vindo(a) à Boldfy!',
            });
            fetchData(currentUserId);
        }
        if (searchParams.get('payment_canceled')) {
             toast({
                variant: 'destructive',
                title: 'Processo Cancelado',
                description: 'O processo de assinatura foi cancelado. Você pode tentar novamente a qualquer momento.',
            });
        }
    }, [searchParams, toast, currentUserId, fetchData]);

     // Handle Stripe redirect and errors
    useEffect(() => {
        if (checkoutState?.sessionId) {
            const redirectToCheckout = async () => {
                const stripe = await getStripe();
                if (!stripe) {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Stripe.js não foi carregado.' });
                    return;
                }
                await stripe.redirectToCheckout({ sessionId: checkoutState.sessionId! });
            }
            redirectToCheckout();
        }
        if (checkoutState?.error) {
            toast({
                variant: 'destructive',
                title: 'Erro no Checkout',
                description: checkoutState.error,
            });
        }
    }, [checkoutState, toast]);
    
    const handleSaveChanges = async (section: 'branding') => {
        if (!companyData) return;
        setIsSaving(true);
        try {
            const companyDocRef = doc(db, "companies", companyData.id);
            
            let dataToSave = {};
            if (section === 'branding') {
                 dataToSave = { 
                    branding: {
                        tagline: companyData.tagline,
                        audience: companyData.audience,
                        tone: companyData.tone,
                        messages: companyData.messages,
                    }
                };
            }

            await setDoc(companyDocRef, dataToSave, { merge: true });

            toast({
                title: "Sucesso!",
                description: `As configurações de branding da empresa foram salvas.`,
            });
        } catch (error) {
             console.error("Error saving settings: ", error);
             toast({
                variant: 'destructive',
                title: "Erro ao salvar",
                description: "Não foi possível salvar as alterações. Tente novamente.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        if (companyData) {
            setCompanyData(prev => ({ ...prev!, [id]: value }));
        }
    };
    
    const isSubscriptionNeeded = companyData?.status === 'Inativa' || companyData?.status === 'Trial';
    const isReadOnly = companyData?.status === 'Inativa';

    if (isLoading || !companyData) {
        return <SettingsSkeleton />;
    }

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
            
            {isSubscriptionNeeded && (
                 <Card className="border-primary bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="text-primary"/>Sua Conta Precisa de uma Assinatura</CardTitle>
                        <CardDescription>
                            {companyData.status === 'Trial'
                                ? 'Você está em um período de teste gratuito. Para garantir que não haja interrupção no serviço, inicie sua assinatura agora. A cobrança só ocorrerá após o fim do período de teste.'
                                : 'Para desbloquear todas as funcionalidades da plataforma, como convidar colaboradores e criar missões, é necessário ativar sua assinatura.'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <form action={formAction}>
                            <ActivationForm companyData={companyData} />
                         </form>
                    </CardContent>
                </Card>
            )}

             <Card>
                <CardHeader>
                <CardTitle>Perfil do Administrador</CardTitle>
                <CardDescription>Gerencie as informações da sua conta e empresa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="person avatar" />
                    <AvatarFallback>{companyData.adminName?.[0] || 'A'}</AvatarFallback>
                    </Avatar>
                    <Button variant="outline" disabled={isReadOnly}>Mudar foto</Button>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="adminName">Nome do Admin</Label>
                    <Input id="adminName" value={companyData.adminName} disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={companyData.email} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input id="companyName" value={companyData.companyName} disabled />
                </div>
                </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações da Empresa</CardTitle>
              <CardDescription>
                Essas informações treinarão a IA para alinhar o conteúdo dos colaboradores com a voz da sua marca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" placeholder="Sua tagline ou slogan" value={companyData.tagline} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Público-alvo</Label>
                <Textarea id="audience" placeholder="Descreva seu público-alvo" value={companyData.audience} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de Voz</Label>
                <Textarea id="tone" placeholder="Descreva o tom de voz da marca" value={companyData.tone} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="messages">Mensagens-chave</Label>
                <Textarea id="messages" placeholder="Quais são as mensagens principais que devem ser comunicadas?" value={companyData.messages} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                 <Button onClick={() => handleSaveChanges('branding')} disabled={isSaving || isReadOnly}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações da Empresa
                </Button>
            </CardFooter>
          </Card>

            <Card>
                <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Gerencie como você recebe as notificações.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="new-missions" className={isReadOnly ? 'text-muted-foreground' : ''}>Resgates de Recompensas</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba alertas quando um colaborador resgatar uma recompensa.
                    </p>
                    </div>
                    <Switch id="new-missions" defaultChecked disabled={isReadOnly}/>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="new-trails" className={isReadOnly ? 'text-muted-foreground' : ''}>Novos Colaboradores</Label>
                    <p className="text-sm text-muted-foreground">
                        Seja notificado quando um novo colaborador entrar na plataforma.
                    </p>
                    </div>
                    <Switch id="new-trails" defaultChecked disabled={isReadOnly}/>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="points-available" className={isReadOnly ? 'text-muted-foreground' : ''}>Relatórios Semanais</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba relatórios de engajamento da plataforma.
                    </p>
                    </div>
                    <Switch id="points-available" defaultChecked disabled={isReadOnly}/>
                </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}


export default function AdminConfiguracoesPage() {
    return (
        <Suspense fallback={<SettingsSkeleton />}>
            <ConfiguracoesPageContent />
        </Suspense>
    );
}
