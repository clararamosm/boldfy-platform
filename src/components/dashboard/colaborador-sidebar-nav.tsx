'use client';

import { useMemo } from 'react';
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, Zap, Newspaper, CalendarDays, UserSearch, BarChart2, Trophy } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Header } from './header';
import { useUnreadFeed } from '@/hooks/use-unread-feed';
import { useT } from '@/lib/i18n/context';

interface ColaboradorSidebarNavProps {
    uploadPending?: boolean;
}

export function ColaboradorSidebarNav({ uploadPending = false }: ColaboradorSidebarNavProps) {
    const t = useT();
    const { count } = useUnreadFeed();

    const navItems = useMemo(() => {
        const items = [
            { title: t.nav.dashboard, href: "/colaborador/dashboard", icon: LayoutDashboard },
            { title: t.nav.trails, href: "/colaborador/trilhas", icon: BookOpen },
            { title: t.nav.missions, href: "/colaborador/missoes", icon: Zap },
            { title: t.nav.rewards, href: "/colaborador/recompensas", icon: Gift },
            { title: t.nav.rankings, href: "/colaborador/rankings", icon: Trophy },
            { title: t.nav.library, href: "/colaborador/biblioteca", icon: Library },
            { title: t.nav.contentAssistant, href: "/colaborador/assistente", icon: Sparkles },
            { title: t.nav.calendar, href: "/colaborador/calendario", icon: CalendarDays },
            { title: t.nav.linkedinFeed, href: "/colaborador/linkedin-feed", icon: Newspaper },
            { title: t.nav.linkedinLeads, href: "/colaborador/linkedin-leads", icon: UserSearch, badge: t.nav.comingSoon, disabled: true },
            {
                title: 'Analytics',
                href: "/colaborador/analytics",
                icon: BarChart2,
                ...(uploadPending ? { badge: 'Upload', badgeVariant: 'danger' as const } : {}),
            },
        ];
        return items.map(item => {
            if (item.href === '/colaborador/linkedin-feed' && count > 0) {
                return { ...item, badge: String(count) };
            }
            return item;
        });
    }, [count, t, uploadPending]);

    return <SidebarNav items={navItems} />;
}

export function ColaboradorHeader() {
    const t = useT();
    const pathname = usePathname();
    const titleMap: Record<string, string> = {
        '/colaborador/dashboard': t.nav.dashboard,
        '/colaborador/trilhas': t.nav.trails,
        '/colaborador/missoes': t.nav.missions,
        '/colaborador/recompensas': t.nav.rewards,
        '/colaborador/biblioteca': t.nav.library,
        '/colaborador/assistente': t.nav.contentAssistant,
        '/colaborador/calendario': t.nav.calendar,
        '/colaborador/linkedin-feed': t.nav.linkedinFeed,
        '/colaborador/rankings': t.nav.rankings,
    };
    const title = Object.entries(titleMap).find(([path]) => pathname.startsWith(path))?.[1] || '';
    return <Header title={title} />;
}
