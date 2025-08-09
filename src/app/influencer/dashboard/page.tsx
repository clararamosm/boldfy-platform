// src/app/influencer/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from '@/components/ui/skeleton';

// Mock data structures - in a real app, these would be imported from a types file
type Mission = {
    id: string;
    title: string;
    points: number;
    href: string;
};

type Trail = {
    id: string;
    title: string;
    progress: number;
    href: string;
};

type DashboardData = {
    points: number;
    pointsThisWeek: number;
    missions: Mission[];
    trails: Trail[];
};


const MissionItem = ({ title, points, href }: Mission) => (
    <Link href={href} className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted transition-colors">
        <span className="font-medium">{title}</span>
        <div className="flex items-center gap-2 text-primary">
            <Zap className="h-4 w-4" />
            <span className="font-bold">{points}</span>
        </div>
    </Link>
);

const TrailItem = ({ title, progress, href }: Trail) => (
    <div>
        <div className="mb-2 flex justify-between items-center">
            <h3 className="font-semibold">{title}</h3>
            <span className="text-sm text-muted-foreground">{progress}% Completo</span>
        </div>
        <Progress value={progress} />
        <Button variant="link" size="sm" className="px-0" asChild>
            <Link href={href}>
                {progress > 0 && progress < 100 ? 'Continuar' : 'Iniciar Trilha'}
                <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
        </Button>
    </div>
);

const DashboardSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
            <CardHeader>
                <CardDescription><Skeleton className="h-4 w-20" /></CardDescription>
                <CardTitle><Skeleton className="h-12 w-32" /></CardTitle>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-4 w-36" />
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-10 w-40" />
            </CardFooter>
        </Card>

        <Card className="md:col-span-2 flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline"><Skeleton className="h-7 w-48" /></CardTitle>
                <CardDescription><Skeleton className="h-4 w-72" /></CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-full" />
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-10 w-44" />
            </CardFooter>
        </Card>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle className="font-headline"><Skeleton className="h-7 w-64" /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-2 w-full" /><Skeleton className="h-6 w-32" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-2 w-full" /><Skeleton className="h-6 w-32" /></div>
            </CardContent>
        </Card>
    </div>
);


export default function InfluencerDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            // Simulate fetching data from Firestore
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock data - replace with actual Firestore call
            const mockData: DashboardData = {
                points: 1250,
                pointsThisWeek: 200,
                missions: [
                    { id: '1', title: "Compartilhar post no LinkedIn", points: 100, href: "/influencer/missoes" },
                ],
                trails: [
                    { id: 'onboarding', title: "Onboarding de Novos Influenciadores", progress: 0, href: "/influencer/trilhas/onboarding" },
                    { id: 'cultura', title: "Cultura da Empresa 101", progress: 75, href: "/influencer/trilhas/cultura" },
                ]
            };
            setData(mockData);
            setIsLoading(false);
        };
        fetchData();
    }, []);


  if (isLoading || !data) {
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
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <CardDescription>Meus Pontos</CardDescription>
              <CardTitle className="font-headline text-5xl">{data.points.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+{data.pointsThisWeek} pontos esta semana</p>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href="/influencer/recompensas">Resgatar Recompensas</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline">Missões da Semana</CardTitle>
              <CardDescription>Complete as missões disponíveis para ganhar pontos.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                {data.missions.length > 0 ? (
                    data.missions.map(mission => <MissionItem key={mission.id} {...mission} />)
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma missão para esta semana.</p>
                )}
            </CardContent>
            <CardFooter>
              <Button variant="secondary" asChild>
                <Link href="/influencer/missoes">Ver Todas as Missões</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="font-headline">Trilhas de Aprendizagem Ativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {data.trails.length > 0 ? (
                    data.trails.map(trail => <TrailItem key={trail.id} {...trail} />)
                ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">Nenhuma trilha de aprendizagem ativa.</p>
                )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

    