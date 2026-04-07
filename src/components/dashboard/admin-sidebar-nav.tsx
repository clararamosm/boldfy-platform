'use client';

import { useMemo } from 'react';
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Trophy, Users, Newspaper, UserSearch } from "lucide-react";
import { useUnreadFeed } from '@/hooks/use-unread-feed';
import { useT } from '@/lib/i18n/context';

export function AdminSidebarNav() {
    const t = useT();
    const { count } = useUnreadFeed();

    const navItems = useMemo(() => {
        const items = [
            { title: t.nav.dashboard, href: "/admin/dashboard", icon: LayoutDashboard },
            { title: t.nav.collaborators, href: "/admin/colaboradores", icon: Users },
            { title: t.nav.missions, href: "/admin/missoes", icon: Trophy },
            { title: t.nav.trails, href: "/admin/trilhas", icon: BookOpen },
            { title: t.nav.rewards, href: "/admin/recompensas", icon: Gift },
            { title: t.nav.library, href: "/admin/biblioteca", icon: Library },
            { title: t.nav.linkedinFeed, href: "/admin/linkedin-feed", icon: Newspaper },
            { title: t.nav.linkedinLeads, href: "/admin/linkedin-leads", icon: UserSearch, badge: t.nav.comingSoon, disabled: true },
        ];
        return items.map(item => {
            if (item.href === '/admin/linkedin-feed' && count > 0) {
                return { ...item, badge: String(count) };
            }
            return item;
        });
    }, [count, t]);

    return <SidebarNav items={navItems} />;
}
