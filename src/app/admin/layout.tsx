'use client';

import type React from "react";
import { Suspense, useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from 'firebase/firestore';
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { User as UserIcon, AlertTriangle, Loader2, ArrowLeft, Shield, HelpCircle, Clock, Palette } from "lucide-react";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { OnboardingShell } from "@/components/onboarding";

const TrialBanner = ({ daysLeft, plan }: { daysLeft: number; plan: string }) => {
    if (plan !== 'trial' || daysLeft > 7) return null;

    const isUrgent = daysLeft <= 3;
    const bgClass = isUrgent ? 'bg-red-100 border-red-200 text-red-800' : 'bg-yellow-100 border-yellow-200 text-yellow-800';
    const btnClass = isUrgent ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500';

    const getMessage = () => {
        if (daysLeft === 0) return 'Seu período de teste expira hoje! Ative sua assinatura agora.';
        if (daysLeft === 1) return 'Seu período de teste expira amanhã! Ative sua assinatura.';
        return `Seu período de teste expira em ${daysLeft} dias. Ative sua assinatura para não perder acesso.`;
    };

    return (
        <div className={`${bgClass} border-b text-sm font-medium text-center p-2.5`}>
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                <span>{getMessage()}</span>
                <Button size="sm" className={`h-7 ${btnClass}`} asChild>
                    <Link href="/admin/configuracoes">Ativar Assinatura</Link>
                </Button>
            </div>
        </div>
    );
};

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, locale, loading, ready, isMasterMode, masterCompanyName } = useAuthGuard({ role: 'admin' });
    const subscription = useSubscription(companyId);
    const router = useRouter();
    const pathname = usePathname();
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>();
    const [companyName, setCompanyName] = useState('');
    const [licensesCount, setLicensesCount] = useState(5);

    useEffect(() => {
        if (!companyId) return;
        getDoc(doc(db, 'companies', companyId)).then(snap => {
            const data = snap.data();
            setCompanyLogoUrl(data?.logoUrl || undefined);
            setCompanyName(data?.companyName || '');
            setLicensesCount(data?.subscription?.totalLicenses || 5);
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
                <AdminSidebarNav />
            </SidebarContent>
            <SidebarFooter>
                <SidebarUserFooter
                    user={user}
                    roleLabel={t.roles.admin}
                    fallbackInitials="AD"
                    avatarOverride={companyLogoUrl}
                    feedbackPage="Sidebar"
                    menuItems={[
                        { href: '/admin/configuracoes', label: t.nav.settings, icon: UserIcon },
                        { href: '/admin/brand-context', label: 'Brand Context', icon: Palette },
                        { href: '/admin/suporte', label: t.nav.support, icon: HelpCircle },
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
                {isMasterMode && (
                  <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-medium">Modo Master — Visualizando: {masterCompanyName}</span>
                    </div>
                    <Link href="/master/empresas">
                      <Button variant="ghost" size="sm" className="text-white hover:bg-purple-700 h-7 text-xs">
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Voltar ao Painel Master
                      </Button>
                    </Link>
                  </div>
                )}
                <TrialBanner daysLeft={subscription.daysLeft} plan={subscription.plan} />
                {/* Block access when subscription is expired — except /admin/configuracoes (billing page) */}
                {subscription.loading ? (
                    <div className="flex items-center justify-center min-h-[60vh]">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : subscription.isBlocked && !isMasterMode && pathname !== '/admin/configuracoes' ? (
                    <SubscriptionGate role="admin" plan={subscription.plan} />
                ) : (
                    <OnboardingShell
                        role="admin"
                        companyName={companyName}
                        licensesCount={licensesCount}
                        trialDays={subscription.daysLeft}
                    >
                        {children}
                    </OnboardingShell>
                )}
            </DashboardLayout>
        </LocaleProvider>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
                <AdminLayoutInner>{children}</AdminLayoutInner>
            </Suspense>
        </AuthProvider>
    );
}
