// src/app/master/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, BookOpen, Globe, LogIn, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useT } from '@/lib/i18n/context';


type Company = {
    id: string;
    companyName: string;
    status: 'Ativa' | 'Inativa';
    licenses: number;
    adminProfile: { email: string };
    createdAt?: any;
};

type MasterStats = {
    activeCompanies: number;
    totalCollaborators: number;
    globalTrails: number;
    avgEngagement: number; // Placeholder
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

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch companies
                const companiesQuery = query(collection(db, "companies"), orderBy("createdAt", "desc"), limit(5));
                const companiesSnap = await getDocs(companiesQuery);
                const companiesList = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Company[];
                
                const allCompaniesSnap = await getDocs(collection(db, "companies"));


                // Fetch users to calculate total collaborators
                const usersQuery = collection(db, "users");
                const usersSnap = await getDocs(usersQuery);
                const collaboratorsCount = usersSnap.size;

                const mockStats: MasterStats = {
                    activeCompanies: allCompaniesSnap.docs.filter(c => c.data().status === 'Ativa').length,
                    totalCollaborators: collaboratorsCount,
                    globalTrails: 5, // Placeholder, would be fetched from a 'global-trails' collection
                    avgEngagement: 78, // Placeholder
                };
                
                setStats(mockStats);
                setRecentCompanies(companiesList); 
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
           <StatCard title={t.masterDashboard.avgEngagement} value={`${stats?.avgEngagement || 0}%`} description={t.masterDashboard.avgEngagementDescription} icon={BookOpen} isLoading={isLoading} />
        </div>
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
