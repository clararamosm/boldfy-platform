// src/app/influencer/trilhas/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Zap, Globe, Building, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { db, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data structure for a trail fetched from Firestore
type Trail = {
    id: string;
    name: string;
    points: number;
    bonus: number;
    type: 'global' | 'personalizada';
    // Mock user progress
    progress: number;
    tasksCompleted: number;
    tasksTotal: number;
};


const TrailCard = ({ id, name, points, bonus, progress, tasksCompleted, tasksTotal, type }: Trail) => {
    let buttonText = "Iniciar Trilha";
    let buttonVariant: "default" | "secondary" = "default";

    if (progress > 0 && progress < 100) {
        buttonText = "Continuar";
    } else if (progress === 100) {
        buttonText = "Revisar";
        buttonVariant = "secondary";
    }

    return (
        <Card className="shadow-sm">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2 gap-2">
                    <div>
                        <Badge variant="outline" className="mb-2 font-normal">
                            {type === 'global' ? <Globe className="h-3 w-3 mr-1.5" /> : <Building className="h-3 w-3 mr-1.5" />}
                            {type === 'global' ? 'Global' : 'Personalizada'}
                        </Badge>
                        <h3 className="font-semibold">{name}</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                            <Zap className="h-3 w-3 mr-1"/>
                            {points}
                        </Badge>
                        {bonus > 0 && (
                            <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                                <Star className="h-3 w-3 mr-1"/>
                                {bonus}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                    <span>Progresso</span>
                    <span>{tasksCompleted}/{tasksTotal}</span>
                </div>
                <Progress value={progress} />
                <div className="mt-4">
                    <Button variant={buttonVariant} className="w-full sm:w-auto" asChild>
                        <Link href={`/influencer/trilhas/${id}`}>{buttonText}</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};


const TrailsPageSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-6 w-48" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-10 w-28 mt-4" />
                </CardContent>
            </Card>
        ))}
    </div>
);


export default function TrilhasPage() {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

     const fetchTrails = useCallback(async () => {
        setIsLoading(true);
        try {
            // Mock fetching logic. In a real app, you'd fetch trails for the company
            // and then merge with the current user's progress data.
             await new Promise(resolve => setTimeout(resolve, 1000));
            const mockFetchedTrails: Trail[] = [
                { id: "onboarding", name: "Onboarding de Novos Influenciadores", points: 500, bonus: 100, progress: 0, tasksCompleted: 0, tasksTotal: 3, type: "personalizada" },
                { id: "cultura", name: "Cultura da Empresa 101", points: 250, bonus: 50, progress: 75, tasksCompleted: 3, tasksTotal: 4, type: "global" },
                { id: "produtos", name: "Dominando Nossos Produtos", points: 400, bonus: 0, progress: 100, tasksCompleted: 5, tasksTotal: 5, type: "global" },
            ];

            // Example of how you might fetch from Firestore
            // const companyTrailsSnapshot = await getDocs(collection(db, "companies", "company-123", "trails"));
            // const globalTrailsSnapshot = await getDocs(collection(db, "global-trails"));
            // ... then merge and map with user progress
            
            setTrails(mockFetchedTrails);
        } catch (error) {
            console.error("Error fetching trails:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar trilhas.' });
        } finally {
            setIsLoading(false);
        }
        }, [toast]);

    useEffect(() => {
        fetchTrails();
    }, [fetchTrails]);


  return (
    <>
      <Header title="Trilhas de Aprendizagem" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
            <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                <div className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Zap className="h-4 w-4"/>
                        Pontos por trilhas
                    </div>
                    <div className="text-3xl font-bold">750</div>
                </div>
                <div className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Star className="h-4 w-4"/>
                        Pontos bônus
                    </div>
                    <div className="text-3xl font-bold">150</div>
                </div>
            </CardContent>
        </Card>
        
        <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Minhas Trilhas</h2>
             {isLoading ? (
                <TrailsPageSkeleton />
            ) : trails.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma trilha disponível no momento.</p>
            ) : (
                trails.map(trail => <TrailCard key={trail.id} {...trail} />)
            )}
        </div>
      </main>
    </>
  );
}
