'use client';

import type React from "react";
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { ColaboradorSidebarNav } from "@/components/dashboard/colaborador-sidebar-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LogOut, User as UserIcon, Loader2, AlertTriangle, Linkedin } from "lucide-react";

type UserData = {
    name: string;
    email: string;
    role: string;
};

type TokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'not_connected';

function getTokenStatus(userData: Record<string, unknown>): { status: TokenStatus; daysLeft: number } {
    const connection = userData?.linkedinConnection as { tokenExpiresAt?: number } | undefined;
    if (!connection?.tokenExpiresAt) return { status: 'not_connected', daysLeft: 0 };
    const now = Date.now();
    const msLeft = connection.tokenExpiresAt - now;
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    if (msLeft <= 0) return { status: 'expired', daysLeft: 0 };
    if (daysLeft <= 7) return { status: 'expiring_soon', daysLeft };
    return { status: 'valid', daysLeft };
}

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tokenStatus, setTokenStatus] = useState<{ status: TokenStatus; daysLeft: number }>({ status: 'not_connected', daysLeft: 0 });
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (!firebaseUser) {
                router.push('/login');
                return;
            }
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data() as UserData;
                if (data.role !== 'colaborador') {
                    router.push('/login');
                    return;
                }
                setUser({ name: data.profile?.name || data.name || '', email: data.profile?.email || data.email || '', role: data.role });
                setTokenStatus(getTokenStatus(userDoc.data() as Record<string, unknown>));
            } else {
                router.push('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

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
                <ColaboradorSidebarNav />
            </SidebarContent>
            <SidebarFooter>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {user?.name?.substring(0, 2).toUpperCase() || 'CO'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start group-data-[state=collapsed]:hidden overflow-hidden">
                <span className="text-sm font-medium truncate max-w-[150px]">{(user?.name || '').split(' ')[0]}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">Colaborador</span>
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
                            <Link href="/colaborador/configuracoes">
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
            {tokenStatus.status === 'expired' && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between dark:bg-red-950/30 dark:border-red-900">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">Seu token do LinkedIn expirou. Reconecte para continuar publicando.</span>
                    </div>
                    <Link href="/colaborador/configuracoes" className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline whitespace-nowrap flex items-center gap-1">
                        <Linkedin className="h-3.5 w-3.5" /> Reconectar
                    </Link>
                </div>
            )}
            {tokenStatus.status === 'expiring_soon' && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-900">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">
                            Seu token do LinkedIn expira em {tokenStatus.daysLeft} dia{tokenStatus.daysLeft !== 1 ? 's' : ''}. Reconecte para evitar interrupções.
                        </span>
                    </div>
                    <Link href="/colaborador/configuracoes" className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap flex items-center gap-1">
                        <Linkedin className="h-3.5 w-3.5" /> Reconectar
                    </Link>
                </div>
            )}
            {children}
        </DashboardLayout>
    );
}

