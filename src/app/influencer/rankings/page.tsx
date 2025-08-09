// src/app/influencer/rankings/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Trophy, Gift, BookOpen, Zap, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect } from 'react';


type UserRanking = {
    id: string;
    name: string;
    points: number;
    avatarUrl?: string;
    isCurrentUser?: boolean;
}

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


export default function InfluencerRankingsPage() {
    // In a real app, this data would be fetched and managed in state.
    const [generalRanking, setGeneralRanking] = useState<UserRanking[]>([]);
    const [missionRanking, setMissionRanking] = useState<UserRanking[]>([]);
    const [trailRanking, setTrailRanking] = useState<UserRanking[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            // Mock data simulating a fetch from Firestore
            const mockUsers: UserRanking[] = [
                { id: '1', name: 'Carla Costa', points: 1250, avatarUrl: "https://placehold.co/80x80.png" },
                { id: '2', name: 'João Paulo', points: 890, avatarUrl: "https://placehold.co/80x80.png" },
                { id: '3', name: 'Você', points: 750, avatarUrl: "https://placehold.co/80x80.png", isCurrentUser: true },
                { id: '4', name: 'Ricardo Mendes', points: 620, avatarUrl: "https://placehold.co/80x80.png" },
            ];

            // Here you would sort and slice for each ranking type
            setGeneralRanking(mockUsers.sort((a, b) => b.points - a.points));
            
            // For demo purposes, we'll shuffle the points for other rankings
            setMissionRanking([...mockUsers].sort((a, b) => b.points - a.points / 2));
            setTrailRanking([...mockUsers].sort((a, b) => b.points - a.points * 1.5));
            
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const top3 = generalRanking.slice(0, 3);
    const currentUser = generalRanking.find(u => u.isCurrentUser);

  return (
    <>
      <Header title="Rankings" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        
        {/* Podium Section */}
        {top3.length >= 3 && (
            <div className="grid gap-4 md:grid-cols-3 items-stretch">
                <PodiumCard rank={2} user={top3[1]} />
                <PodiumCard rank={1} user={top3[0]} />
                <PodiumCard rank={3} user={top3[2]} highlight={top3[2].isCurrentUser} />
            </div>
        )}

        {/* Monthly Prize Section */}
        <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-shrink-0 bg-primary/20 text-primary rounded-full h-12 w-12 flex items-center justify-center">
                        <Gift className="h-6 w-6" />
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                        <p className="font-bold">Prêmio de Agosto: Day Off!</p>
                        <p className="text-sm text-muted-foreground">O top 1 do ranking este mês ganha um dia de folga.</p>
                    </div>
                    <div className="w-full sm:w-48 text-center sm:text-right">
                         <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>15 de 31 dias</span>
                        </div>
                        <Progress value={(15/31) * 100} className="h-2" />
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
                                        <span className={user.isCurrentUser ? 'font-bold' : ''}>{user.name}</span>
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
