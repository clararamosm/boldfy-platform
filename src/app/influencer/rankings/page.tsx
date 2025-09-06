// src/app/influencer/rankings/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Trophy, Gift, Calendar, Zap, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, getDoc, doc, where } from "firebase/firestore";
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type UserRanking = {
    id: string;
    name: string;
    points: number;
    avatarUrl?: string;
    isCurrentUser?: boolean;
};

const PodiumCard = ({ rank, user, highlight = false }: { rank: number, user: UserRanking, highlight?: boolean }) => (
    <Card className={`flex flex-col items-center p-4 text-center ${highlight ? 'bg-secondary' : ''} h-full`}>
        <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-primary">
                <AvatarImage src={user.avatarUrl} data-ai-hint="person avatar" />
                <AvatarFallback>{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {rank === 1 && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500" />}
        </div>
        <div className="flex flex-col flex-grow justify-center mt-4 items-center">
            <h3 className="font-semibold text-lg">{user.name}</h3>
             <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0 mt-1">
                <Zap className="h-3 w-3 mr-1"/>
                {user.points.toLocaleString()}
            </Badge>
            <p className="font-bold text-lg mt-1">{rank}º Lugar</p>
        </div>
    </Card>
);

const PageSkeleton = () => (
    <>
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
            <Skeleton className="h-64" />
            <Skeleton className="h-72" />
            <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-24" />
        <Card>
            <CardHeader>
                <Skeleton className="h-7 w-48" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    </>
);


export default function InfluencerRankingsPage() {
    const { toast } = useToast();
    const [generalRanking, setGeneralRanking] = useState<UserRanking[]>([]);
    const [monthlyPrize, setMonthlyPrize] = useState({ name: 'Prêmio não definido', id: ''});
    const [isLoading, setIsLoading] = useState(true);
    const testUserId = "user-test-influencer";

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
           // MOCK DATA for test mode
            await new Promise(resolve => setTimeout(resolve, 1000));
            const fetchedUsers: UserRanking[] = [
                { id: 'user-1', name: 'Ana Clara', points: 12500, avatarUrl: 'https://picsum.photos/80/80?random=1', isCurrentUser: false },
                { id: testUserId, name: 'Você', points: 11800, avatarUrl: 'https://picsum.photos/80/80?random=2', isCurrentUser: true },
                { id: 'user-3', name: 'Marcos Vilela', points: 10500, avatarUrl: 'https://picsum.photos/80/80?random=3', isCurrentUser: false },
                { id: 'user-4', name: 'Beatriz Costa', points: 9800, avatarUrl: 'https://picsum.photos/80/80?random=4', isCurrentUser: false },
                { id: 'user-5', name: 'Lucas Martins', points: 8200, avatarUrl: 'https://picsum.photos/80/80?random=5', isCurrentUser: false },
            ].sort((a, b) => b.points - a.points);
            
            setGeneralRanking(fetchedUsers);
            setMonthlyPrize({ name: 'Vale-presente iFood R$100', id: 'prize-1' });

        } catch(error) {
            console.error("Error fetching ranking:", error);
            toast({ variant: 'destructive', title: "Erro ao carregar ranking", description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);


    const top3 = generalRanking.slice(0, 3);

    if (isLoading) {
        return (
             <>
                <Header title="Rankings" />
                <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                    <PageSkeleton />
                </main>
            </>
        )
    }

  return (
    <>
      <Header title="Rankings" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        
        {/* Podium Section */}
        {top3.length >= 3 ? (
            <div className="grid gap-4 md:grid-cols-3 items-stretch">
                <PodiumCard rank={2} user={top3[1]} highlight={top3[1].isCurrentUser} />
                <PodiumCard rank={1} user={top3[0]} highlight={top3[0].isCurrentUser} />
                <PodiumCard rank={3} user={top3[2]} highlight={top3[2].isCurrentUser} />
            </div>
        ) : (
             <Card><CardContent className="p-4 text-center text-muted-foreground">O pódio será exibido quando houver pelo menos 3 participantes.</CardContent></Card>
        )}

        {/* Monthly Prize Section */}
        <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-shrink-0 bg-primary/20 text-primary rounded-full h-12 w-12 flex items-center justify-center">
                        <Gift className="h-6 w-6" />
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                        <p className="font-bold">Prêmio do Mês: {monthlyPrize.name}!</p>
                        <p className="text-sm text-muted-foreground">O top 1 do ranking este mês ganha esta recompensa.</p>
                    </div>
                    <div className="w-full sm:w-48 text-center sm:text-right">
                         <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date().getDate()} de {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} dias</span>
                        </div>
                        <Progress value={(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100} className="h-2" />
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* General Ranking Table */}
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    Ranking Geral
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Posição</TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">Pontos</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {generalRanking.map((user, index) => (
                             <TableRow key={user.id} className={user.isCurrentUser ? 'bg-secondary' : ''}>
                                 <TableCell className="font-medium w-[80px]">{index + 1}º</TableCell>
                                 <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatarUrl} data-ai-hint="person avatar" />
                                            <AvatarFallback>{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className={user.isCurrentUser ? 'font-bold' : ''}>{user.isCurrentUser ? 'Você' : user.name}</span>
                                    </div>
                                 </TableCell>
                                 <TableCell className="text-right">
                                     <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                                        <Zap className="h-3 w-3 mr-1"/>
                                        {user.points.toLocaleString()}
                                    </Badge>
                                 </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </>
  );
}
