'use client';

import { useMemo } from 'react';
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, Zap, Newspaper, CalendarDays, UserSearch } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Header } from './header';
import { useUnreadFeed } from '@/hooks/use-unread-feed';
import { useAiCredits } from '@/hooks/use-ai-credits';
import { useT } from '@/lib/i18n/context';

export function ColaboradorSidebarNav() {
    const t = useT();
    const { count } = useUnreadFeed();
    const { totalAvailable, monthlyLimit, loading: creditsLoading } = useAiCredits();

    const navItems = useMemo(() => {
        const creditsBadge = !creditsLoading ? `${totalAvailable}/${monthlyLimit}` : undefined;

        const items = [
            { title: t.nav.dashboard, href: "/colaborador/dashboard", icon: LayoutDashboard },
            { title: t.nav.trails, href: "/colaborador/trilhas", icon: BookOpen },
            { title: t.nav.missions, href: "/colaborador/missoes", icon: Zap },
            { title: t.nav.rewards, href: "/colaborador/recompensas", icon: Gift },
            { title: t.nav.library, href: "/colaborador/biblioteca", icon: Library },
            { title: t.nav.contentAssistant, href: "/colaborador/assistente", icon: Sparkles, badge: creditsBadge, badgeVariant: totalAvailable === 0 ? 'danger' as const : undefined },
            { title: t.nav.calendar, href: "/colaborador/calendario", icon: CalendarDays },
            { title: t.nav.linkedinFeed, href: "/colaborador/linkedin-feed", icon: Newspaper },
            { title: t.nav.linkedinLeads, href: "/colaborador/linkedin-leads", icon: UserSearch, badge: t.nav.comingSoon, disabled: true },
        ];
        return items.map(item => {
            if (item.href === '/colaborador/linkedin-feed' && count > 0) {
                return { ...item, badge: String(count) };
            }
            return item;
        });
    }, [count, t, totalAvailable, monthlyLimit, creditsLoading]);

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
    };
    const title = Object.entries(titleMap).find(([path]) => pathname.startsWith(path))?.[1] || '';
    return <Header title={title} />;
}
