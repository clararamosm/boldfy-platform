'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ClipboardList, CalendarDays, Newspaper, UserSearch, FileText, BookOpen, BarChart2 } from "lucide-react";
import { useT } from '@/lib/i18n/context';

interface ThoughtLeaderSidebarNavProps {
    uploadPending?: boolean;
}

export function ThoughtLeaderSidebarNav({ uploadPending = false }: ThoughtLeaderSidebarNavProps) {
    const t = useT();
    const navItems = [
        { title: t.nav.backlog, href: "/thoughtleader/dashboard", icon: ClipboardList },
        { title: t.nav.calendar, href: "/thoughtleader/calendario", icon: CalendarDays },
        { title: t.nav.linkedinFeed, href: "/thoughtleader/linkedin-feed", icon: Newspaper },
        { title: t.nav.linkedinLeads, href: "/thoughtleader/linkedin-leads", icon: UserSearch, badge: t.nav.comingSoon, disabled: true },
        {
            title: 'Analytics',
            href: "/thoughtleader/analytics",
            icon: BarChart2,
            ...(uploadPending ? { badge: 'Upload', badgeVariant: 'danger' as const } : {}),
        },
        { title: t.nav.strategy, href: "/thoughtleader/estrategia", icon: FileText },
        { title: t.nav.brandManual, href: "/thoughtleader/manual", icon: BookOpen },
    ];
    return <SidebarNav items={navItems} />;
}
