'use client';

import type React from "react";
import { Suspense, useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from 'firebase/firestore';
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { ThoughtLeaderSidebarNav } from "@/components/dashboard/thoughtleader-sidebar-nav";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Loader2, Settings } from "lucide-react";
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { LinkedInSidebarBox } from "@/components/dashboard/linkedin-sidebar-box";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { OnboardingShell } from "@/components/onboarding";
import { BillingWarningBanner } from "@/components/billing/billing-warning-banner";

// NOTA: useSubscription e SubscriptionGate legados foram removidos.
// O sistema novo de billing (BillingWarningBanner + module-gate.ts server-side)
// cobre os mesmos casos lendo o billing block ao inves do campo subscription
// (que foi deprecated). Bloqueio de modulo agora e gated no server por
// chamada (assertModuleAllowed em module-gate.ts), nao mais no client layout.

function ThoughtLeaderLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, loading, ready, locale, tokenStatus } = useAuthGuard({
        role: 'thoughtleader',
        checkLinkedInToken: true,
    });
    const router = useRouter();
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>();

    useEffect(() => {
        if (!companyId) return;
        getDoc(doc(db, 'companies', companyId)).then(snap => {
            setCompanyLogoUrl(snap.data()?.logoUrl || undefined);
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

    // Calcular se o TL tem upload pendente do mês atual
    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastUploadMonth = (user as { linkedinSnapshotStatus?: { lastUploadMonth?: string } }).linkedinSnapshotStatus?.lastUploadMonth;
    const uploadPending = !lastUploadMonth || lastUploadMonth < currentMonth;

    const sidebarContent = (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2 has-[[data-state=collapsed]]:-ml-1 has-[[data-state=collapsed]]:justify-center">
                    <Logo />
                    <span className="font-headline text-xl font-bold text-foreground group-data-[state=collapsed]:hidden">Boldfy</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <ThoughtLeaderSidebarNav uploadPending={uploadPending} />
            </SidebarContent>
            <SidebarFooter>
                <LinkedInSidebarBox tokenStatus={tokenStatus} />
                <SidebarUserFooter
                    user={user}
                    roleLabel={t.roles.thoughtLeader}
                    fallbackInitials="TL"
                    avatarOverride={companyLogoUrl}
                    feedbackPage="TL Sidebar"
                    menuItems={[
                        { href: '/thoughtleader/configuracoes', label: t.nav.settings, icon: Settings },
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
            <OnboardingShell role="thoughtleader">
                {children}
            </OnboardingShell>
        </DashboardLayout>
        </LocaleProvider>
    );
}

export default function ThoughtLeaderLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
                <ThoughtLeaderLayoutInner>{children}</ThoughtLeaderLayoutInner>
            </Suspense>
        </AuthProvider>
    );
}
