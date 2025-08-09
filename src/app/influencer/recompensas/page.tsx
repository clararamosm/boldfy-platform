// src/app/influencer/recompensas/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History, Zap, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';


type Reward = {
    id: string;
    title: string;
    points: number;
    imageUrl?: string;
};

type Rescue = {
    id: string;
    title: string;
    date: string;
    status: 'Pendente' | 'Pago';
};

type HistoryItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    date: string;
    points: number;
    type: 'gain' | 'spend';
};

const RewardCard = ({ title, points, imageUrl }: Reward) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                {imageUrl ? <Image src={imageUrl} alt={title} width={300} height={168} className="w-full h-full object-cover" data-ai-hint="reward gift" /> : <Gift className="h-12 w-12 text-muted-foreground" />}
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

const PointHistoryItem = ({ icon, title, date, points, type }: HistoryItem) => (
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

const StatCard = ({ title, value, icon: Icon, isLoading }: {title: string, value: string, icon: React.ElementType, isLoading: boolean}) => (
    <Card>
        <CardHeader>
            <Icon className="h-6 w-6 text-muted-foreground mb-2" />
            <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold font-headline">{value}</p>}
        </CardContent>
    </Card>
);

const PageSkeleton = () => (
    <>
         <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <StatCard title="Pontos Disponíveis" value="0" icon={Zap} isLoading={true} />
            <StatCard title="Pontos Ganhos (Total)" value="0" icon={TrendingUp} isLoading={true} />
            <StatCard title="Pontos Gastos (Total)" value="0" icon={TrendingDown} isLoading={true} />
            <StatCard title="Prêmios Resgatados" value="0" icon={Gift} isLoading={true} />
        </div>
        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="p-0"><Skeleton className="aspect-video rounded-t-lg" /></CardHeader>
                            <CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-3/4" /></CardContent>
                            <CardFooter className="flex justify-between items-center">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-10 w-24" />
                            </CardFooter>
                        </Card>
                    ))}
                 </div>
            </TabsContent>
        </Tabs>
    </>
);

export default function InfluencerRecompensasPage() {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [stats, setStats] = useState({ available: 0, gained: 0, spent: 0, redeemed: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            // Simulate fetching data from Firestore
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            
            const mockRewards: Reward[] = [
                { id: "1", title: "Vale-presente iFood R$50", points: 5000, imageUrl: 'https://placehold.co/300x168.png' },
                { id: "2", title: "Day Off", points: 10000 },
            ];
            const mockRescues: Rescue[] = [
                { id: "r1", title: "Vale-presente iFood R$50", date: "10 de Julho, 2024", status: "Pendente" }
            ];
             const mockHistory: HistoryItem[] = [
                { id: "h1", icon: <PlusCircle className="h-6 w-6 text-green-500" />, title: "Completou Trilha: Onboarding de Novos Influenciadores", date: "15 de Julho, 2024", points: 500, type: "gain" },
                { id: "h2", icon: <PlusCircle className="h-6 w-6 text-green-500" />, title: "Completou Missão: Atualize seu banner do LinkedIn", date: "14 de Julho, 2024", points: 50, type: "gain" },
                { id: "h3", icon: <MinusCircle className="h-6 w-6 text-destructive" />, title: "Resgate: Vale-presente iFood R$50", date: "10 de Julho, 2024", points: 5000, type: "spend" },
            ];
            const mockStats = { available: 1250, gained: 6250, spent: 5000, redeemed: 1 };

            setRewards(mockRewards);
            setRescues(mockRescues);
            setHistory(mockHistory);
            setStats(mockStats);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return (
             <>
                <Header title="Recompensas" />
                <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                    <PageSkeleton />
                </main>
            </>
        )
    }


  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
         <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <StatCard title="Pontos Disponíveis" value={stats.available.toLocaleString()} icon={Zap} isLoading={isLoading} />
            <StatCard title="Pontos Ganhos (Total)" value={stats.gained.toLocaleString()} icon={TrendingUp} isLoading={isLoading} />
            <StatCard title="Pontos Gastos (Total)" value={stats.spent.toLocaleString()} icon={TrendingDown} isLoading={isLoading} />
            <StatCard title="Prêmios Resgatados" value={stats.redeemed.toLocaleString()} icon={Gift} isLoading={isLoading} />
        </div>

        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rewards.length > 0 ? (
                        rewards.map(reward => <RewardCard key={reward.id} {...reward} />)
                    ) : (
                        <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma recompensa disponível no momento.</p>
                    )}
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
                        {rescues.length > 0 ? (
                            rescues.map(rescue => (
                                <div key={rescue.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
                                    <div>
                                        <p className="font-medium">{rescue.title}</p>
                                        <p className="text-sm text-muted-foreground">{rescue.date}</p>
                                    </div>
                                    <Badge variant="destructive">{rescue.status}</Badge>
                                </div>
                            ))
                        ) : (
                           <p className="text-muted-foreground text-center py-8">Você ainda não resgatou nenhuma recompensa.</p>
                        )}
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
                      {history.length > 0 ? (
                        history.map(item => <PointHistoryItem key={item.id} {...item} />)
                      ) : (
                          <p className="text-muted-foreground text-center py-8">Nenhuma transação de pontos registrada.</p>
                      )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
