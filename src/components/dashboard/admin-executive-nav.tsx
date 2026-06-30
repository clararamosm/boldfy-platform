'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '@/lib/auth-client';
import { getAdminExecutiveData, type AdminExecutiveTL } from '@/app/actions/content-pipeline';
import { useAuth } from '@/contexts/auth-context';
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  ClipboardList,
  CalendarDays,
  BarChart2,
  User,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LinkedInBadge } from '@/components/ui/linkedin-badge';
import { cn } from '@/lib/utils';

export function AdminExecutiveNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTlSlug = searchParams.get('tl');

  const [tls, setTls] = useState<AdminExecutiveTL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const result = await getAdminExecutiveData(token);
        if (result.tls) {
          setTls(result.tls);
        } else if (result.error) {
          console.error('Executive nav error:', result.error);
        }
      } catch (error) {
        console.error('Error fetching executive nav data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.uid]);

  // Active state considers pathname + ?tl= search param.
  const isActive = (path: string, tlSlug?: string) => {
    if (pathname !== path) return false;
    if (tlSlug) return currentTlSlug === tlSlug;
    // Top-level (consolidado) items are only active when no ?tl= is present.
    return !currentTlSlug;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="font-medium text-muted-foreground hover:text-foreground">
            <Users className="h-4 w-4" />
            <span className="flex-1">Modo Executivo</span>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {/* Backlog consolidado */}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                asChild
                isActive={isActive('/admin/modo-executivo/backlog')}
              >
                <Link href="/admin/modo-executivo/backlog">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Backlog</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>

            {/* Calendário geral */}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                asChild
                isActive={isActive('/admin/modo-executivo/calendario')}
              >
                <Link href="/admin/modo-executivo/calendario">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Calendário</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>

            {/* Loading skeleton */}
            {isLoading && (
              <>
                {[1, 2].map(i => (
                  <SidebarMenuSubItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuSubItem>
                ))}
              </>
            )}

            {/* One collapsible per executive */}
            {!isLoading && tls.map(tl => (
              <SidebarMenuSubItem key={tl.id}>
                <Collapsible className="group/tl w-full">
                  <SidebarMenuSubButton asChild>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 cursor-pointer">
                      {tl.photoUrl ? (
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={tl.photoUrl} alt={tl.name} />
                          <AvatarFallback className="text-[8px]">
                            {tl.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <User className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{tl.name.split(' ')[0]}</span>
                      {tl.linkedinConnected && <LinkedInBadge />}
                      <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/tl:rotate-90" />
                    </CollapsibleTrigger>
                  </SidebarMenuSubButton>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          size="sm"
                          isActive={isActive('/admin/modo-executivo/calendario', tl.slug)}
                        >
                          <Link href={`/admin/modo-executivo/calendario?tl=${tl.slug}`}>
                            <CalendarDays className="h-3 w-3" />
                            <span>Calendário</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          size="sm"
                          isActive={isActive('/admin/modo-executivo/analytics', tl.slug)}
                        >
                          <Link href={`/admin/modo-executivo/analytics?tl=${tl.slug}`}>
                            <BarChart2 className="h-3 w-3" />
                            <span>Analytics</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
