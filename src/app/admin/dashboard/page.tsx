// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, limit, orderBy, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Gift, CheckCircle } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type StatCardProps = {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
    isLoading: boolean;
};

const StatCard = ({ title, value, description, icon: Icon, isLoading }: StatCardProps) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <Skeleton className="h-8 w-16 mt-1" />
            ) : (
                <div className="text-2xl font-bold font-headline">{value}</div>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const DashboardSkeleton = () => (
    <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Colaboradores Ativos" value="" description="" icon={Users} isLoading={true} />
            <StatCard title="Engajamento" value="" description="" icon={Trophy} isLoading={true} />
            <StatCard title="Recompensas Resgatadas" value="" description="" icon={Gift} isLoading={true} />
            <StatCard title="Missões Completas" value="" description="" icon={CheckCircle} isLoading={true} />
        </div>
        <div className="mt-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    </>
);


type Activity = {
    id: string;
    user: string;
    action: string;
    date: any;
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

    const fetchData = useCallback(async (companyId: string) => {
        setIsLoading(true);
        try {
            const companyDocRef = doc(db, "companies", companyId);
            const companySnap = await getDoc(companyDocRef);
            const companyData = companySnap.data();

            // Fetch collaborators from the root 'users' collection
            const collaboratorsQuery = query(
                collection(db, "users"), 
                where("companyId", "==", companyId), 
                where("role", "==", "influencer")
            );
            const collaboratorsSnap = await getDocs(collaboratorsQuery);
            const activeCollaboratorsCount = collaboratorsSnap.size;

            // Fetch activity from a subcollection in the company document
            const activityQuery = query(collection(companyDocRef, "activity"), orderBy("date", "desc"), limit(5));
            const activitySnap = await getDocs(activityQuery);
            const activityData = activitySnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            })) as Activity[];

            const statsData: DashboardStats = {
                activeCollaborators: activeCollaboratorsCount,
                totalLicenses: companyData?.licenses || 0,
                // Replace these with real data aggregations later
                engagement: 82, 
                engagementChange: 5,
                rewardsRedeemed: 12,
                missionsCompleted: 153, 
            };
            
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
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const companyId = userDocSnap.data().companyId;
                    fetchData(companyId);
                } else {
                    toast({ variant: "destructive", title: "Usuário não encontrado" });
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchData, toast]);


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
            <StatCard title="Colaboradores Ativos" value={`${stats.activeCollaborators} / ${stats.totalLicenses}`} description="Licenças usadas" icon={Users} isLoading={isLoading} />
            <StatCard title="Engajamento" value={`${stats.engagement}%`} description={`+${stats.engagementChange}% vs. mês passado`} icon={Trophy} isLoading={isLoading} />
            <StatCard title="Recompensas Resgatadas" value={`${stats.rewardsRedeemed}`} description="Este mês" icon={Gift} isLoading={isLoading} />
            <StatCard title="Missões Completas" value={`${stats.missionsCompleted}`} description="Esta semana" icon={CheckCircle} isLoading={isLoading} />
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
                                    <TableCell>{activity.date?.toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="text-center py-8">
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
