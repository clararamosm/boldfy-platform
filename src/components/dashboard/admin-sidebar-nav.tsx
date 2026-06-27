'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Gift, LayoutDashboard, Library, Trophy, Users,
  Newspaper, UserSearch, BarChart2, Layers, ChevronRight,
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
import { useUnreadFeed } from '@/hooks/use-unread-feed';
import { useT } from '@/lib/i18n/context';

// Preserva ?companyId= ou ?c= na navegacao do sidebar.
// Sem isto, master/strategist visualizando uma empresa perdem o contexto
// ao clicar em qualquer item — useAuthGuard nao acha companyId na URL e
// redireciona pra /master/empresas (ou /strategist/empresas).
function useCompanyAwareHref() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const companyId = searchParams.get('companyId');
  return (href: string) => {
    if (companySlug) return `${href}?c=${companySlug}`;
    if (companyId) return `${href}?companyId=${companyId}`;
    return href;
  };
}

// Item simples (sem submenu)
function SimpleItem({
  href,
  icon: Icon,
  title,
  badge,
  disabled,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  disabled?: boolean;
}) {
  const pathname = usePathname();
  const buildHref = useCompanyAwareHref();
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
        <Link href={buildHref(href)}>
          <Icon className="h-4 w-4" />
          <span className="flex items-center gap-2 font-medium">
            {title}
            {badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-red-100 text-red-600">
                {badge}
              </span>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Grupo colapsável com sub-itens
function CollapsibleGroup({
  label,
  icon: Icon,
  items,
  defaultOpen = true,
}: {
  label: string;
  icon: React.ElementType;
  items: Array<{ href: string; icon: React.ElementType; title: string }>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pathname = usePathname();
  const buildHref = useCompanyAwareHref();

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
                  <Link href={buildHref(item.href)}>
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.title}</span>
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

export function AdminSidebarNav() {
  const t = useT();
  const { count } = useUnreadFeed();

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu className="p-2 group-data-[collapsible=icon]:items-center">

          {/* Itens simples do topo */}
          <SimpleItem href="/admin/dashboard" icon={LayoutDashboard} title={t.nav.dashboard} />
          <SimpleItem href="/admin/brand-context" icon={Palette} title="Manual de Marca" />
          <SimpleItem href="/admin/colaboradores" icon={Users} title={t.nav.collaborators} />

          {/* Modo Time */}
          <CollapsibleGroup
            label="Modo Time"
            icon={Layers}
            defaultOpen={true}
            items={[
              { href: '/admin/missoes', icon: Trophy, title: t.nav.missions },
              { href: '/admin/trilhas', icon: BookOpen, title: t.nav.trails },
              { href: '/admin/recompensas', icon: Gift, title: t.nav.rewards },
              { href: '/admin/biblioteca', icon: Library, title: t.nav.library },
              { href: '/admin/analytics/colaboradores', icon: BarChart2, title: 'Analytics' },
            ]}
          />

          {/* Modo Executivo */}
          <CollapsibleGroup
            label="Modo Executivo"
            icon={Users}
            defaultOpen={true}
            items={[
              { href: '/admin/analytics/thought-leaders', icon: BarChart2, title: 'Analytics' },
            ]}
          />

          {/* LinkedIn — itens simples no final */}
          <SimpleItem
            href="/admin/linkedin-feed"
            icon={Newspaper}
            title={t.nav.linkedinFeed}
            badge={count > 0 ? String(count) : undefined}
          />
          <SimpleItem
            href="/admin/linkedin-leads"
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
