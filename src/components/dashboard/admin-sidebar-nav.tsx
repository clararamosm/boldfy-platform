'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Cog, Gift, LayoutDashboard, Library, Trophy, Users, Palette, Linkedin, Newspaper } from "lucide-react";

const adminNavItems = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Colaboradores", href: "/admin/colaboradores", icon: Users },
    { title: "Missões", href: "/admin/missoes", icon: Trophy },
    { title: "Trilhas", href: "/admin/trilhas", icon: BookOpen },
    { title: "Recompensas", href: "/admin/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/admin/biblioteca", icon: Library },
    { title: "LinkedIn Track", href: "/admin/linkedin-track", icon: Linkedin, badge: "Em breve", disabled: true },
    { title: "LinkedIn Feed", href: "/admin/linkedin-feed", icon: Newspaper, badge: "Em breve", disabled: true },
    { title: "Configurações", href: "/admin/configuracoes", icon: Cog },
];

export function AdminSidebarNav() {
    return <SidebarNav items={adminNavItems} />;
}
