import type React from "react";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { MasterSidebarNav } from "@/components/dashboard/master-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  
  const sidebarContent = (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-headline text-lg font-semibold group-data-[state=collapsed]:hidden">Brand Advocate</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
          <div className="p-2 group-data-[state=collapsed]:hidden">
              <p className="text-xs font-semibold uppercase text-sidebar-foreground/70">Master Admin</p>
          </div>
        <MasterSidebarNav />
      </SidebarContent>
      <SidebarFooter>
        {/* Footer content */}
      </SidebarFooter>
    </>
  );
  
  return (
    <DashboardLayout sidebar={sidebarContent}>
      {children}
    </DashboardLayout>
  );
}
