import { SidebarTrigger } from "@/components/ui/sidebar"
import type React from 'react';


type HeaderProps = {
    title: string;
    children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {children}
      </div>
    </header>
  )
}
