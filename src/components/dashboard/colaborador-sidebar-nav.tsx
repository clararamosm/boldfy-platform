'use client';

import { useMemo } from 'react';
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, BarChart3, Zap, Newspaper, CalendarDays, UserSearch } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Header } from './header';
import { useUnreadFeed } from '@/hooks/use-unread-feed';

const baseNavItems = [
    { title: "Dashboard", href: "/colaborador/dashboard", icon: LayoutDashboard },
    { title: "Trilhas", href: "/colaborador/trilhas", icon: BookOpen },
    { title: "Missões", href: "/colaborador/missoes", icon: Zap },
    { title: "Rankings", href: "/colaborador/rankings", icon: BarChart3 },
    { title: "Recompensas", href: "/colaborador/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/colaborador/biblioteca", icon: Library },
    { title: "Assistente de Conteúdo", href: "/colaborador/assistente", icon: Sparkles },
    { title: "Calendário", href: "/colaborador/calendario", icon: CalendarDays },
    { title: "LinkedIn Feed", href: "/colaborador/linkedin-feed", icon: Newspaper },
    { title: "LinkedIn Leads", href: "/colaborador/linkedin-leads", icon: UserSearch, badge: "Em breve", disabled: true },
];

export function ColaboradorSidebarNav() {
    const { count } = useUnreadFeed();

    const navItems = useMemo(() =>
        baseNavItems.map(item => {
            if (item.href === '/colaborador/linkedin-feed' && count > 0) {
                return { ...item, badge: String(count) };
            }
            return item;
        }),
    [count]);

    return <SidebarNav items={navItems} />;
}

export function ColaboradorHeader() {
    const pathname = usePathname();
    const currentNavItem = baseNavItems.find(item => pathname.startsWith(item.href));
    const title = currentNavItem ? currentNavItem.title : "";

    return <Header title={title} />;
}
