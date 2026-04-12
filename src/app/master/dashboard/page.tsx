// src/app/master/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, BookOpen, Globe, LogIn, Loader2, Wrench } from "lucide-react";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';


type Company = {
    id: string;
    companyName: string;
    status: 'Ativa' | 'Inativa' | 'Trial';
    licenses: number;
    adminProfile: { email: string };
    createdAt?: { toDate?: () => Date } | string | null;
    activeSeats?: number;
};

type MasterStats = {
    activeCompanies: number;
    totalCollaborators: number;
    globalTrails: number;
    activeCollaborators: number;
};

const StatCard = ({ title, value, description, icon: Icon, isLoading }: { title: string, value: string, description: string, icon: React.ElementType, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
            ) : (
                <div className="text-2xl font-bold font-headline">{value}</div>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function MasterDashboardPage() {
    const t = useT();
    const [stats, setStats] = useState<MasterStats | null>(null);
    const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isMigrating, setIsMigrating] = useState(false);

    const handleMigrateSlugs = async () => {
      setIsMigrating(true);
      try {
        const token = await getAuthToken();
        const res = await fetch('/api/migrate-slugs', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: `Migração concluída! ${data.companiesMigrated} empresas, ${data.tlMigrated} TLs.` });
        } else {
          toast({ variant: 'destructive', title: 'Erro', description: data.error });
        }
      } catch {
        toast({ variant: 'destructive', title: 'Erro na migração.' });
      } finally {
        setIsMigrating(false);
      }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch all companies
                const allCompaniesSnap = await getDocs(collection(db, "companies"));
                const allCompanies = allCompaniesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Company[];

                // Fetch all collaborators (role=colaborador)
                const collabQuery = query(collection(db, "users"), where("role", "==", "colaborador"));
                const collabSnap = await getDocs(collabQuery);

                // Build per-company seat counts
                const seatCounts: Record<string, number> = {};
                collabSnap.docs.forEach(d => {
                    const cId = d.data().companyId;
                    if (cId) seatCounts[cId] = (seatCounts[cId] || 0) + 1;
                });

                // Count active collaborators (status === 'Ativo')
                const activeCollabCount = collabSnap.docs.filter(d => d.data().status === 'Ativo').length;

                // Fetch global trail count (sum trails across all globalSessions)
                const sessionsSnap = await getDocs(collection(db, "globalSessions"));
                let totalGlobalTrails = 0;
                for (const sess of sessionsSnap.docs) {
                    const trailsSnap = await getDocs(collection(db, `globalSessions/${sess.id}/trails`));
                    totalGlobalTrails += trailsSnap.size;
                }

                // Recent companies (sorted desc by createdAt, top 5)
                const sorted = [...allCompanies].sort((a, b) => {
                    const da = a.createdAt && typeof a.createdAt === 'object' && a.createdAt !== null && 'toDate' in a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt as string || 0);
                    const db2 = b.createdAt && typeof b.createdAt === 'object' && b.createdAt !== null && 'toDate' in b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt as string || 0);
                    return db2.getTime() - da.getTime();
                });

                setRecentCompanies(sorted.slice(0, 5).map(c => ({
                    ...c,
                    activeSeats: seatCounts[c.id] || 0,
                })));

                setStats({
                    activeCompanies: allCompanies.filter(c => c.status === 'Ativa' || c.status === 'Trial').length,
                    totalCollaborators: collabSnap.size,
                    globalTrails: totalGlobalTrails,
                    activeCollaborators: activeCollabCount,
                });
            } catch (error) {
                console.error("Error fetching master data:", error);
                toast({ variant: 'destructive', title: t.masterDashboard.fetchError });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast]);

  return (
    <>
      <Header title={t.masterDashboard.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
           <StatCard title={t.masterDashboard.activeCompanies} value={stats?.activeCompanies.toString() || '0'} description={t.masterDashboard.activeCompaniesDescription} icon={Building2} isLoading={isLoading} />
           <StatCard title={t.masterDashboard.totalCollaborators} value={stats?.totalCollaborators.toString() || '0'} description={t.masterDashboard.totalCollaboratorsDescription} icon={Users} isLoading={isLoading} />
           <StatCard title={t.masterDashboard.globalTrails} value={stats?.globalTrails.toString() || '0'} description={t.masterDashboard.globalTrailsDescription} icon={Globe} isLoading={isLoading} />
           <StatCard title={t.masterDashboard.avgEngagement} value={stats?.activeCollaborators.toString() || '0'} description={t.masterDashboard.avgEngagementDescription} icon={BookOpen} isLoading={isLoading} />
        </div>

        {/* One-time migration button */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">Migrar Slugs</p>
              <p className="text-xs text-muted-foreground">Adiciona slugs para URLs limpas em empresas e TLs existentes.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleMigrateSlugs} disabled={isMigrating}>
              {isMigrating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wrench className="h-4 w-4 mr-1" />}
              {isMigrating ? 'Migrando...' : 'Migrar'}
            </Button>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle>{t.masterDashboard.recentCompanies}</CardTitle>
            <CardDescription>
              {t.masterDashboard.recentCompaniesDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.masterCompanies.tableCompany}</TableHead>
                        <TableHead>{t.masterCompanies.tableStatus}</TableHead>
                        <TableHead>{t.masterCompanies.tableLicenses}</TableHead>
                        <TableHead>{t.masterCompanies.tableAdmin}</TableHead>
                        <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando empresas...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : recentCompanies.length === 0 ? (
                         <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">Nenhuma empresa encontrada.</TableCell>
                        </TableRow>
                    ) : (
                        recentCompanies.map(company => (
                             <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.companyName}</TableCell>
                                <TableCell><Badge variant={company.status === 'Ativa' ? 'default' : 'destructive'}>{company.status}</Badge></TableCell>
                                <TableCell>0 / {company.licenses}</TableCell>
                                <TableCell>{company.adminProfile?.email}</TableCell>
                                <TableCell>
                                    <Button variant="outline" size="sm" asChild>
                                       <Link href={`/admin/dashboard?companyId=${company.id}`}><LogIn className="mr-2 h-4 w-4" />Visualizar</Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
