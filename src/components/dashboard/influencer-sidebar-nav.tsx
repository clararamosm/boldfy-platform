'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, Trophy, Settings, BarChart3, Star, Zap } from "lucide-react";

const influencerNavItems = [
    { title: "Dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
    { title: "Trilhas", href: "/influencer/trilhas", icon: BookOpen },
    { title: "Missões", href: "/influencer/missoes", icon: Zap },
    { title: "Rankings", href: "/influencer/rankings", icon: BarChart3 },
    { title: "Recompensas", href: "/influencer/recompensas", icon: Gift },
    { title: "Biblioteca", href: "/influencer/biblioteca", icon: Library },
    { title: "Assistente de Conteúdo", href: "/influencer/assistente", icon: Sparkles },
    { title: "Configurações", href: "/influencer/configuracoes", icon: Settings },
];

export function InfluencerSidebarNav() {
    return <SidebarNav items={influencerNavItems} />;
}
