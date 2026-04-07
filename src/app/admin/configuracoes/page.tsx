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
import { Loader2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { onAuthStateChanged, User } from "firebase/auth";
import { getAuthToken } from "@/lib/auth-client";
import { useT } from '@/lib/i18n/context';

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
function ConfiguracoesPageContent() {
    const t = useT();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
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
                toast({ variant: 'destructive', title: t.adminSettings.toastLoadCompanyError, description: t.adminSettings.toastLoadCompanyErrorDescription });
            }
        } catch (error) {
            console.error("Error fetching settings: ", error);
            toast({ variant: 'destructive', title: t.adminSettings.toastLoadError, description: t.adminSettings.toastLoadErrorDescription });
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
