'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavProps {
  items: {
    href: string;
    title: string;
    icon: LucideIcon;
    badge?: string;
    disabled?: boolean;
  }[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          {item.disabled ? (
            <SidebarMenuButton
              className={cn(
                "justify-start font-medium group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:-ml-1",
                "opacity-50 cursor-not-allowed"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex items-center gap-2">
                {item.title}
                {item.badge && (
                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}
              </span>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(item.href)}
              className={cn(
                "justify-start font-medium group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:-ml-1",
              )}
            >
              <Link href={item.href}>
                <item.icon className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  {item.title}
                  {item.badge && (
                    <span className="text-[10px] font-semibold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}
                </span>
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
