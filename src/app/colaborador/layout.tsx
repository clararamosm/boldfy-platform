'use client';

import type React from "react";
import { Suspense, useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from 'firebase/firestore';
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { ColaboradorSidebarNav } from "@/components/dashboard/colaborador-sidebar-nav";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { User as UserIcon, Loader2, HelpCircle, Sparkles } from "lucide-react";
const SuspenseFallback = () => <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>;
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { LinkedInSidebarBox } from "@/components/dashboard/linkedin-sidebar-box";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { OnboardingShell } from "@/components/onboarding";
import { BillingWarningBanner } from "@/components/billing/billing-warning-banner";
import { GamificationToastProvider } from "@/components/gamification/points-toast";

// NOTA: useSubscription e SubscriptionGate legados foram removidos.
// O sistema novo de billing (BillingWarningBanner + module-gate.ts server-side)
// cobre os mesmos casos lendo o billing block ao inves do campo subscription
// (que foi deprecated). Bloqueio de modulo agora e gated no server por
// chamada (assertModuleAllowed em module-gate.ts), nao mais no client layout.

function ColaboradorLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, loading, ready, locale, tokenStatus } = useAuthGuard({
        role: 'colaborador',
        checkLinkedInToken: true,
    });
    const router = useRouter();
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>();
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        if (!companyId) return;
        getDoc(doc(db, 'companies', companyId)).then(snap => {
            const data = snap.data();
            setCompanyLogoUrl(data?.logoUrl || undefined);
            setCompanyName(data?.companyName || '');
        }).catch(() => {});
    }, [companyId]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    if (loading || !ready || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastUploadMonth = (user as { linkedinSnapshotStatus?: { lastUploadMonth?: string } }).linkedinSnapshotStatus?.lastUploadMonth;
    const uploadPending = !lastUploadMonth || lastUploadMonth < currentMonth;

    const sidebarContent = (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2 group-data-[state=collapsed]:justify-center">
                    <Logo />
                    <span className="font-headline text-xl font-bold text-foreground overflow-hidden transition-[max-width,opacity] duration-150 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:max-w-0">Boldfy</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <ColaboradorSidebarNav uploadPending={uploadPending} />
            </SidebarContent>
            <SidebarFooter>
                <LinkedInSidebarBox tokenStatus={tokenStatus} />
                <SidebarUserFooter
                    user={user}
                    roleLabel={t.roles.collaborator}
                    fallbackInitials="CO"
                    avatarOverride={companyLogoUrl}
                    feedbackPage="Sidebar"
                    menuItems={[
                        // Manual de Marca Pessoal migrou pro menu principal do sidebar (item de topo).
                        { href: '/colaborador/configuracoes', label: t.nav.settings, icon: UserIcon },
                        { href: '/colaborador/suporte', label: t.nav.support, icon: HelpCircle },
                    ]}
                    onLogout={handleLogout}
                    logoutLabel={t.nav.signOut}
                />
            </SidebarFooter>
        </>
    );

    return (
        <LocaleProvider locale={locale}>
        <DashboardLayout sidebar={sidebarContent}>
            <BillingWarningBanner />
            <GamificationToastProvider />
            <OnboardingShell role="colaborador" companyName={companyName}>
                {children}
            </OnboardingShell>
        </DashboardLayout>
        </LocaleProvider>
    );
}

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <Suspense fallback={<SuspenseFallback />}>
                <ColaboradorLayoutInner>{children}</ColaboradorLayoutInner>
            </Suspense>
        </AuthProvider>
    );
}
