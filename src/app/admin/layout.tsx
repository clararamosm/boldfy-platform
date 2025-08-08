import type React from "react";
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <SidebarNav items={adminNavItems} />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
