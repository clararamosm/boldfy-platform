// src/app/admin/configuracoes/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getStripe } from "@/lib/stripe-client";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";

type CompanyData = {
    id: string;
    adminName: string;
    companyName: string;
    email: string;
    adminPhotoURL?: string;
    // Brand Context corporativo (8 campos)
    valueProposition: string;
    tagline: string;
    businessKeywords: string;
    solutions: string;
    targetPainPoints: string;
    targetAudience: string;
    approvedTopics: string;
    prohibitedPhrases: string;
    status: 'Ativa' | 'Inativa' | 'Trial' | 'pending_payment';
    licenses: number;
    trialEndsAt?: string;
};

function ActivationButton({ companyData, onClick, isPending }: { companyData: CompanyData, onClick: () => void, isPending: boolean }) {
    if (!companyData) return null;
    const isTrial = companyData.status === 'Trial';
    return (
        <Button onClick={onClick} className="w-full sm:w-auto" disabled={isPending}>
            {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecionando...</>
            ) : (
                isTrial ? "Iniciar Assinatura com 30 Dias Grátis" : "Ativar Assinatura"
            )}
        </Button>
    )
}

const SettingsSkeleton = () => (
    <>
        <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="grid gap-6 max-w-4xl mx-auto">
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
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const searchParams = useSearchParams();

    const fetchData = useCallback(async (companyId: string) => {
        try {
            const companyDocRef = doc(db, "companies", companyId);
            const companyDocSnap = await getDoc(companyDocRef);

            if (companyDocSnap.exists()) {
                const data = companyDocSnap.data();
                const bc = data.brandContext || data.branding || {};
                setCompanyData({
                    id: companyDocSnap.id,
                    adminName: data.adminProfile?.name || '',
                    companyName: data.companyName || '',
                    email: data.adminProfile?.email || '',
                    valueProposition: bc.valueProposition || '',
                    tagline: bc.tagline || '',
                    businessKeywords: Array.isArray(bc.businessKeywords) ? bc.businessKeywords.join(', ') : (bc.businessKeywords || ''),
                    solutions: Array.isArray(bc.solutions) ? bc.solutions.join(', ') : (bc.solutions || ''),
                    targetPainPoints: Array.isArray(bc.targetPainPoints) ? bc.targetPainPoints.join(', ') : (bc.targetPainPoints || ''),
                    targetAudience: bc.targetAudience || bc.audience || '',
                    approvedTopics: Array.isArray(bc.approvedTopics) ? bc.approvedTopics.join(', ') : (bc.approvedTopics || ''),
                    prohibitedPhrases: Array.isArray(bc.prohibitedPhrases) ? bc.prohibitedPhrases.join(', ') : (bc.prohibitedPhrases || ''),
                    status: data.status || 'Trial',
                    licenses: data.licenses || 5,
                    trialEndsAt: data.trialEndsAt
                });
            } else {
                toast({ variant: 'destructive', title: "Erro ao carregar empresa", description: "Os dados da sua empresa não foram encontrados." });
            }
        } catch (error) {
            console.error("Error fetching settings: ", error);
            toast({ variant: 'destructive', title: "Erro ao carregar configurações", description: "Não foi possível buscar os dados. Tente novamente mais tarde." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                if (userDocSnap.exists()) {
                    const companyId = userDocSnap.data().companyId;
                    if (companyId) {
                        fetchData(companyId);
                    } else {
                        toast({ variant: 'destructive', title: "ID da empresa não encontrado no perfil do usuário." });
                        setIsLoading(false);
                    }
                } else {
                    toast({ variant: 'destructive', title: "Usuário não encontrado." });
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchData, toast]);

    useEffect(() => {
        if (searchParams.get('payment_success') && companyData) {
            toast({ title: 'Assinatura Iniciada!', description: 'Seu período de teste começou. Bem-vindo(a) à Boldfy!' });
        }
        if (searchParams.get('payment_canceled')) {
            toast({ variant: 'destructive', title: 'Processo Cancelado', description: 'O processo de assinatura foi cancelado.' });
        }
    }, [searchParams, toast, companyData]);
    const handleCheckout = async () => {
        if (!companyData) return;
        setIsCheckingOut(true);
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyData })
            });
            const { sessionId, error } = await response.json();
            if (error) throw new Error(error);
            if (sessionId) {
                const stripe = await getStripe();
                if (!stripe) { toast({ variant: 'destructive', title: 'Erro', description: 'Stripe.js não foi carregado.' }); return; }
                await stripe.redirectToCheckout({ sessionId });
            }
        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            toast({ variant: 'destructive', title: 'Erro no Checkout', description: errorMessage });
            setIsCheckingOut(false);
        }
    }


    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyData) return;
        setIsUploadingPhoto(true);
        try {
            const fileRef = storageRef(storage, `companies/${companyData.id}/admin-photo`);
            await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(fileRef);
            const companyDocRef = doc(db, "companies", companyData.id);
            await setDoc(companyDocRef, { adminPhotoURL: downloadURL }, { merge: true });
            setCompanyData(prev => prev ? { ...prev, adminPhotoURL: downloadURL } : prev);
            toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi salva com sucesso." });
        } catch (error) {
            console.error("Error uploading photo: ", error);
            toast({ variant: "destructive", title: "Erro no upload", description: "N\u00e3o foi poss\u00edvel atualizar a foto." });
        } finally {
            setIsUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    const splitToArray = (text: string): string[] =>
        text.split(',').map(s => s.trim()).filter(Boolean);

    const handleSaveChanges = async (section: 'brandContext') => {
        if (!companyData) return;
        setIsSaving(true);
        try {
            const companyDocRef = doc(db, "companies", companyData.id);
            let dataToSave = {};
            if (section === 'brandContext') {
                dataToSave = {
                    brandContext: {
                        valueProposition: companyData.valueProposition,
                        tagline: companyData.tagline,
                        businessKeywords: splitToArray(companyData.businessKeywords),
                        solutions: splitToArray(companyData.solutions),
                        targetPainPoints: splitToArray(companyData.targetPainPoints),
                        targetAudience: companyData.targetAudience,
                        approvedTopics: splitToArray(companyData.approvedTopics),
                        prohibitedPhrases: splitToArray(companyData.prohibitedPhrases),
                    }
                };
            }
            await setDoc(companyDocRef, dataToSave, { merge: true });
            toast({ title: "Sucesso!", description: "O Brand Context da empresa foi salvo." });
        } catch (error) {
            console.error("Error saving settings: ", error);
            toast({ variant: 'destructive', title: "Erro ao salvar", description: "Não foi possível salvar as alterações." });
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
                                        ? 'Você está em um período de teste gratuito. Para garantir que não haja interrupção no serviço, inicie sua assinatura agora.'
                                        : 'Para desbloquear todas as funcionalidades da plataforma, é necessário ativar sua assinatura.'
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ActivationButton companyData={companyData} onClick={handleCheckout} isPending={isCheckingOut} />
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
                            <div className="relative">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={companyData.adminPhotoURL || ""} />
                                    <AvatarFallback className="text-2xl">{companyData.adminName?.[0] || 'A'}</AvatarFallback>
                                </Avatar>
                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handlePhotoUpload}
                                />
                                <Button
                                    variant="outline"
                                    disabled={isReadOnly || isUploadingPhoto}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="h-4 w-4 mr-2" />
                                    {isUploadingPhoto ? "Enviando..." : "Mudar foto"}
                                </Button>
                            </div>
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
                            <CardTitle>Brand Context da Empresa</CardTitle>
                            <CardDescription>Essas informações alimentam a IA para alinhar o conteúdo dos colaboradores com a marca. A IA tece a marca de forma orgânica na narrativa pessoal de cada autor.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="valueProposition">Proposta de Valor</Label>
                                <Textarea id="valueProposition" placeholder="O que a empresa entrega de único para o mercado?" value={companyData.valueProposition} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tagline">Tagline</Label>
                                <Input id="tagline" placeholder="Frase-síntese da marca (ex: 'Gamificação que transforma colaboradores em embaixadores')" value={companyData.tagline} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessKeywords">Keywords de Negócio</Label>
                                <Textarea id="businessKeywords" placeholder="Termos do nicho da empresa, separados por vírgula (ex: employee advocacy, gamificação, marca empregadora)" value={companyData.businessKeywords} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">Separe por vírgula. A IA usa esses termos naturalmente nos textos.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="solutions">Soluções que a Empresa Oferece</Label>
                                <Textarea id="solutions" placeholder="O que a empresa vende ou faz, separado por vírgula (ex: plataforma de advocacy, trilhas de capacitação, assistente IA)" value={companyData.solutions} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="targetPainPoints">Dores do Público-alvo</Label>
                                <Textarea id="targetPainPoints" placeholder="Problemas que seu público enfrenta, separados por vírgula (ex: baixo engajamento no LinkedIn, colaboradores não postam, marca sem presença)" value={companyData.targetPainPoints} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">Separe por vírgula. A IA usa isso para gerar identificação no leitor.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="targetAudience">Público-alvo</Label>
                                <Textarea id="targetAudience" placeholder="Quem a empresa atende (ex: líderes de RH e marketing de empresas B2B com 50+ colaboradores)" value={companyData.targetAudience} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="approvedTopics">Tópicos Aprovados</Label>
                                <Textarea id="approvedTopics" placeholder="Temas que os colaboradores devem abordar, separados por vírgula (ex: employee advocacy, cultura organizacional, liderança)" value={companyData.approvedTopics} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">Separe por vírgula. O conteúdo gerado girará em torno desses temas.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prohibitedPhrases">Frases / Tópicos Proibidos</Label>
                                <Textarea id="prohibitedPhrases" placeholder="O que NUNCA deve aparecer no conteúdo, separado por vírgula (ex: nome de concorrente X, preços, termos técnicos internos)" value={companyData.prohibitedPhrases} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button onClick={() => handleSaveChanges('brandContext')} disabled={isSaving || isReadOnly}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Brand Context
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
                                    <p className="text-sm text-muted-foreground">Receba alertas quando um colaborador resgatar uma recompensa.</p>
                                </div>
                                <Switch id="new-missions" defaultChecked disabled={isReadOnly}/>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="new-trails" className={isReadOnly ? 'text-muted-foreground' : ''}>Novos Colaboradores</Label>
                                    <p className="text-sm text-muted-foreground">Seja notificado quando um novo colaborador entrar na plataforma.</p>
                                </div>
                                <Switch id="new-trails" defaultChecked disabled={isReadOnly}/>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="points-available" className={isReadOnly ? 'text-muted-foreground' : ''}>Relatórios Semanais</Label>
                                    <p className="text-sm text-muted-foreground">Receba relatórios de engajamento da plataforma.</p>
                                </div>
                                <Switch id="points-available" defaultChecked disabled={isReadOnly}/>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Privacy policy link */}
                    <div className="text-center py-4">
                        <a
                            href="/privacidade"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                        >
                            Política de Privacidade
                        </a>
                    </div>
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
