import type React from "react";
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { MasterSidebarNav } from "@/components/dashboard/master-sidebar-nav";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-headline text-lg font-semibold">Brand Advocate</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
            <div className="p-2">
                <p className="text-xs font-semibold uppercase text-sidebar-foreground/70">Master Admin</p>
            </div>
          <MasterSidebarNav />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
