// src/app/colaborador/rankings/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Trophy, Gift, Calendar, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect, useCallback } from 'react';
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthToken } from '@/lib/auth-client';
import { getCompanyRanking, type RankedUser } from "@/app/actions";

type UserRanking = RankedUser & {
  isCurrentUser?: boolean;
};

const PodiumCard = ({ rank, user, highlight = false }: { rank: number, user: UserRanking, highlight?: boolean }) => {
  const isZeroPoints = user.points === 0;

  return (
    <Card className={`flex flex-col items-center p-4 text-center ${highlight ? 'bg-secondary' : ''} ${isZeroPoints ? 'opacity-50 grayscale border-gray-300 bg-gray-50' : ''} h-full`}>
      <div className="relative">
        <Avatar className={`w-20 h-20 border-4 ${isZeroPoints ? 'border-gray-300' : 'border-primary'}`}>
          <AvatarImage src={user.avatarUrl} data-ai-hint="person avatar" />
          <AvatarFallback className={isZeroPoints ? 'bg-gray-200 text-gray-400' : ''}>{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {rank === 1 && <Crown className={`absolute -top-3 left-1/2 -translate-x-1/2 h-8 w-8 ${isZeroPoints ? 'text-gray-400' : 'text-yellow-500'}`} />}
      </div>
      <div className="flex flex-col flex-grow justify-center mt-4 items-center">
        <h3 className={`font-semibold text-lg ${isZeroPoints ? 'text-gray-400' : ''}`}>{user.name}</h3>
        <Badge variant="secondary" className={`whitespace-nowrap shrink-0 mt-1 ${isZeroPoints ? 'bg-gray-100 text-gray-400' : 'bg-primary/10 text-primary'}`}>
          <Zap className="h-3 w-3 mr-1"/>
          {user.points.toLocaleString()}
        </Badge>
        <p className={`font-bold text-lg mt-1 ${isZeroPoints ? 'text-gray-400' : ''}`}>{rank}º Lugar</p>
      </div>
    </Card>
  );
};

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

export default function RankingsPage() {
  const [generalRanking, setGeneralRanking] = useState<UserRanking[]>([]);
  const [monthlyPrizeName, setMonthlyPrizeName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const result = await getCompanyRanking(token, userId);

      if (result.error) {
        toast({ variant: 'destructive', title: "Erro", description: result.error });
        setIsLoading(false);
        return;
      }

      // Add isCurrentUser flag
      const rankings: UserRanking[] = result.ranking.map(user => ({
        ...user,
        isCurrentUser: user.id === userId,
      }));

      setGeneralRanking(rankings);
      setMonthlyPrizeName(result.monthlyPrizeName);
    } catch (error) {
      console.error("Erro ao buscar dados do ranking:", error);
      toast({
        variant: 'destructive',
        title: "Erro ao carregar ranking",
        description: "Não foi possível carregar os dados. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCurrentUserId(user.uid);
        fetchData(user.uid);
      } else {
        setCurrentUserId(null);
        setIsLoading(false);
        toast({
          variant: 'destructive',
          title: "Usuário não autenticado",
          description: "Faça login para ver o ranking.",
        });
      }
    });
    return () => unsubscribe();
  }, [fetchData, toast]);

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

  const renderPodium = () => {
    if (top3.length >= 3) {
      return (
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
          <PodiumCard rank={2} user={top3[1]} highlight={top3[1].isCurrentUser} />
          <PodiumCard rank={1} user={top3[0]} highlight={top3[0].isCurrentUser} />
          <PodiumCard rank={3} user={top3[2]} highlight={top3[2].isCurrentUser} />
        </div>
      );
    }

    if (top3.length === 2) {
      return (
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto items-stretch">
          <PodiumCard rank={1} user={top3[0]} highlight={top3[0].isCurrentUser} />
          <PodiumCard rank={2} user={top3[1]} highlight={top3[1].isCurrentUser} />
        </div>
      );
    }

    if (top3.length === 1) {
      return (
        <div className="max-w-sm mx-auto">
          <PodiumCard rank={1} user={top3[0]} highlight={top3[0].isCurrentUser} />
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          Nenhum participante no ranking ainda.
        </CardContent>
      </Card>
    );
  };

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  return (
    <>
      <Header title="Rankings" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Podium Section */}
        {renderPodium()}

        {/* Monthly Prize Section */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-shrink-0 bg-primary/20 text-primary rounded-full h-12 w-12 flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
              <div className="flex-grow text-center sm:text-left">
                <p className="font-bold">
                  Prêmio do Mês: {monthlyPrizeName || 'Prêmio não definido'}
                </p>
                <p className="text-sm text-muted-foreground">O top 1 do ranking este mês ganha esta recompensa.</p>
              </div>
              <div className="w-full sm:w-48 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  <span>{currentDay} de {daysInMonth} dias</span>
                </div>
                <Progress value={(currentDay / daysInMonth) * 100} className="h-2" />
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
                {generalRanking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Nenhum participante no ranking ainda.
                    </TableCell>
                  </TableRow>
                ) : generalRanking.map((user, index) => {
                  const isZeroPoints = user.points === 0;
                  return (
                    <TableRow key={user.id} className={`${user.isCurrentUser ? 'bg-secondary' : ''} ${isZeroPoints ? 'opacity-50' : ''}`}>
                      <TableCell className={`font-medium w-[80px] ${isZeroPoints ? 'text-gray-400' : ''}`}>{index + 1}º</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`h-8 w-8 ${isZeroPoints ? 'grayscale opacity-60' : ''}`}>
                            <AvatarImage src={user.avatarUrl} data-ai-hint="person avatar" />
                            <AvatarFallback className={isZeroPoints ? 'bg-gray-200 text-gray-400' : ''}>{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className={`${user.isCurrentUser ? 'font-bold' : ''} ${isZeroPoints ? 'text-gray-400' : ''}`}>{user.isCurrentUser ? 'Você' : user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className={`whitespace-nowrap shrink-0 ${isZeroPoints ? 'bg-gray-100 text-gray-400' : 'bg-primary/10 text-primary'}`}>
                          <Zap className="h-3 w-3 mr-1"/>
                          {user.points.toLocaleString()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
