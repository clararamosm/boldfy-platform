'use client';

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { BookOpen, Gift, LayoutDashboard, Library, Sparkles, Trophy } from "lucide-react";

const influencerNavItems = [
    { title: "Dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
    { title: "Missões", href: "#", icon: Trophy },
    { title: "Trilhas", href: "#", icon: BookOpen },
    { title: "Recompensas", href: "#", icon: Gift },
    { title: "Biblioteca", href: "#", icon: Library },
    { title: "Assistente IA", href: "/influencer/assistente", icon: Sparkles },
];

export function InfluencerSidebarNav() {
    return <SidebarNav items={influencerNavItems} />;
}
