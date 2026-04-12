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
import { User as UserIcon, Loader2, HelpCircle } from "lucide-react";
const SuspenseFallback = () => <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>;
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { LinkedInSidebarBox } from "@/components/dashboard/linkedin-sidebar-box";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionGate } from "@/components/subscription-gate";

function ColaboradorLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, loading, ready, locale, tokenStatus } = useAuthGuard({
        role: 'colaborador',
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
                <ColaboradorSidebarNav />
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
            {/* Block access when company subscription is expired */}
            {subscription.loading ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : subscription.isBlocked ? (
                <SubscriptionGate role="colaborador" plan={subscription.plan} />
            ) : (
                children
            )}
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
