
// src/app/influencer/recompensas/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History, Zap, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ActionDialog } from '@/components/dashboard/action-dialog';

const companyId = "company-123";
const userId = "user-123"; // In a real app, this comes from auth session

type Reward = {
    id: string;
    title: string;
    name: string;
    points: number;
    imageUrl?: string;
    stock: number | 'Ilimitado';
};

type Rescue = {
    id: string;
    rewardName: string;
    date: any;
    status: 'Pendente' | 'Pago';
};

type HistoryItem = {
    id: string;
    icon: React.ReactNode;
    description: string;
    date: any;
    points: number;
    type: 'gain' | 'spend';
};

const RewardCard = ({ reward, onRedeem, disabled }: { reward: Reward, onRedeem: () => void, disabled: boolean }) => (
     <ActionDialog
        title={`Resgatar ${reward.name}?`}
        description={`Isso custará ${reward.points.toLocaleString()} pontos. Esta ação não pode ser desfeita.`}
        trigger={
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="p-0">
                    <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                        {reward.imageUrl ? <Image src={reward.imageUrl} alt={reward.name} width={300} height={168} className="w-full h-full object-cover" data-ai-hint="reward gift" /> : <Gift className="h-12 w-12 text-muted-foreground" />}
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <CardTitle className="text-base font-semibold">{reward.name}</CardTitle>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                    <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                        <Zap className="h-3 w-3 mr-1"/>
                        {reward.points.toLocaleString()}
                    </Badge>
                    <Button size="sm" disabled={disabled}>
                       {disabled ? 'Pontos insuficientes' : 'Resgatar'}
                    </Button>
                </CardFooter>
            </Card>
        }
        actionText="Confirmar Resgate"
        onAction={onRedeem}
    >
       <p>Você tem certeza que quer resgatar esta recompensa?</p>
    </ActionDialog>
);

const PointHistoryItem = ({ icon, description, date, points, type }: HistoryItem) => (
     <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <p className="font-medium">{description}</p>
                <p className="text-sm text-muted-foreground">{date?.toDate().toLocaleDateString()}</p>
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
    const { toast } = useToast();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [stats, setStats] = useState({ available: 0, gained: 0, spent: 0, redeemed: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Rewards
            const rewardsQuery = query(collection(db, "companies", companyId, "rewards"), where("status", "==", "Disponível"));
            const rewardsSnap = await getDocs(rewardsQuery);
            const rewardsList = rewardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
            setRewards(rewardsList);
            
            // Fetch user data (points)
            const userDocRef = doc(db, "users", userId);
            const userSnap = await getDoc(userDocRef);
            const userData = userSnap.data();

            // Fetch Rescues for the user
            const rescuesQuery = query(collection(db, "companies", companyId, "rescues"), where("userId", "==", userId));
            const rescuesSnap = await getDocs(rescuesQuery);
            const rescuesList = rescuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rescue));
            setRescues(rescuesList);

            // Fetch History for the user
            const historyQuery = query(collection(db, "users", userId, "pointHistory"));
            const historySnap = await getDocs(historyQuery);
            const historyList = historySnap.docs.map(doc => {
                 const data = doc.data() as Omit<HistoryItem, 'id' | 'icon'>;
                 return {
                    id: doc.id,
                    ...data,
                    icon: data.type === 'gain' ? <PlusCircle className="h-6 w-6 text-green-500" /> : <MinusCircle className="h-6 w-6 text-destructive" />
                 } as HistoryItem
            });
            setHistory(historyList);
            
            // Calculate stats
            const gained = historyList.filter(h => h.type === 'gain').reduce((acc, h) => acc + h.points, 0);
            const spent = historyList.filter(h => h.type === 'spend').reduce((acc, h) => acc + h.points, 0);

            setStats({
                available: userData?.points || 0,
                gained,
                spent,
                redeemed: rescuesList.length
            });

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Erro ao carregar dados." });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);
    
    const handleRedeem = async (reward: Reward) => {
        if (stats.available < reward.points) {
            toast({ variant: 'destructive', title: "Pontos insuficientes!" });
            return;
        }

        try {
            const batch = writeBatch(db);

            // 1. Create a rescue document
            const rescueRef = doc(collection(db, "companies", companyId, "rescues"));
            batch.set(rescueRef, {
                userId,
                userName: "Você", // In real app, get from user profile
                rewardId: reward.id,
                rewardName: reward.name,
                date: serverTimestamp(),
                status: 'Pendente'
            });

            // 2. Decrement user points
            const userRef = doc(db, "users", userId);
            batch.update(userRef, { points: stats.available - reward.points });

            // 3. Add to point history
            const historyRef = doc(collection(db, "users", userId, "pointHistory"));
            batch.set(historyRef, {
                type: 'spend',
                points: reward.points,
                description: `Resgate: ${reward.name}`,
                date: serverTimestamp()
            });

            // 4. (Optional) Decrement stock if not unlimited
            if (reward.stock !== 'Ilimitado') {
                const rewardRef = doc(db, "companies", companyId, "rewards", reward.id);
                batch.update(rewardRef, { stock: reward.stock - 1 });
            }

            await batch.commit();

            toast({ title: "Recompensa resgatada com sucesso!" });
            fetchData(); // Refresh all data

        } catch (error) {
            console.error("Error redeeming reward: ", error);
            toast({ variant: 'destructive', title: "Erro ao resgatar recompensa." });
        }
    }


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
                        rewards.map(reward => <RewardCard key={reward.id} reward={reward} onRedeem={() => handleRedeem(reward)} disabled={stats.available < reward.points} />)
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
                                        <p className="font-medium">{rescue.rewardName}</p>
                                        <p className="text-sm text-muted-foreground">{rescue.date?.toDate().toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant={rescue.status === 'Pendente' ? 'destructive' : 'default'} className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}>{rescue.status}</Badge>
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
