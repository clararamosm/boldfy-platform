// src/app/master/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, BookOpen, Globe, LogIn, Loader2 } from "lucide-react";
import Link from "next/link";

type Company = {
    id: string;
    name: string;
    status: 'Ativa' | 'Inativa';
    licensesUsed: number;
    licensesTotal: number;
    adminEmail: string;
};

type MasterStats = {
    activeCompanies: number;
    totalCollaborators: number;
    globalTrails: number;
    avgEngagement: number;
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
    const [stats, setStats] = useState<MasterStats | null>(null);
    const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, this would be fetched and aggregated from Firestore
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                const mockStats: MasterStats = {
                    activeCompanies: 15,
                    totalCollaborators: 852,
                    globalTrails: 5,
                    avgEngagement: 78,
                };

                const mockCompanies: Company[] = [
                     { id: "1", name: "Innovate Inc.", status: "Ativa", licensesUsed: 45, licensesTotal: 50, adminEmail: "admin.innovate@example.com" },
                     { id: "2", name: "TechCorp", status: "Ativa", licensesUsed: 100, licensesTotal: 100, adminEmail: "admin.techcorp@example.com" },
                ];
                
                setStats(mockStats);
                setRecentCompanies(mockCompanies);
            } catch (error) {
                console.error("Error fetching master data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

  return (
    <>
      <Header title="Master Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
           <StatCard title="Empresas Ativas" value={stats?.activeCompanies.toString() || '0'} description="+2 novas este mês" icon={Building2} isLoading={isLoading} />
           <StatCard title="Colaboradores Totais" value={stats?.totalCollaborators.toString() || '0'} description="Em todas as empresas" icon={Users} isLoading={isLoading} />
           <StatCard title="Trilhas Globais" value={stats?.globalTrails.toString() || '0'} description="Conteúdos disponíveis" icon={Globe} isLoading={isLoading} />
           <StatCard title="Engajamento Médio" value={`${stats?.avgEngagement || 0}%`} description="Atividade na plataforma" icon={BookOpen} isLoading={isLoading} />
        </div>
         <Card>
          <CardHeader>
            <CardTitle>Empresas Recentes</CardTitle>
            <CardDescription>
              As últimas empresas que se juntaram à plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Licenças</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead><span className="sr-only">Ações</span></TableHead>
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
                    ) : (
                        recentCompanies.map(company => (
                             <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.name}</TableCell>
                                <TableCell><Badge variant={company.status === 'Ativa' ? 'default' : 'destructive'}>{company.status}</Badge></TableCell>
                                <TableCell>{company.licensesUsed} / {company.licensesTotal}</TableCell>
                                <TableCell>{company.adminEmail}</TableCell>
                                <TableCell>
                                    <Button variant="outline" size="sm" asChild>
                                       <Link href="/admin/dashboard"><LogIn className="mr-2 h-4 w-4" />Visualizar</Link>
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
