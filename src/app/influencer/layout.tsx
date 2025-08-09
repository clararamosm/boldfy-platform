import type React from "react";
import { SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { InfluencerSidebarNav } from "@/components/dashboard/influencer-sidebar-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LogOut } from "lucide-react";

export default function InfluencerLayout({ children }: { children: React.ReactNode }) {

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
        <SidebarFooter className="p-2 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start p-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:mx-auto">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start group-data-[state=collapsed]:hidden">
                    <span className="text-sm font-semibold text-foreground">clara@boldfy.com.br</span>
                    <span className="text-xs text-muted-foreground">Influenciador</span>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Clara</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    clara@boldfy.com.br
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/influencer/configuracoes">Configurações</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Suporte
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
