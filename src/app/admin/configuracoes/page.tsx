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

import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, CreditCard, ExternalLink, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from '@/lib/i18n/context';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { useSubscription } from '@/hooks/use-subscription';
import { NotificationSettings } from '@/components/notification-settings';

const ADMIN_NOTIF_OPTIONS = [
  { key: 'mission_submitted', label: 'Comprovações de missão', description: 'Receber quando um colaborador enviar uma comprovação de missão.' },
  { key: 'reward_redeemed', label: 'Resgates de recompensa', description: 'Receber quando um colaborador resgatar uma recompensa.' },
];

type CompanyData = {
    id: string;
    adminName: string;
    companyName: string;
    email: string;
    adminPhotoURL?: string;
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

function ConfiguracoesPageContent() {
    const t = useT();
    const { toast } = useToast();
    const { user } = useAuth();
    const companyId = useResolvedCompanyId();
    const { company, isLoading: companyLoading } = useCompanyData(companyId);

    const [isLoading, setIsLoading] = useState(true);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);

    // Hydrate local form state from company doc
    useEffect(() => {
        if (companyLoading || !company) {
            if (!companyLoading) setIsLoading(false);
            return;
        }
        setCompanyData({
            id: company.id,
            adminName: company.adminProfile?.name || '',
            companyName: company.companyName || '',
            email: company.adminProfile?.email || '',
            adminPhotoURL: company.adminPhotoURL,
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

                    <NotificationSettings options={ADMIN_NOTIF_OPTIONS} disabled={isReadOnly} />

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
