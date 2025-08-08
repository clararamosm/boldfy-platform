'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Cog, Gift, LayoutDashboard, Library, Trophy, Users } from "lucide-react";

const adminNavItems = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Colaboradores", href: "#", icon: Users },
    { title: "Missões", href: "#", icon: Trophy },
    { title: "Trilhas", href: "#", icon: BookOpen },
    { title: "Recompensas", href: "#", icon: Gift },
    { title: "Biblioteca", href: "#", icon: Library },
    { title: "Configurações", href: "#", icon: Cog },
];

export function AdminSidebarNav() {
    return <SidebarNav items={adminNavItems} />;
}
