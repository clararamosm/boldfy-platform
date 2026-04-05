'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Trophy, Users, Newspaper, UserSearch } from "lucide-react";

const adminNavItems = [
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
    return <SidebarNav items={adminNavItems} />;
}
