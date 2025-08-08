import type React from "react";
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
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


export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-headline text-lg font-semibold">Brand Advocate</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav items={influencerNavItems} />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if needed */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
