'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Gift, LayoutDashboard, Library, Sparkles, Zap, Newspaper,
  CalendarDays, UserSearch, BarChart2, Trophy, ChevronRight, PenTool, Gamepad2,
  Palette,
} from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Header } from './header';
import { useUnreadFeed } from '@/hooks/use-unread-feed';
import { useT } from '@/lib/i18n/context';

// ─── Simple top-level item ──────────────────────────────────────────

function SimpleItem({
  href,
  icon: Icon,
  title,
  badge,
  badgeVariant = 'default',
  disabled,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeVariant?: 'default' | 'danger';
  disabled?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  if (disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="opacity-50 cursor-not-allowed hover:opacity-60 transition-opacity"
          onClick={e => e.preventDefault()}
        >
          <Icon className="h-4 w-4" />
          <span className="flex items-center gap-2">
            {title}
            {badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-purple-100 text-purple-600">
                {badge}
              </span>
            )}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={href}>
          <Icon className="h-4 w-4" />
          <span className="flex items-center gap-2 font-medium">
            {title}
            {badge && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                badgeVariant === 'danger'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-primary/10 text-primary',
              )}>
                {badge}
              </span>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── Collapsible group with sub-items ──────────────────────────────

type SubItem = {
  href: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeVariant?: 'default' | 'danger';
};

function CollapsibleGroup({
  label,
  icon: Icon,
  items,
  defaultOpen = true,
}: {
  label: string;
  icon: React.ElementType;
  items: SubItem[];
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  // Auto-open if any child is active
  const hasActiveChild = items.some(i => pathname.startsWith(i.href));
  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="font-medium text-muted-foreground hover:text-foreground">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map(item => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={pathname.startsWith(item.href)}>
                  <Link href={item.href}>
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="flex items-center gap-2">
                      {item.title}
                      {item.badge && (
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                          item.badgeVariant === 'danger'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-primary/10 text-primary',
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── Main Sidebar Nav ────────────────────────────────────────────

interface ColaboradorSidebarNavProps {
  uploadPending?: boolean;
}

export function ColaboradorSidebarNav({ uploadPending = false }: ColaboradorSidebarNavProps) {
  const t = useT();
  const { count } = useUnreadFeed();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>

          {/* Dashboard — standalone */}
          <SimpleItem href="/colaborador/dashboard" icon={LayoutDashboard} title={t.nav.dashboard} />

          {/* Manual de Marca Pessoal — label curto pra evitar overflow no sidebar */}
          <SimpleItem href="/colaborador/marca-pessoal" icon={Palette} title="Marca Pessoal" />

          {/* Conteúdo — collapsible group */}
          <CollapsibleGroup
            label={t.nav.content || 'Conteúdo'}
            icon={PenTool}
            defaultOpen
            items={[
              { href: '/colaborador/biblioteca', icon: Library, title: t.nav.library },
              { href: '/colaborador/assistente', icon: Sparkles, title: t.nav.contentAssistant },
              { href: '/colaborador/calendario', icon: CalendarDays, title: t.nav.calendar },
              {
                href: '/colaborador/analytics',
                icon: BarChart2,
                title: 'Analytics',
                ...(uploadPending ? { badge: 'Upload', badgeVariant: 'danger' as const } : {}),
              },
            ]}
          />

          {/* Jornada — collapsible group */}
          <CollapsibleGroup
            label={t.nav.gamification || 'Jornada'}
            icon={Gamepad2}
            defaultOpen
            items={[
              { href: '/colaborador/trilhas', icon: BookOpen, title: t.nav.trails },
              { href: '/colaborador/missoes', icon: Zap, title: t.nav.missions },
              { href: '/colaborador/recompensas', icon: Gift, title: t.nav.rewards },
              { href: '/colaborador/rankings', icon: Trophy, title: t.nav.rankings },
            ]}
          />

          {/* LinkedIn — standalone items */}
          <SimpleItem
            href="/colaborador/linkedin-feed"
            icon={Newspaper}
            title={t.nav.linkedinFeed}
            badge={count > 0 ? String(count) : undefined}
          />
          <SimpleItem
            href="/colaborador/linkedin-leads"
            icon={UserSearch}
            title={t.nav.linkedinLeads}
            badge={t.nav.comingSoon}
            disabled
          />

        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ─── Header (path → title mapper) ───────────────────────────────

export function ColaboradorHeader() {
  const t = useT();
  const pathname = usePathname();
  const titleMap: Record<string, string> = {
    '/colaborador/dashboard': t.nav.dashboard,
    '/colaborador/trilhas': t.nav.trails,
    '/colaborador/missoes': t.nav.missions,
    '/colaborador/recompensas': t.nav.rewards,
    '/colaborador/biblioteca': t.nav.library,
    '/colaborador/assistente': t.nav.contentAssistant,
    '/colaborador/calendario': t.nav.calendar,
    '/colaborador/linkedin-feed': t.nav.linkedinFeed,
    '/colaborador/rankings': t.nav.rankings,
  };
  const title = Object.entries(titleMap).find(([path]) => pathname.startsWith(path))?.[1] || '';
  return <Header title={title} />;
}
