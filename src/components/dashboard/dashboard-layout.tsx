// src/components/dashboard/dashboard-layout.tsx
'use client';

import type React from 'react';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">{sidebar}</Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
