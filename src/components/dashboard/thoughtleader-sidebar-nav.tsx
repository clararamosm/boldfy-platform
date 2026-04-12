'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { LayoutDashboard, ClipboardList, CalendarDays, Newspaper, UserSearch, FileText, BookOpen, Settings } from "lucide-react";
import { useT } from '@/lib/i18n/context';

export function ThoughtLeaderSidebarNav() {
    const t = useT();
    const navItems = [
        { title: t.nav.dashboard, href: "/thoughtleader/dashboard", icon: LayoutDashboard },
        { title: t.nav.backlog, href: "/thoughtleader/backlog", icon: ClipboardList },
        { title: t.nav.calendar, href: "/thoughtleader/calendario", icon: CalendarDays },
        { title: t.nav.linkedinFeed, href: "/thoughtleader/linkedin-feed", icon: Newspaper },
        { title: t.nav.linkedinLeads, href: "/thoughtleader/linkedin-leads", icon: UserSearch, badge: t.nav.comingSoon, disabled: true },
        { title: t.nav.strategy, href: "/thoughtleader/estrategia", icon: FileText },
        { title: t.nav.brandManual, href: "/thoughtleader/manual", icon: BookOpen },
        { title: t.nav.settings, href: "/thoughtleader/configuracoes", icon: Settings },
    ];
    return <SidebarNav items={navItems} />;
}
