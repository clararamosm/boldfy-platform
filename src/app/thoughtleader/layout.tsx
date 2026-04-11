'use client';

import type React from "react";
import { Suspense } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { ThoughtLeaderSidebarNav } from "@/components/dashboard/thoughtleader-sidebar-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LogOut, Loader2, AlertTriangle, Linkedin } from "lucide-react";
import { AuthProvider } from "@/contexts/auth-context";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { LocaleProvider, useT } from "@/lib/i18n/context";
import { interpolate } from "@/lib/i18n/interpolate";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionGate } from "@/components/subscription-gate";

function ThoughtLeaderLayoutInner({ children }: { children: React.ReactNode }) {
    const t = useT();
    const { user, companyId, loading, ready, locale, tokenStatus } = useAuthGuard({
        role: 'thoughtleader',
        checkLinkedInToken: true,
    });
    const subscription = useSubscription(companyId);
    const router = useRouter();

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
                <div className="flex items-center w-full gap-1 px-1">
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex-1 justify-start gap-2 px-2 py-3 h-auto min-w-0">
                            <Avatar className="h-9 w-9 shrink-0">
                                {user.profile?.avatarUrl && (
                                    <AvatarImage src={user.profile.avatarUrl} alt={user.name || ''} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {user.name?.substring(0, 2).toUpperCase() || 'TL'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start group-data-[state=collapsed]:hidden overflow-hidden">
                                <span className="text-sm font-medium truncate max-w-[130px]">{(user.name || '').split(' ')[0]}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[130px]">{t.roles.thoughtLeader}</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <div className="shrink-0 group-data-[state=collapsed]:hidden">
                        <FeedbackDialog pagina="TL Sidebar" />
                    </div>
                    <DropdownMenuContent align="end" side="top" className="min-w-56 max-w-72">
                        <DropdownMenuLabel>
                            <div className="flex flex-col gap-0.5">
                                <span className="truncate">{user.name || ''}</span>
                                <p className="text-[11px] leading-none text-muted-foreground truncate">
                                    {user.email || ''}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            {t.nav.signOut}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </SidebarFooter>
        </>
    );

    return (
        <LocaleProvider locale={locale}>
        <DashboardLayout sidebar={sidebarContent}>
            {tokenStatus.status === 'expired' && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between dark:bg-red-950/30 dark:border-red-900">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">{t.tlLayout.tokenExpired}</span>
                    </div>
                    <Link href="/thoughtleader/dashboard" className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline whitespace-nowrap flex items-center gap-1">
                        <Linkedin className="h-3.5 w-3.5" /> {t.tlLayout.reconnect}
                    </Link>
                </div>
            )}
            {tokenStatus.status === 'expiring_soon' && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-900">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">
                            {interpolate(t.tlLayout.tokenExpiring, { days: tokenStatus.daysLeft })}
                        </span>
                    </div>
                    <Link href="/thoughtleader/dashboard" className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap flex items-center gap-1">
                        <Linkedin className="h-3.5 w-3.5" /> {t.tlLayout.reconnect}
                    </Link>
                </div>
            )}
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

export default function ThoughtLeaderLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
                <ThoughtLeaderLayoutInner>{children}</ThoughtLeaderLayoutInner>
            </Suspense>
        </AuthProvider>
    );
}
