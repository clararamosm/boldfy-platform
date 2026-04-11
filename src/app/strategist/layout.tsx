'use client';

import type React from "react";
import { Suspense } from 'react';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { StrategistSidebarNav } from "@/components/dashboard/strategist-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { LogOut, Loader2, Settings } from "lucide-react";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider } from "@/lib/i18n/context";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { FeedbackDialog } from "@/components/feedback-dialog";

function StrategistLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, ready } = useAuthGuard({ role: 'strategist' });
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
        <StrategistSidebarNav />
      </SidebarContent>
      <SidebarFooter className="p-2 mt-auto">
        <div className="flex items-center w-full gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-start gap-2 px-2">
                <Avatar className="h-8 w-8">
                  {user.profile?.avatarUrl && (
                    <AvatarImage src={user.profile.avatarUrl} alt={user.name || ''} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user.name?.substring(0, 2).toUpperCase() || 'ST'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start group-data-[state=collapsed]:hidden overflow-hidden">
                  <span className="text-sm font-medium truncate max-w-[130px]">{(user.name || '').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[130px]">Estrategista</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <div className="shrink-0 group-data-[state=collapsed]:hidden">
              <FeedbackDialog pagina="Strategist Sidebar" />
            </div>
            <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || ''}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/strategist/configuracoes">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

export default function StrategistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
        <StrategistLayoutInner>{children}</StrategistLayoutInner>
      </Suspense>
    </AuthProvider>
  );
}
