'use client';

import type React from "react";
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { InfluencerSidebarNav } from "@/components/dashboard/influencer-sidebar-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LogOut, User as UserIcon, Loader2 } from "lucide-react";

type UserData = {
    name: string;
    email: string;
    role: string;
};

export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
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
                setUser({ name: data.name, email: data.email, role: data.role });
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
                <InfluencerSidebarNav />
            </SidebarContent>
            <SidebarFooter>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {user?.name?.substring(0, 2).toUpperCase() || 'IN'}
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
                            <Link href="/influencer/configuracoes">
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
            {children}
        </DashboardLayout>
    );
}

