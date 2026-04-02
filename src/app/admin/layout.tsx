'use client';

import type React from "react";
import { useState, useEffect, Suspense } from 'react';
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, AlertTriangle, Sparkles, Loader2, ArrowLeft, Shield } from "lucide-react";
import { differenceInDays, parseISO } from 'date-fns';

type CompanyStatus = 'Ativa' | 'Inativa' | 'Trial';

type UserData = {
    name: string;
    email: string;
    role: string;
    companyId?: string;
};

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
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [companyId, setCompanyId] = useState<string | undefined>(undefined);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMaster, setIsMaster] = useState(false);
    const [masterCompanyName, setMasterCompanyName] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (!firebaseUser) {
                router.push('/login');
                return;
            }
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data() as UserData & { companyId?: string };
                if (data.role !== 'admin' && data.role !== 'master') {
                    router.push('/login');
                    return;
                }
                setUser({ name: data.name, email: data.email, role: data.role });
                // Master: usar companyId da URL; Admin: usar do doc
                if (data.role === 'master') {
                    const urlCompanyId = searchParams.get('companyId');
                    if (urlCompanyId) {
                        setCompanyId(urlCompanyId);
                        setIsMaster(true);
                        // Buscar nome da empresa para o banner
                        const compDoc = await getDoc(doc(db, 'companies', urlCompanyId));
                        if (compDoc.exists()) {
                            setMasterCompanyName(compDoc.data().companyName || '');
                        }
                    } else {
                        router.push('/master/empresas');
                        return;
                    }
                } else {
                    setCompanyId(data.companyId);
                }
            } else {
                router.push('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router, searchParams]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    if (loading) {
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start group-data-[state=collapsed]:hidden">
                                <span className="text-sm font-medium">{user?.name || ''}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]">{user?.email || ''}</span>
                                <span className="text-xs text-muted-foreground">{user?.role || ''}</span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col">
                                <span>{user?.name || ''}</span>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email || ''}
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </Suspense>
    );
}
