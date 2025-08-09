// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Gift, CheckCircle } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const companyId = "company-123"; // In a real app, this would come from the user's session

type StatCardProps = {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
};

const StatCard = ({ title, value, description, icon: Icon }: StatCardProps) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold font-headline">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const DashboardSkeleton = () => (
    <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
        <div className="mt-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    </>
);


type Activity = {
    id: string;
    user: string;
    action: string;
    date: string;
};

type DashboardStats = {
    activeCollaborators: number;
    totalLicenses: number;
    engagement: number;
    engagementChange: number;
    rewardsRedeemed: number;
    missionsCompleted: number;
};


export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch stats and activity from Firestore
                const collaboratorsQuery = query(collection(db, "companies", companyId, "collaborators"));
                const collaboratorsSnap = await getDocs(collaboratorsQuery);

                const statsData: DashboardStats = {
                    activeCollaborators: collaboratorsSnap.size,
                    totalLicenses: 50, // This would likely come from the company document
                    engagement: 82, // Placeholder
                    engagementChange: 5, // Placeholder
                    rewardsRedeemed: 12, // Placeholder
                    missionsCompleted: 153, // Placeholder
                };
                
                 const activityQuery = query(collection(db, "companies", companyId, "activity"), orderBy("date", "desc"), limit(5));
                 const activitySnap = await getDocs(activityQuery);
                 const activityData = activitySnap.docs.map(doc => ({id: doc.id, ...doc.data()})) as Activity[];

                setStats(statsData);
                setRecentActivity(activityData);
            } catch (error) {
                console.error("Error fetching dashboard data: ", error);
                toast({
                    variant: 'destructive',
                    title: 'Erro ao carregar dashboard',
                    description: 'Não foi possível buscar os dados do dashboard.',
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [toast]);


    if (isLoading || !stats) {
        return (
             <>
                <Header title="Dashboard" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                   <DashboardSkeleton />
                </main>
            </>
        )
    }

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Colaboradores Ativos" value={`${stats.activeCollaborators} / ${stats.totalLicenses}`} description="Licenças usadas" icon={Users} />
            <StatCard title="Engajamento" value={`${stats.engagement}%`} description={`+${stats.engagementChange}% vs. mês passado`} icon={Trophy} />
            <StatCard title="Recompensas Resgatadas" value={`${stats.rewardsRedeemed}`} description="Este mês" icon={Gift} />
            <StatCard title="Missões Completas" value={`${stats.missionsCompleted}`} description="Esta semana" icon={CheckCircle} />
        </div>
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Atividade Recente</CardTitle>
                <CardDescription>Acompanhe as últimas atividades na plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Ação</TableHead>
                            <TableHead>Data</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentActivity.length > 0 ? (
                            recentActivity.map(activity => (
                                <TableRow key={activity.id}>
                                    <TableCell className="font-medium">{activity.user}</TableCell>
                                    <TableCell>{activity.action}</TableCell>
                                    <TableCell>{new Date(activity.date).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    Nenhuma atividade recente.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </>
  );
}
