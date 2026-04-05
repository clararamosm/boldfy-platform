import { SidebarTrigger } from "@/components/ui/sidebar"
import type React from 'react';

export type HeaderProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, children, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <div>
          <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {action}
        {children}
      </div>
    </header>
  )
}
