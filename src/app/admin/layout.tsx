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
import { useRouter, useSearchParams } from "next/navigation";
import { User as UserIcon, Loader2, ArrowLeft, Shield, HelpCircle, Palette, CreditCard } from "lucide-react";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { OnboardingShell } from "@/components/onboarding";
import { BillingWarningBanner } from "@/components/billing/billing-warning-banner";

// NOTA: TrialBanner e SubscriptionGate legados foram removidos.
// O sistema novo de billing (BillingWarningBanner + module-gate.ts server-side)
// cobre os mesmos casos lendo o billing block ao inves do campo subscription
// (que foi deprecated). Bloqueio de modulo agora e gated no server por
// chamada (assertModuleAllowed em module-gate.ts), nao mais no client layout.

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, locale, loading, ready, isMasterMode, masterCompanyName } = useAuthGuard({ role: 'admin' });
    const router = useRouter();
    const searchParams = useSearchParams();
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>();
    const [companyName, setCompanyName] = useState('');
    const [licensesCount, setLicensesCount] = useState(5);

    // Preserva ?companyId= (master) ou ?c= (slug) nos links do footer.
    // Sem isto, master clica em Configuracoes/Billing/etc e perde o contexto
    // da empresa que estava visualizando — useAuthGuard nao acha companyId
    // na URL e redireciona pra /master/empresas.
    const buildAdminHref = (href: string) => {
      const companySlug = searchParams.get('c');
      const urlCompanyId = searchParams.get('companyId');
      if (companySlug) return `${href}?c=${companySlug}`;
      if (urlCompanyId) return `${href}?companyId=${urlCompanyId}`;
      return href;
    };

    useEffect(() => {
        if (!companyId) return;
        getDoc(doc(db, 'companies', companyId)).then(snap => {
            const data = snap.data();
            setCompanyLogoUrl(data?.logoUrl || undefined);
            setCompanyName(data?.companyName || '');
            // Le seats do billing block novo. Fallback no legado (subscription.totalLicenses)
            // permanece para empresas que ainda nao foram migradas.
            const billingSeats = data?.billing?.platform?.seats;
            const legacySeats = data?.subscription?.totalLicenses;
            setLicensesCount(billingSeats || legacySeats || 5);
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
                        { href: buildAdminHref('/admin/configuracoes'), label: t.nav.settings, icon: UserIcon },
                        { href: buildAdminHref('/admin/billing'), label: 'Planos e cobrança', icon: CreditCard },
                        { href: buildAdminHref('/admin/brand-context'), label: 'Brand Context', icon: Palette },
                        { href: buildAdminHref('/admin/suporte'), label: t.nav.support, icon: HelpCircle },
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
                <BillingWarningBanner />
                <OnboardingShell
                    role="admin"
                    companyName={companyName}
                    licensesCount={licensesCount}
                >
                    {children}
                </OnboardingShell>
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
