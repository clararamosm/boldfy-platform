// src/app/admin/layout.tsx
'use client';

import type React from "react";
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, AlertTriangle, Sparkles } from "lucide-react";
import { differenceInDays, parseISO } from 'date-fns';

type CompanyStatus = 'Ativa' | 'Inativa' | 'Trial';

type UserData = {
    name: string;
    email: string;
    role: string;
};

type CompanyData = {
    status: CompanyStatus;
    trialEndsAt?: string;
};

const TrialNotification = () => {
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchCompanyData = async () => {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const companyId = userDocSnap.data().companyId;
                if (companyId) {
                    const companyDocRef = doc(db, 'companies', companyId);
                    const companyDocSnap = await getDoc(companyDocRef);
                    if (companyDocSnap.exists()) {
                        setCompany(companyDocSnap.data() as CompanyData);
                    }
                }
            }
        };
        fetchCompanyData();
    }, [user]);

    if (!company || company.status !== 'Trial' || !company.trialEndsAt) {
        return null;
    }

    const trialEndDate = parseISO(company.trialEndsAt);
    const remainingDays = differenceInDays(trialEndDate, new Date());

    const getMessage = () => {
        if (remainingDays < 0) return "Seu período de teste acabou.";
        if (remainingDays === 0) return "Seu período de teste acaba hoje!";
        if (remainingDays === 1) return "Falta 1 dia para o fim do seu período de teste.";
        return `Faltam ${remainingDays} dias para o fim do seu período de teste.`;
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

     useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    setUser({
                        name: data.profile?.name || 'Admin',
                        email: data.profile?.email || '',
                        role: data.role || 'Admin',
                    });
                }
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

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
        <SidebarFooter className="p-2 mt-auto border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start p-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:mx-auto">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10">
                    <AvatarFallback>{user?.name?.[0] || 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start group-data-[state=collapsed]:hidden">
                    <span className="text-sm font-semibold text-foreground">{user?.name || ''}</span>
                    <span className="text-xs text-muted-foreground">{user?.role || ''}</span>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || ''}</p>
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
              <DropdownMenuItem asChild>
                <Link href="/">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </>
  );

  return (
    <DashboardLayout sidebar={sidebarContent}>
        <TrialNotification />
        {children}
    </DashboardLayout>
  );
}
