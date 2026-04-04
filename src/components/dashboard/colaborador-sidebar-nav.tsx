'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, BarChart3, Zap, Cog, Linkedin, Newspaper, CalendarDays } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Header } from './header';

const colaboradorNavItems = [
    { title: "Dashboard", href: "/colaborador/dashboard", icon: LayoutDashboard },
    { title: "Trilhas", href: "/colaborador/trilhas", icon: BookOpen },
    { title: "Missões", href: "/colaborador/missoes", icon: Zap },
    { title: "Rankings", href: "/colaborador/rankings", icon: BarChart3 },
    { title: "Recompensas", href: "/colaborador/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/colaborador/biblioteca", icon: Library },
    { title: "Assistente de Conteúdo", href: "/colaborador/assistente", icon: Sparkles },
    { title: "Calendário", href: "/colaborador/calendario", icon: CalendarDays },
    { title: "LinkedIn Feed", href: "/colaborador/linkedin-feed", icon: Newspaper, badge: "Em breve", disabled: true },
    { title: "Configurações", href: "/colaborador/configuracoes", icon: Cog },
];

export function ColaboradorSidebarNav() {
    return <SidebarNav items={colaboradorNavItems} />;
}

export function ColaboradorHeader() {
    const pathname = usePathname();
    const currentNavItem = colaboradorNavItems.find(item => pathname.startsWith(item.href));
    const title = currentNavItem ? currentNavItem.title : "";

    return <Header title={title} />;
}
