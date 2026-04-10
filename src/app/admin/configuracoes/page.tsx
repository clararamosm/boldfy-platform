// src/app/admin/configuracoes/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth as firebaseAuth } from "@/lib/firebase";
import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, CreditCard, ExternalLink, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from '@/lib/i18n/context';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';
import { useSubscription } from '@/hooks/use-subscription';

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
// ── Billing Card ───────────────────────────────────────────────

function BillingCard({ companyId }: { companyId: string | undefined }) {
    const sub = useSubscription(companyId);
    const { toast } = useToast();
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);

    const getIdToken = useCallback(async () => {
        const currentUser = firebaseAuth.currentUser;
        if (!currentUser) throw new Error('Not authenticated');
        return currentUser.getIdToken();
    }, []);

    const handleCheckout = async () => {
        setCheckoutLoading(true);
        try {
            const idToken = await getIdToken();
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    seats: sub.totalLicenses || 5,
                    isBeta: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao criar checkout');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Checkout error:', err);
            toast({
                variant: 'destructive',
                title: 'Erro no checkout',
                description: err instanceof Error ? err.message : 'Tente novamente.',
            });
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const idToken = await getIdToken();
            const res = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao abrir portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Portal error:', err);
            toast({
                variant: 'destructive',
                title: 'Erro ao abrir portal',
                description: err instanceof Error ? err.message : 'Tente novamente.',
            });
        } finally {
            setPortalLoading(false);
        }
    };

    if (sub.loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-7 w-48" /></CardTitle>
                    <CardDescription><Skeleton className="h-4 w-full max-w-sm" /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        );
    }

    const hasActiveSubscription = sub.stripeSubscriptionId && sub.status === 'active';
    const isTrial = sub.plan === 'trial';
    const isBlocked = sub.isBlocked;

    const getStatusBadge = () => {
        if (hasActiveSubscription) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Ativa</Badge>;
        if (isTrial && !isBlocked) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="h-3 w-3 mr-1" />Teste gratuito — {sub.daysLeft} dias restantes</Badge>;
        if (isBlocked) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><AlertTriangle className="h-3 w-3 mr-1" />Expirada</Badge>;
        return <Badge variant="outline">{sub.status}</Badge>;
    };

    return (
        <Card className={isBlocked ? 'border-red-300 bg-red-50/30' : ''}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Assinatura e Cobrança
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Gerencie seu plano e método de pagamento.
                        </CardDescription>
                    </div>
                    {getStatusBadge()}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Plan info */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Plano</p>
                        <p className="text-lg font-semibold">
                            {hasActiveSubscription ? `Beta — ${sub.tier}` : isTrial ? 'Teste Gratuito' : 'Sem assinatura'}
                        </p>
                    </div>
                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Licenças</p>
                        <p className="text-lg font-semibold">{sub.totalLicenses || '—'}</p>
                    </div>
                </div>

                {/* Trial info */}
                {isTrial && !isBlocked && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-900">
                                    Período de teste ativo
                                </p>
                                <p className="text-sm text-blue-700 mt-1">
                                    Você tem {sub.daysLeft} dias restantes no período gratuito. Ative sua assinatura para garantir acesso contínuo com preço beta (30% de desconto por 5 meses).
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Blocked warning */}
                {isBlocked && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-red-900">
                                    Acesso bloqueado
                                </p>
                                <p className="text-sm text-red-700 mt-1">
                                    Seu período de teste expirou. Ative sua assinatura abaixo para restaurar o acesso de toda a equipe.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4 flex gap-3">
                {hasActiveSubscription ? (
                    <Button onClick={handleManageBilling} disabled={portalLoading}>
                        {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Gerenciar Assinatura
                    </Button>
                ) : (
                    <Button onClick={handleCheckout} disabled={checkoutLoading} className="bg-purple-600 hover:bg-purple-700">
                        {checkoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <CreditCard className="h-4 w-4 mr-2" />
                        Ativar Assinatura
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

function ConfiguracoesPageContent() {
    const t = useT();
    const { toast } = useToast();
    const { user } = useAuth();
    const { company, isLoading: companyLoading } = useCompanyData(user?.companyId);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);

    // Hydrate local form state from company doc
    useEffect(() => {
        if (companyLoading || !company) {
            if (!companyLoading) setIsLoading(false);
            return;
        }
        const bc = company.brandContext || {} as NonNullable<typeof company.brandContext>;
        const arrToStr = (v: string[] | string | undefined) => Array.isArray(v) ? v.join(', ') : (v || '');
        setCompanyData({
            id: company.id,
            adminName: company.adminProfile?.name || '',
            companyName: company.companyName || '',
            email: company.adminProfile?.email || '',
            adminPhotoURL: company.adminPhotoURL,
            valueProposition: bc.valueProposition || '',
            tagline: bc.tagline || '',
            businessKeywords: arrToStr(bc.businessKeywords),
            solutions: arrToStr(bc.solutions),
            targetPainPoints: arrToStr(bc.targetPainPoints),
            targetAudience: bc.targetAudience || '',
            approvedTopics: arrToStr(bc.approvedTopics),
            prohibitedPhrases: arrToStr(bc.prohibitedPhrases),
            status: company.status || 'Trial',
            licenses: company.licenses || 5,
            trialEndsAt: company.trialEndsAt,
        });
        setIsLoading(false);
    }, [company, companyLoading]);

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
            toast({ title: t.adminSettings.toastPhotoUpdated, description: t.adminSettings.toastPhotoUpdatedDescription });
        } catch (error) {
            console.error("Error uploading photo: ", error);
            toast({ variant: "destructive", title: t.adminSettings.toastPhotoError, description: t.adminSettings.toastPhotoErrorDescription });
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
            toast({ title: t.adminSettings.toastBrandSaved, description: t.adminSettings.toastBrandSavedDescription });
        } catch (error) {
            console.error("Error saving settings: ", error);
            toast({ variant: 'destructive', title: t.adminSettings.toastBrandError, description: t.adminSettings.toastBrandErrorDescription });
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

    const isReadOnly = companyData?.status === 'Inativa';

    if (isLoading || !companyData) {
        return <SettingsSkeleton />;
    }
    return (
        <>
            <Header title={t.adminSettings.title} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-6 max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.adminSettings.profileTitle}</CardTitle>
                            <CardDescription>{t.adminSettings.profileDescription}</CardDescription>
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
                                    {isUploadingPhoto ? t.common.uploading : t.common.changePhoto}
                                </Button>
                            </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adminName">{t.adminSettings.adminName}</Label>
                                <Input id="adminName" value={companyData.adminName} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={companyData.email} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">{t.adminSettings.companyName}</Label>
                                <Input id="companyName" value={companyData.companyName} disabled />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billing / Subscription card */}
                    <BillingCard companyId={companyData.id} />

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.adminSettings.brandContextTitle}</CardTitle>
                            <CardDescription>{t.adminSettings.brandContextDescription}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="valueProposition">{t.adminSettings.valueProposition}</Label>
                                <Textarea id="valueProposition" placeholder={t.adminSettings.valuePropositionPlaceholder} value={companyData.valueProposition} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tagline">{t.adminSettings.tagline}</Label>
                                <Input id="tagline" placeholder={t.adminSettings.taglinePlaceholder} value={companyData.tagline} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessKeywords">{t.adminSettings.businessKeywords}</Label>
                                <Textarea id="businessKeywords" placeholder={t.adminSettings.businessKeywordsPlaceholder} value={companyData.businessKeywords} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">{t.adminSettings.businessKeywordsHelp}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="solutions">{t.adminSettings.solutions}</Label>
                                <Textarea id="solutions" placeholder={t.adminSettings.solutionsPlaceholder} value={companyData.solutions} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">{t.adminSettings.solutionsHelp}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="targetPainPoints">{t.adminSettings.targetPainPoints}</Label>
                                <Textarea id="targetPainPoints" placeholder={t.adminSettings.targetPainPointsPlaceholder} value={companyData.targetPainPoints} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">{t.adminSettings.targetPainPointsHelp}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="targetAudience">{t.adminSettings.targetAudience}</Label>
                                <Textarea id="targetAudience" placeholder={t.adminSettings.targetAudiencePlaceholder} value={companyData.targetAudience} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="approvedTopics">{t.adminSettings.approvedTopics}</Label>
                                <Textarea id="approvedTopics" placeholder={t.adminSettings.approvedTopicsPlaceholder} value={companyData.approvedTopics} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">{t.adminSettings.approvedTopicsHelp}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prohibitedPhrases">{t.adminSettings.prohibitedPhrases}</Label>
                                <Textarea id="prohibitedPhrases" placeholder={t.adminSettings.prohibitedPhrasesPlaceholder} value={companyData.prohibitedPhrases} onChange={handleInputChange} disabled={isSaving || isReadOnly} />
                                <p className="text-xs text-muted-foreground">{t.adminSettings.prohibitedPhrasesHelp}</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button onClick={() => handleSaveChanges('brandContext')} disabled={isSaving || isReadOnly}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t.adminSettings.saveBrandContext}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t.adminSettings.notificationsTitle}</CardTitle>
                            <CardDescription>{t.adminSettings.notificationsDescription}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="new-missions" className={isReadOnly ? 'text-muted-foreground' : ''}>{t.adminSettings.notifRewards}</Label>
                                    <p className="text-sm text-muted-foreground">{t.adminSettings.notifRewardsDescription}</p>
                                </div>
                                <Switch id="new-missions" defaultChecked disabled={isReadOnly}/>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="new-trails" className={isReadOnly ? 'text-muted-foreground' : ''}>{t.adminSettings.notifNewCollaborators}</Label>
                                    <p className="text-sm text-muted-foreground">{t.adminSettings.notifNewCollaboratorsDescription}</p>
                                </div>
                                <Switch id="new-trails" defaultChecked disabled={isReadOnly}/>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="points-available" className={isReadOnly ? 'text-muted-foreground' : ''}>{t.adminSettings.notifWeeklyReports}</Label>
                                    <p className="text-sm text-muted-foreground">{t.adminSettings.notifWeeklyReportsDescription}</p>
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
                            {t.common.privacyPolicy}
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
