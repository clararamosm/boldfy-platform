import { SidebarTrigger } from "@/components/ui/sidebar"
import { LanguageToggle } from "@/components/language-toggle"
import { UserNav } from "@/components/user-nav"
import type React from 'react';

type HeaderProps = {
    title: string;
    children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="font-headline text-xl font-semibold md:text-2xl">{title}</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <LanguageToggle />
        <UserNav />
      </div>
    </header>
  )
}
