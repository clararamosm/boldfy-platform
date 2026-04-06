'use client';

import type React from "react";
import { useState, useEffect, Suspense } from 'react';
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, AlertTriangle, Loader2, ArrowLeft, Shield, HelpCircle } from "lucide-react";
import { differenceInDays, parseISO } from 'date-fns';
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { FeedbackDialog } from "@/components/feedback-dialog";

type CompanyStatus = 'Ativa' | 'Inativa' | 'Trial';

type CompanyData = {
    status: CompanyStatus;
    trialEndDate?: string;
    plan?: string;
};

const TrialNotification = ({ companyId }: { companyId: string | undefined }) => {
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);

    useEffect(() => {
        if (!companyId) return;
        const fetchCompany = async () => {
            const companyDoc = await getDoc(doc(db, 'companies', companyId));
            if (companyDoc.exists()) {
                setCompanyData(companyDoc.data() as CompanyData);
            }
        };
        fetchCompany();
    }, [companyId]);

    if (!companyData || companyData.status !== 'Trial' || !companyData.trialEndDate) return null;

    const daysLeft = differenceInDays(parseISO(companyData.trialEndDate), new Date());
    if (daysLeft < 0) return null;

    const getMessage = () => {
        if (daysLeft === 0) return 'Seu trial expira hoje! Faça upgrade agora.';
        if (daysLeft === 1) return 'Seu trial expira amanhã! Faça upgrade agora.';
        return `Seu trial expira em ${daysLeft} dias. Faça upgrade para não perder acesso.`;
    };

    return (
        <div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800 text-sm font-medium text-center p-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                <AlertTriangle className="h-4 w-4" />
                <span>{getMessage()}</span>
                <Button size="sm" className="h-7 bg-yellow-400 text-yellow-900 hover:bg-yellow-500" asChild>
                    <Link href="/admin/configuracoes">Fazer Upgrade</Link>
                </Button>
            </div>
        </div>
    );
};

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const [companyId, setCompanyId] = useState<string | undefined>(undefined);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMaster, setIsMaster] = useState(false);
    const [masterCompanyName, setMasterCompanyName] = useState('');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (user.role !== 'admin' && user.role !== 'master') {
            router.push('/login');
            return;
        }

        // Master: usar companyId da URL; Admin: usar do doc
        if (user.role === 'master') {
            const urlCompanyId = searchParams.get('companyId');
            if (urlCompanyId) {
                setCompanyId(urlCompanyId);
                setIsMaster(true);
                // Buscar nome da empresa para o banner
                getDoc(doc(db, 'companies', urlCompanyId)).then((compDoc) => {
                    if (compDoc.exists()) {
                        setMasterCompanyName(compDoc.data().companyName || '');
                    }
                });
            } else {
                router.push('/master/empresas');
                return;
            }
        } else {
            setCompanyId(user.companyId);
        }
        setReady(true);
    }, [user, loading, router, searchParams]);

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
                <div className="flex items-center justify-center px-2 group-data-[state=collapsed]:justify-center">
                    <FeedbackDialog pagina="Sidebar" />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2 px-2 py-3 h-auto">
                            <Avatar className="h-9 w-9 shrink-0">
                                {user.profile?.avatarUrl && (
                                    <AvatarImage src={user.profile.avatarUrl} alt={user.name || ''} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {user.name?.substring(0, 2).toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start group-data-[state=collapsed]:hidden overflow-hidden">
                                <span className="text-sm font-medium truncate max-w-[130px]">{(user.name || '').split(' ')[0]}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[130px]">Admin</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
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
                        <DropdownMenuItem asChild>
                            <Link href="/admin/configuracoes">
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Configurações</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/admin/suporte">
                                <HelpCircle className="mr-2 h-4 w-4" />
                                <span>Suporte</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </>
    );

    return (
        <DashboardLayout sidebar={sidebarContent}>
            {isMaster && (
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
            <TrialNotification companyId={companyId} />
            {children}
        </DashboardLayout>
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
