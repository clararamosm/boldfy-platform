'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, Trophy, Settings, BarChart3, Star, Zap } from "lucide-react";

const influencerNavItems = [
    { title: "Trilhas", href: "/influencer/trilhas", icon: BookOpen },
    { title: "Missões", href: "#", icon: Zap },
    { title: "Rankings", href: "#", icon: BarChart3 },
    { title: "Recompensas", href: "#", icon: Gift },
    { title: "Biblioteca", href: "#", icon: Library },
    { title: "Assistente de Conteúdo", href: "/influencer/assistente", icon: Sparkles },
    { title: "Configurações", href: "#", icon: Settings },
];

export function InfluencerSidebarNav() {
    return <SidebarNav items={influencerNavItems} />;
}
