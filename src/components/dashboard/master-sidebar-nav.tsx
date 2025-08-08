'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Building2, Globe, LayoutDashboard } from "lucide-react";

const masterNavItems = [
    { title: "Dashboard", href: "/master/dashboard", icon: LayoutDashboard },
    { title: "Empresas", href: "#", icon: Building2 },
    { title: "Conteúdo Global", href: "#", icon: Globe },
];

export function MasterSidebarNav() {
    return <SidebarNav items={masterNavItems} />;
}
