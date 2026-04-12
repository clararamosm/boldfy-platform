'use client';

import type React from "react";
import RoleLayout from "@/components/dashboard/role-layout";
import { MasterSidebarNav } from "@/components/dashboard/master-sidebar-nav";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout
      config={{
        authOptions: { role: 'master' },
        locale: 'pt-BR',
        roleLabel: 'Master',
        fallbackInitials: 'MA',
        logoutLabel: 'Sair',
      }}
      sidebarNav={<MasterSidebarNav />}
      sidebarPreNav={
        <div className="p-2 group-data-[state=collapsed]:hidden">
          <p className="text-xs font-semibold uppercase text-sidebar-foreground/70">Master Admin</p>
        </div>
      }
    >
      {children}
    </RoleLayout>
  );
}
