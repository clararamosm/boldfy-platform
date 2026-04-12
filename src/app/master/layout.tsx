'use client';

import type React from "react";
import { Suspense } from 'react';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { MasterSidebarNav } from "@/components/dashboard/master-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";

function MasterLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, ready } = useAuthGuard({ role: 'master' });
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
        <div className="p-2 group-data-[state=collapsed]:hidden">
          <p className="text-xs font-semibold uppercase text-sidebar-foreground/70">Master Admin</p>
        </div>
        <MasterSidebarNav />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserFooter
          user={user}
          roleLabel="Master"
          fallbackInitials="MA"
          onLogout={handleLogout}
          logoutLabel="Sair"
        />
      </SidebarFooter>
    </>
  );

  return (
    <LocaleProvider locale="pt-BR">
      <DashboardLayout sidebar={sidebarContent}>
        {children}
      </DashboardLayout>
    </LocaleProvider>
  );
}

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
        <MasterLayoutInner>{children}</MasterLayoutInner>
      </Suspense>
    </AuthProvider>
  );
}
