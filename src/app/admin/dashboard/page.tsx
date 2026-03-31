// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, limit, orderBy, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Gift, CheckCircle, Target, BookOpen, TrendingUp, Zap } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Colaboradores Ativos" value="" description="" icon={Users} isLoading={true} />
      <StatCard title="Missões Ativas" value="" description="" icon={Target} isLoading={true} />
      <StatCard title="Trilhas" value="" description="" icon={BookOpen} isLoading={true} />
      <StatCard title="Recompensas" value="" description="" icon={Gift} isLoading={true} />
    </div>
    <div className="grid gap-6 md:grid-cols-2 mt-6">
      <Card>
        <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
    </div>
  </>
);

type TopCollaborator = {
  id: string;
  name: string;
  points: number;
};

type DashboardStats = {
  activeCollaborators: number;
  totalLicenses: number;
  activeMissions: number;
  totalMissions: number;
  completedMissions: number;
  activeTrails: number;
  totalTrails: number;
  totalRewards: number;
  totalPointsDistributed: number;
  engagedCollaborators: number;
  topCollaborators: TopCollaborator[];
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async (companyId: string) => {
    setIsLoading(true);
    try {
      const companyDocRef = doc(db, "companies", companyId);
      const companySnap = await getDoc(companyDocRef);
      const companyData = companySnap.data();

      // Parallel fetch all data
      const [collaboratorsSnap, missionsSnap, trailsSnap, rewardsSnap] = await Promise.all([
        getDocs(query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "==", "influencer")
        )),
        getDocs(collection(db, "companies", companyId, "missions")),
        getDocs(collection(db, "companies", companyId, "trails")),
        getDocs(collection(db, "companies", companyId, "rewards"))
      ]);

      // Process collaborators
      const activeCollaboratorsCount = collaboratorsSnap.size;
      let totalPointsDistributed = 0;
      let engagedCount = 0;
      const collaboratorsList: TopCollaborator[] = [];

      collaboratorsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const points = data.points || 0;
        totalPointsDistributed += points;
        if (points > 0) engagedCount++;
        collaboratorsList.push({
          id: docSnap.id,
          name: data.name || 'Sem nome',
          points
        });
      });

      // Sort by points descending and take top 5
      collaboratorsList.sort((a, b) => b.points - a.points);
      const topCollaborators = collaboratorsList.slice(0, 5);

      // Process missions
      let activeMissions = 0;
      let completedMissions = 0;
      missionsSnap.docs.forEach(docSnap => {
        const status = docSnap.data().status;
        if (status === 'Ativa' || status === 'Fixa' || status === 'Agendada') activeMissions++;
        if (status === 'Concluida' || status === 'Completa') completedMissions++;
      });

      // Process trails
      const activeTrails = trailsSnap.docs.filter(d => d.data().active === true).length;

      setStats({
        activeCollaborators: activeCollaboratorsCount,
        totalLicenses: companyData?.licenses || 0,
        activeMissions,
        totalMissions: missionsSnap.size,
        completedMissions,
        activeTrails,
        totalTrails: trailsSnap.size,
        totalRewards: rewardsSnap.size,
        totalPointsDistributed,
        engagedCollaborators: engagedCount,
        topCollaborators
      });
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

  const engagementRate = stats.activeCollaborators > 0
    ? Math.round((stats.engagedCollaborators / stats.activeCollaborators) * 100)
    : 0;

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Colaboradores"
            value={`${stats.activeCollaborators} / ${stats.totalLicenses}`}
            description="Licenças utilizadas"
            icon={Users}
            isLoading={false}
          />
          <StatCard
            title="Missões Ativas"
            value={`${stats.activeMissions}`}
            description={`${stats.totalMissions} total · ${stats.completedMissions} concluídas`}
            icon={Target}
            isLoading={false}
          />
          <StatCard
            title="Trilhas"
            value={`${stats.activeTrails}`}
            description={`${stats.totalTrails} total criadas`}
            icon={BookOpen}
            isLoading={false}
          />
          <StatCard
            title="Recompensas"
            value={`${stats.totalRewards}`}
            description="Cadastradas no catálogo"
            icon={Gift}
            isLoading={false}
          />
        </div>

        {/* Engagement + Points Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Engajamento
              </CardTitle>
              <CardDescription>
                Colaboradores com atividade (pontos {'>'} 0)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{engagementRate}%</span>
                <span className="text-sm text-muted-foreground">
                  {stats.engagedCollaborators} de {stats.activeCollaborators} colaboradores
                </span>
              </div>
              <Progress value={engagementRate} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">Total de pontos distribuídos</span>
                </div>
                <span className="font-bold">{stats.totalPointsDistributed.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Top Collaborators */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                Top Colaboradores
              </CardTitle>
              <CardDescription>
                Ranking por pontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topCollaborators.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhum colaborador com pontos ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.topCollaborators.map((collab, index) => (
                    <div key={collab.id} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5">
                        {index + 1}º
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {collab.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collab.name}</p>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0">
                        <Zap className="h-3 w-3 mr-1" /> {collab.points.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Platform Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Resumo da Plataforma</CardTitle>
            <CardDescription>Visão geral dos recursos configurados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead className="text-center">Ativos</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" /> Missões
                  </TableCell>
                  <TableCell className="text-center">{stats.activeMissions}</TableCell>
                  <TableCell className="text-center">{stats.totalMissions}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={stats.activeMissions > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                      {stats.activeMissions > 0 ? 'Ativo' : 'Nenhuma ativa'}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" /> Trilhas
                  </TableCell>
                  <TableCell className="text-center">{stats.activeTrails}</TableCell>
                  <TableCell className="text-center">{stats.totalTrails}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={stats.activeTrails > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                      {stats.activeTrails > 0 ? 'Ativo' : 'Nenhuma ativa'}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Gift className="h-4 w-4 text-purple-500" /> Recompensas
                  </TableCell>
                  <TableCell className="text-center">{stats.totalRewards}</TableCell>
                  <TableCell className="text-center">{stats.totalRewards}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={stats.totalRewards > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                      {stats.totalRewards > 0 ? 'Configurado' : 'Nenhuma'}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" /> Colaboradores
                  </TableCell>
                  <TableCell className="text-center">{stats.activeCollaborators}</TableCell>
                  <TableCell className="text-center">{stats.totalLicenses}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={stats.activeCollaborators > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                      {stats.activeCollaborators > 0 ? `${Math.round((stats.activeCollaborators / Math.max(stats.totalLicenses, 1)) * 100)}% usado` : 'Nenhum'}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
