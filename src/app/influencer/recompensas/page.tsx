// src/app/influencer/recompensas/page.tsx
'use client';

import React from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History, Zap, TrendingUp, TrendingDown, PlusCircle, MinusCircle } from "lucide-react";
import Image from "next/image";

const RewardCard = ({ title, points }) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                <Gift className="h-12 w-12 text-muted-foreground" />
            </div>
        </CardHeader>
        <CardContent className="p-4">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
             <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                <Zap className="h-3 w-3 mr-1"/>
                {points.toLocaleString()}
            </Badge>
            <Button>Resgatar</Button>
        </CardFooter>
    </Card>
);

const PointHistoryItem = ({ icon, title, date, points, type }) => (
     <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{date}</p>
            </div>
        </div>
         <Badge variant="secondary" className={`${type === 'gain' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} whitespace-nowrap shrink-0`}>
            <Zap className="h-3 w-3 mr-1"/>
            {type === 'gain' ? '+' : '-'}{points.toLocaleString()}
        </Badge>
    </div>
);

const StatCard = ({ title, value, icon: Icon }) => (
    <Card>
        <CardHeader>
            <Icon className="h-6 w-6 text-muted-foreground mb-2" />
            <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold font-headline">{value}</p>
        </CardContent>
    </Card>
);

export default function InfluencerRecompensasPage() {
    // Mock data - in a real app, this would come from state managed by useEffect and Firestore
    const rewards = [
        { title: "Vale-presente iFood R$50", points: 5000 },
        { title: "Day Off", points: 10000 },
    ];

    const rescues = [
        { title: "Vale-presente iFood R$50", date: "10 de Julho, 2024", status: "Pendente" }
    ];

    const history = [
        { icon: <PlusCircle className="h-6 w-6 text-green-500" />, title: "Completou Trilha: Onboarding de Novos Influenciadores", date: "15 de Julho, 2024", points: 500, type: "gain" },
        { icon: <PlusCircle className="h-6 w-6 text-green-500" />, title: "Completou Missão: Atualize seu banner do LinkedIn", date: "14 de Julho, 2024", points: 50, type: "gain" },
        { icon: <MinusCircle className="h-6 w-6 text-destructive" />, title: "Resgate: Vale-presente iFood R$50", date: "10 de Julho, 2024", points: 5000, type: "spend" },
    ];

  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
         <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <StatCard title="Pontos Disponíveis" value="1.250" icon={Zap} />
            <StatCard title="Pontos Ganhos (Total)" value="6.250" icon={TrendingUp} />
            <StatCard title="Pontos Gastos (Total)" value="5.000" icon={TrendingDown} />
            <StatCard title="Prêmios Resgatados" value="1" icon={Gift} />
        </div>

        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rewards.map(reward => <RewardCard key={reward.title} {...reward} />)}
                </div>
            </TabsContent>
            <TabsContent value="meus-resgates" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">
                           <History className="h-5 w-5 text-muted-foreground" />
                           Meus Resgates
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {rescues.map(rescue => (
                             <div key={rescue.title} className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
                                <div>
                                    <p className="font-medium">{rescue.title}</p>
                                    <p className="text-sm text-muted-foreground">{rescue.date}</p>
                                </div>
                                <Badge variant="destructive">{rescue.status}</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="historico-pontos" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">
                           <History className="h-5 w-5 text-muted-foreground" />
                           Histórico de Pontos
                        </CardTitle>
                         <CardDescription>Acompanhe aqui seus pontos ganhos e gastos.</CardDescription>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mt-2">
                      {history.map(item => <PointHistoryItem key={item.title} {...item} />)}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
