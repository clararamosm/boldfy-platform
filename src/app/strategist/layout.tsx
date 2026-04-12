'use client';

import type React from "react";
import RoleLayout from "@/components/dashboard/role-layout";
import { StrategistSidebarNav } from "@/components/dashboard/strategist-sidebar-nav";
import { Settings } from "lucide-react";

export default function StrategistLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout
      config={{
        authOptions: { role: 'strategist' },
        locale: 'pt-BR',
        roleLabel: 'Estrategista',
        fallbackInitials: 'ST',
        feedbackPage: 'Strategist Sidebar',
        logoutLabel: 'Sair',
        menuItems: [
          { href: '/strategist/configuracoes', label: 'Configurações', icon: Settings },
        ],
      }}
      sidebarNav={<StrategistSidebarNav />}
    >
      {children}
    </RoleLayout>
  );
}
