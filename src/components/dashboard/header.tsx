import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button";
import type React from 'react';
import { Github, Code, RefreshCw } from 'lucide-react';


type HeaderProps = {
    title: string;
    children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            {/* Content removed as requested */}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
            <Button variant="outline">Invite</Button>
            <Button>Publish</Button>
        </div>
        {children}
      </div>
    </header>
  )
}
