'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavProps {
  items: {
    href: string;
    title: string;
    icon: LucideIcon;
    badge?: string;
    badgeVariant?: 'default' | 'danger';
    disabled?: boolean;
  }[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();
    const searchParams = useSearchParams();
    const companyId = searchParams.get('companyId');
    const buildHref = (href: string) => companyId ? `${href}?companyId=${companyId}` : href;
  const [bouncingItem, setBouncingItem] = useState<string | null>(null);

  const handleDisabledClick = (href: string) => {
    setBouncingItem(href);
    setTimeout(() => setBouncingItem(null), 700);
  };

  return (
    <>
      <style>{`
        @keyframes badgeBounce {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25) translateY(-2px); }
          30% { transform: scale(0.95); }
          45% { transform: scale(1.1) translateY(-1px); }
          60% { transform: scale(1); }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0); }
          30% { box-shadow: 0 0 8px 3px rgba(147, 51, 234, 0.4); }
          60% { box-shadow: 0 0 4px 1px rgba(147, 51, 234, 0.2); }
        }
        .badge-bounce {
          animation: badgeBounce 0.6s ease-in-out, badgeGlow 0.6s ease-in-out;
        }
      `}</style>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            {item.disabled ? (
              <SidebarMenuButton
                className={cn(
                  "justify-start font-medium group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:-ml-1",
                  "opacity-50 cursor-not-allowed hover:opacity-60 transition-opacity"
                )}
                onClick={() => handleDisabledClick(item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  {item.title}
                  {item.badge && (
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none inline-block",
                      item.badgeVariant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600',
                      bouncingItem === item.href && "badge-bounce"
                    )}>
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
                <Link href={buildHref(item.href)}>
                  <item.icon className="h-4 w-4" />
                  <span className="flex items-center gap-2">
                    {item.title}
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                        item.badgeVariant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'
                      )}>
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
    </>
  );
}
