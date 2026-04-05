'use client';

import { useMemo } from 'react';
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Trophy, Users, Newspaper, UserSearch } from "lucide-react";
import { useUnreadFeed } from '@/hooks/use-unread-feed';

const baseAdminNavItems = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Colaboradores", href: "/admin/colaboradores", icon: Users },
    { title: "Missões", href: "/admin/missoes", icon: Trophy },
    { title: "Trilhas", href: "/admin/trilhas", icon: BookOpen },
    { title: "Recompensas", href: "/admin/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/admin/biblioteca", icon: Library },
    { title: "LinkedIn Feed", href: "/admin/linkedin-feed", icon: Newspaper },
    { title: "LinkedIn Leads", href: "/admin/linkedin-leads", icon: UserSearch, badge: "Em breve", disabled: true },
];

export function AdminSidebarNav() {
    const { count } = useUnreadFeed();

    const navItems = useMemo(() =>
        baseAdminNavItems.map(item => {
            if (item.href === '/admin/linkedin-feed' && count > 0) {
                return { ...item, badge: String(count) };
            }
            return item;
        }),
    [count]);

    return <SidebarNav items={navItems} />;
}
