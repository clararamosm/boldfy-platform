import type React from "react";
import { SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { AdminSidebarNav } from "@/components/dashboard/admin-sidebar-nav";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {

  const sidebarContent = (
     <>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-headline text-lg font-semibold group-data-[state=collapsed]:hidden">Brand Advocate</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarNav />
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
