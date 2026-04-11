'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '@/lib/auth-client';
import { getStrategistSidebarData, type StrategistSidebarCompany } from '@/app/actions/content-pipeline';
import { useAuth } from '@/contexts/auth-context';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LayoutDashboard, CalendarDays, ClipboardList, User, ChevronRight, Building2 } from 'lucide-react';

export function StrategistSidebarNav() {
    const { user } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentCompanyId = searchParams.get('companyId');
    const currentTlId = searchParams.get('tlId');
    const [companies, setCompanies] = useState<StrategistSidebarCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const token = await getAuthToken();
                const result = await getStrategistSidebarData(token);
                if (result.companies) {
                    setCompanies(result.companies);
                } else {
                    console.error('Sidebar error:', result.error);
                }
            } catch (error) {
                console.error('Error fetching sidebar data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user?.uid]);

    return (
        <>
            {/* Static top items */}
            <SidebarGroup>
                <SidebarGroupLabel>Estrategista</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname === '/strategist/dashboard'}
                                tooltip="Dashboard"
                            >
                                <Link href="/strategist/dashboard">
                                    <LayoutDashboard />
                                    <span>Dashboard</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname === '/strategist/calendario'}
                                tooltip="Calendário"
                            >
                                <Link href="/strategist/calendario">
                                    <CalendarDays />
                                    <span>Calendário</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            {/* Dynamic company groups */}
            {isLoading ? (
                <SidebarGroup>
                    <SidebarGroupLabel>Empresas</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {[1, 2].map(i => (
                                <SidebarMenuItem key={i}>
                                    <SidebarMenuSkeleton showIcon />
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ) : companies.length === 0 ? (
                <SidebarGroup>
                    <SidebarGroupLabel>Empresas</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <div className="px-4 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                            Nenhuma empresa atribuída.
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            ) : (
                companies.map(company => (
                    <Collapsible key={company.id} defaultOpen className="group/collapsible">
                        <SidebarGroup className="py-0">
                            <SidebarGroupLabel asChild>
                                <CollapsibleTrigger className="flex w-full items-center gap-1 cursor-pointer">
                                    <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    <span className="truncate">{company.name}</span>
                                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={pathname === '/strategist/pipeline' && currentCompanyId === company.id && !currentTlId}
                                                size="sm"
                                            >
                                                <Link href={`/strategist/pipeline?companyId=${company.id}`}>
                                                    <ClipboardList />
                                                    <span>Pipeline</span>
                                                </Link>
                                            </SidebarMenuButton>
                                            {company.tls.length > 0 && (
                                                <SidebarMenuSub>
                                                    {company.tls.map(tl => (
                                                        <SidebarMenuSubItem key={tl.id}>
                                                            <SidebarMenuSubButton
                                                                asChild
                                                                size="sm"
                                                                isActive={pathname === '/strategist/pipeline' && currentTlId === tl.id}
                                                            >
                                                                <Link href={`/strategist/pipeline?companyId=${company.id}&tlId=${tl.id}`}>
                                                                    <User className="h-3 w-3" />
                                                                    <span>{tl.name.split(' ')[0]}</span>
                                                                </Link>
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    ))}
                                                </SidebarMenuSub>
                                            )}
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </CollapsibleContent>
                        </SidebarGroup>
                    </Collapsible>
                ))
            )}
        </>
    );
}
