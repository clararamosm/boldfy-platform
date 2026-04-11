'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Building2, ClipboardList, Settings } from "lucide-react";
import { useT } from '@/lib/i18n/context';

export function StrategistSidebarNav() {
    const t = useT();
    const navItems = [
        { title: t.strategist.companiesTitle, href: "/strategist/empresas", icon: Building2 },
        { title: t.nav.contentPipeline, href: "/strategist/pipeline", icon: ClipboardList },
        { title: t.nav.settings, href: "/strategist/configuracoes", icon: Settings },
    ];
    return <SidebarNav items={navItems} />;
}
