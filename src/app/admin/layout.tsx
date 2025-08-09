import type React from "react";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User, Eye } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {

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
        <SidebarFooter className="p-2 mt-auto">
          <div className="pb-2 group-data-[state=expanded]:hidden">
             <Button asChild variant="ghost" className="w-full">
                <Link href="/influencer/dashboard"><Eye className="h-4 w-4" /></Link>
            </Button>
          </div>
           <div className="p-2 border-t group-data-[state=collapsed]:hidden">
             <Button asChild variant="outline" className="w-full">
                <Link href="/influencer/dashboard"><Eye className="mr-2 h-4 w-4" />Visão Influenciador</Link>
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start p-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:mx-auto">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10">
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start group-data-[state=collapsed]:hidden">
                    <span className="text-sm font-semibold text-foreground">admin@boldfy.com</span>
                    <span className="text-xs text-muted-foreground">Admin</span>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Admin</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    admin@boldfy.com.br
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/configuracoes">
                  <User className="mr-2 h-4 w-4" />
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
      {children}
    </DashboardLayout>
  );
}
