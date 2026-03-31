'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, BarChart3, Zap, Cog, Linkedin, Newspaper } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Header } from './header';

const influencerNavItems = [
    { title: "Dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
    { title: "Trilhas", href: "/influencer/trilhas", icon: BookOpen },
    { title: "Missões", href: "/influencer/missoes", icon: Zap },
    { title: "Rankings", href: "/influencer/rankings", icon: BarChart3 },
    { title: "Recompensas", href: "/influencer/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/influencer/biblioteca", icon: Library },
    { title: "Assistente de Conteúdo", href: "/influencer/assistente", icon: Sparkles },
    { title: "LinkedIn Track", href: "/influencer/linkedin-track", icon: Linkedin, badge: "Em breve", disabled: true },
    { title: "LinkedIn Feed", href: "/influencer/linkedin-feed", icon: Newspaper, badge: "Em breve", disabled: true },
    { title: "Configurações", href: "/influencer/configuracoes", icon: Cog },
];

export function InfluencerSidebarNav() {
    return <SidebarNav items={influencerNavItems} />;
}

export function InfluencerHeader() {
    const pathname = usePathname();
    const currentNavItem = influencerNavItems.find(item => pathname.startsWith(item.href));
    const title = currentNavItem ? currentNavItem.title : "";

    return <Header title={title} />;
}
