import type React from "react";
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { InfluencerSidebarNav } from "@/components/dashboard/influencer-sidebar-nav";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-headline text-xl font-bold text-foreground">Boldfy</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <InfluencerSidebarNav />
        </SidebarContent>
        <SidebarFooter className="flex flex-col gap-4">
          <SidebarSeparator />
           <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">clara@boldfy.com.br</span>
                        <span className="text-xs text-muted-foreground">Influenciador</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
            <Button variant="ghost" className="justify-start p-2 text-muted-foreground">
                <Globe className="mr-2 h-4 w-4" />
                Idioma
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col bg-background">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
