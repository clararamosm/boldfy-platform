'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { FeedbackDialog } from '@/components/feedback-dialog';
import type { LucideIcon } from 'lucide-react';

// ─── Types ──────────────────────────────────────

export type FooterMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type SidebarUserFooterProps = {
  user: {
    name?: string | null;
    email?: string | null;
    profile?: { avatarUrl?: string | null } | null;
  };
  roleLabel: string;
  fallbackInitials?: string;
  avatarOverride?: string;
  feedbackPage?: string;
  menuItems?: FooterMenuItem[];
  onLogout: () => void;
  logoutLabel: string;
};

// ─── Component ──────────────────────────────────

export function SidebarUserFooter({
  user,
  roleLabel,
  fallbackInitials = 'US',
  avatarOverride,
  feedbackPage,
  menuItems = [],
  onLogout,
  logoutLabel,
}: SidebarUserFooterProps) {
  const avatarSrc = avatarOverride || user.profile?.avatarUrl;
  return (
    <div className="flex items-center w-full gap-1 p-2 group-data-[collapsible=icon]:justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex-1 justify-start gap-2 px-0 py-2 h-auto min-w-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
          >
            <Avatar className="h-8 w-8 shrink-0">
              {avatarSrc && (
                <AvatarImage src={avatarSrc} alt={user.name || ''} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user.name?.substring(0, 2).toUpperCase() || fallbackInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start group-data-[state=collapsed]:hidden overflow-hidden">
              <span className="text-sm font-medium truncate max-w-[130px]">
                {(user.name || '').split(' ')[0]}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[130px]">
                {roleLabel}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        {feedbackPage && (
          <div className="shrink-0 group-data-[state=collapsed]:hidden">
            <FeedbackDialog pagina={feedbackPage} />
          </div>
        )}
        <DropdownMenuContent align="end" side="top" className="min-w-56 max-w-72">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="truncate">{user.name || ''}</span>
              <p className="text-[11px] leading-none text-muted-foreground truncate">
                {user.email || ''}
              </p>
            </div>
          </DropdownMenuLabel>
          {menuItems.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {menuItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {logoutLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
