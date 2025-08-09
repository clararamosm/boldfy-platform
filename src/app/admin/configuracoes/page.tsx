// src/app/admin/configuracoes/page.tsx
'use client';

import { useState, useEffect, useCallback, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { createCheckoutSession } from "@/app/actions";
import { getStripe } from "@/lib/stripe-client";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

type CompanyData = {
    id: string;
    adminName: string;
    companyName: string;
    email: string;
    tagline: string;
    audience: string;
    tone: string;
    messages: string;
    status: 'Ativa' | 'Inativa' | 'pending_payment';
    licenses: number;
};

function ActivationForm({ companyData }: { companyData: CompanyData }) {
    const { pending } = useFormStatus();
    
    if (!companyData) return null;

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
                    "Ativar Conta e Gerenciar Assinatura"
                )}
             </Button>
        </div>
    )
}


export default function AdminConfiguracoesPage() {
    const { toast } = useToast();
    const [language, setLanguage] = useState("pt-br");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [checkoutState, formAction] = useActionState(createCheckoutSession, { error: undefined, sessionId: undefined });
    const searchParams = useSearchParams();

     // Listen to auth state changes to get the current user ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            setCurrentUserId(user.uid);
        } else {
            // Handle user not logged in, maybe redirect
            setCurrentUserId(null);
        }
        });
        return () => unsubscribe();
    }, []);

    // Handle toast notifications for payment status
    useEffect(() => {
        if (searchParams.get('payment_success')) {
            toast({
                title: 'Pagamento Concluído!',
                description: 'Sua conta foi ativada. Bem-vindo(a) à Boldfy!',
            });
            // You might want to refetch data here to update the UI instantly
        }
        if (searchParams.get('payment_canceled')) {
             toast({
                variant: 'destructive',
                title: 'Pagamento Cancelado',
                description: 'O processo de ativação foi cancelado. Você pode tentar novamente a qualquer momento.',
            });
        }
    }, [searchParams, toast]);

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

    const fetchData = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            // First, get the companyId from the user's document
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
                    licenses: data.licenses || 0
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

    useEffect(() => {
        if(currentUserId) {
            fetchData(currentUserId);
        }
    }, [currentUserId, fetchData]);
    
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

    const handleSaveLanguage = () => {
        toast({
            title: "Idioma salvo!",
            description: `O idioma foi alterado para ${language === 'pt-br' ? 'Português (Brasil)' : 'English (United States)'}.`,
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        if (companyData) {
            setCompanyData(prev => ({ ...prev!, [id]: value }));
        }
    };

    if (isLoading || !companyData) {
        return (
             <>
                <Header title="Configurações" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <div className="grid gap-6 max-w-4xl mx-auto">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-7 w-48" />
                                <Skeleton className="h-4 w-full max-w-sm" />
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
                    </div>
                </main>
            </>
        )
    }

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
            
            {companyData.status !== 'Ativa' && (
                 <Card className="border-primary bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="text-primary"/>Sua Conta Precisa de Ativação</CardTitle>
                        <CardDescription>
                            Para desbloquear todas as funcionalidades da plataforma, como convidar colaboradores e criar missões, é necessário ativar sua assinatura.
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
                    <Button variant="outline">Mudar foto</Button>
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
                <Input id="tagline" placeholder="Sua tagline ou slogan" value={companyData.tagline} onChange={handleInputChange} disabled={isSaving || companyData.status !== 'Ativa'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Público-alvo</Label>
                <Textarea id="audience" placeholder="Descreva seu público-alvo" value={companyData.audience} onChange={handleInputChange} disabled={isSaving || companyData.status !== 'Ativa'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de Voz</Label>
                <Textarea id="tone" placeholder="Descreva o tom de voz da marca" value={companyData.tone} onChange={handleInputChange} disabled={isSaving || companyData.status !== 'Ativa'} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="messages">Mensagens-chave</Label>
                <Textarea id="messages" placeholder="Quais são as mensagens principais que devem ser comunicadas?" value={companyData.messages} onChange={handleInputChange} disabled={isSaving || companyData.status !== 'Ativa'} />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                 <Button onClick={() => handleSaveChanges('branding')} disabled={isSaving || companyData.status !== 'Ativa'}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações da Empresa
                </Button>
            </CardFooter>
          </Card>

            <Card>
                <CardHeader>
                <CardTitle>Idioma</CardTitle>
                <CardDescription>Escolha o idioma de exibição do sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={language} onValueChange={setLanguage} disabled={companyData.status !== 'Ativa'}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                        <SelectItem value="en-us">English (United States)</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSaveLanguage} disabled={companyData.status !== 'Ativa'}>Salvar Idioma</Button>
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
                    <Label htmlFor="new-missions" className={companyData.status !== 'Ativa' ? 'text-muted-foreground' : ''}>Resgates de Recompensas</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba alertas quando um colaborador resgatar uma recompensa.
                    </p>
                    </div>
                    <Switch id="new-missions" defaultChecked disabled={companyData.status !== 'Ativa'}/>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="new-trails" className={companyData.status !== 'Ativa' ? 'text-muted-foreground' : ''}>Novos Colaboradores</Label>
                    <p className="text-sm text-muted-foreground">
                        Seja notificado quando um novo colaborador entrar na plataforma.
                    </p>
                    </div>
                    <Switch id="new-trails" defaultChecked disabled={companyData.status !== 'Ativa'}/>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="points-available" className={companyData.status !== 'Ativa' ? 'text-muted-foreground' : ''}>Relatórios Semanais</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba relatórios de engajamento da plataforma.
                    </p>
                    </div>
                    <Switch id="points-available" defaultChecked disabled={companyData.status !== 'Ativa'}/>
                </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}
