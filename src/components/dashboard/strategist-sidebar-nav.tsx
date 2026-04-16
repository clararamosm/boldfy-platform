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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LinkedInBadge } from '@/components/ui/linkedin-badge';

export function StrategistSidebarNav() {
    const { user } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentCompanySlug = searchParams.get('c');
    const currentTlSlug = searchParams.get('tl');
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

    const isActive = (path: string, companySlug?: string, tlSlug?: string) => {
        if (pathname !== path) return false;
        if (companySlug && currentCompanySlug !== companySlug) return false;
        if (tlSlug && currentTlSlug !== tlSlug) return false;
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
                                isActive={pathname === '/strategist/calendario' && !currentCompanySlug}
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
                                    {company.logoUrl ? (
                                        <Avatar className="h-4 w-4 shrink-0">
                                            <AvatarImage src={company.logoUrl} alt={company.name} />
                                            <AvatarFallback className="text-[8px]">
                                                {company.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    )}
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
                                                isActive={isActive('/strategist/brand-context', company.slug)}
                                                size="sm"
                                            >
                                                <Link href={`/strategist/brand-context?c=${company.slug}`}>
                                                    <Building2 />
                                                    <span>Brand Context</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>

                                        {/* Pipeline + TL Profiles — only when company has TLs */}
                                        {company.tls.length > 0 && (
                                        <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive('/strategist/pipeline', company.slug) && !currentTlSlug}
                                                size="sm"
                                            >
                                                <Link href={`/strategist/pipeline?c=${company.slug}`}>
                                                    <ClipboardList />
                                                    <span>Pipeline</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>

                                        {company.tls.map(tl => (
                                            <SidebarMenuItem key={tl.id}>
                                                <Collapsible className="group/tl w-full">
                                                    <SidebarMenuButton asChild size="sm">
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
                                                    </SidebarMenuButton>
                                                    <CollapsibleContent>
                                                        <SidebarMenuSub>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/calendario-perfil', company.slug, tl.slug)}
                                                                >
                                                                    <Link href={`/strategist/calendario-perfil?c=${company.slug}&tl=${tl.slug}`}>
                                                                        <CalendarDays className="h-3 w-3" />
                                                                        <span>Calendário</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/manual', company.slug, tl.slug)}
                                                                >
                                                                    <Link href={`/strategist/manual?c=${company.slug}&tl=${tl.slug}`}>
                                                                        <BookOpen className="h-3 w-3" />
                                                                        <span>Manual de Marca</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                            <SidebarMenuSubItem>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    size="sm"
                                                                    isActive={isActive('/strategist/estrategia', company.slug, tl.slug)}
                                                                >
                                                                    <Link href={`/strategist/estrategia?c=${company.slug}&tl=${tl.slug}`}>
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
                                        </>
                                        )}
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
