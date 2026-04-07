'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Building2, Globe, LayoutDashboard } from "lucide-react";
import { useT } from '@/lib/i18n/context';

export function MasterSidebarNav() {
    const t = useT();
    const masterNavItems = [
        { title: t.nav.dashboard, href: "/master/dashboard", icon: LayoutDashboard },
        { title: t.nav.companies, href: "/master/empresas", icon: Building2 },
        { title: t.nav.globalContent, href: "/master/trilhas", icon: Globe },
    ];
    return <SidebarNav items={masterNavItems} />;
}
