// src/components/dashboard/dashboard-layout.tsx
'use client';

import type React from 'react';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { BillingPaywallOverlay } from '@/components/billing/billing-paywall-overlay';

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">{sidebar}</Sidebar>
      <SidebarInset>{children}</SidebarInset>
      {/* Paywall global: trava a interacao quando o modulo do usuario esta sem
          acesso. Self-fetch via getBillingAccess (server). Cobre admin,
          colaborador e thoughtleader de uma vez (todos usam DashboardLayout). */}
      <BillingPaywallOverlay />
    </SidebarProvider>
  );
}
