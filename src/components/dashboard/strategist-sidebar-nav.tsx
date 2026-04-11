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
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    User,
    ChevronRight,
    Building2,
    BookOpen,
    FileText,
} from 'lucide-react';

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

    const isActive = (path: string, companyId?: string, tlId?: string) => {
        if (pathname !== path) return false;
        if (companyId && currentCompanyId !== companyId) return false;
        if (tlId && currentTlId !== tlId) return false;
        return true;
    };

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
                                isActive={pathname === '/strategist/calendario' && !currentCompanyId}
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
                    <Collapsible key={company.id} defaultOpen className="group/company">
                        <SidebarGroup className="py-0">
                            <SidebarGroupLabel asChild>
                                <CollapsibleTrigger className="flex w-full items-center gap-1 cursor-pointer">
                                    <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    <span className="truncate">{company.name}</span>
                                    <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/company:rotate-90" />
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {/* Brand Context */}
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive('/strategist/brand-context', company.id)}
                                                size="sm"
                                            >
                                                <Link href={`/strategist/brand-context?companyId=${company.id}`}>
                                                    <Building2 />
                                                    <span>Brand Context</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>

                                        {/* Pipeline */}
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive('/strategist/pipeline', company.id) && !currentTlId}
                                                size="sm"
                                            >
                                                <Link href={`/strategist/pipeline?companyId=${company.id}`}>
                                                    <ClipboardList />
                                                    <span>Pipeline</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>

                                        {/* TL Profiles */}
                                        {company.tls.map(tl => (
                                            <SidebarMenuItem key={tl.id}>
                                                <Collapsible className="group/tl w-full">
                                                    <SidebarMenuButton asChild size="sm">
                                                        <CollapsibleTrigger className="flex w-full items-center gap-2 cursor-pointer">
                                                            <User className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="truncate">{tl.name.split(' ')[0]}</span>
                                                            <ChevronRight className="ml-auto h-3 w-3 shrink-0 transition-transform group-data-[state=open]/tl:rotate-90" />
                                                        </CollapsibleTrigger>
                                                    </SidebarMenuButton>
                                                    <CollapsibleContent>
                                                        <SidebarMenuSub>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/calendario-perfil', company.id, tl.id)}
                                                                >
                                                                    <Link href={`/strategist/calendario-perfil?companyId=${company.id}&tlId=${tl.id}&tlName=${encodeURIComponent(tl.name)}`}>
                                                                        <CalendarDays className="h-3 w-3" />
                                                                        <span>Calendário</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/manual', company.id, tl.id)}
                                                                >
                                                                    <Link href={`/strategist/manual?companyId=${company.id}&tlId=${tl.id}`}>
                                                                        <BookOpen className="h-3 w-3" />
                                                                        <span>Manual de Marca</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/estrategia', company.id, tl.id)}
                                                                >
                                                                    <Link href={`/strategist/estrategia?companyId=${company.id}&tlId=${tl.id}`}>
                                                                        <FileText className="h-3 w-3" />
                                                                        <span>Estratégia</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        </SidebarMenuSub>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </SidebarMenuItem>
                                        ))}
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
