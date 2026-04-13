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
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { LinkedInSidebarBox } from "@/components/dashboard/linkedin-sidebar-box";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { OnboardingShell } from "@/components/onboarding";

function ThoughtLeaderLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, loading, ready, locale, tokenStatus } = useAuthGuard({
        role: 'thoughtleader',
        checkLinkedInToken: true,
    });
    const subscription = useSubscription(companyId);
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

    const sidebarContent = (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2 has-[[data-state=collapsed]]:-ml-1 has-[[data-state=collapsed]]:justify-center">
                    <Logo />
                    <span className="font-headline text-xl font-bold text-foreground group-data-[state=collapsed]:hidden">Boldfy</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <ThoughtLeaderSidebarNav />
            </SidebarContent>
            <SidebarFooter>
                <LinkedInSidebarBox tokenStatus={tokenStatus} />
                <SidebarUserFooter
                    user={user}
                    roleLabel={t.roles.thoughtLeader}
                    fallbackInitials="TL"
                    avatarOverride={companyLogoUrl}
                    feedbackPage="TL Sidebar"
                    onLogout={handleLogout}
                    logoutLabel={t.nav.signOut}
                />
            </SidebarFooter>
        </>
    );

    return (
        <LocaleProvider locale={locale}>
        <DashboardLayout sidebar={sidebarContent}>
            {subscription.loading ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : subscription.isBlocked ? (
                <SubscriptionGate role="colaborador" plan={subscription.plan} />
            ) : (
                <OnboardingShell role="thoughtleader">
                    {children}
                </OnboardingShell>
            )}
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
