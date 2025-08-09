// src/app/influencer/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload, Clock, Zap, CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect } from "react";

type MissionStatus = 'completa' | 'pendente' | 'agendada';

type Mission = {
    id: string;
    title: string;
    description: string;
    points: number;
    status: MissionStatus;
    period?: string;
    type: 'semana' | 'fixa';
};

const MissionCard = ({ title, description, points, status, period }: Omit<Mission, 'id' | 'type'>) => {
    
    const [fileUploaded, setFileUploaded] = React.useState(false);

    const uploadForm = (
        <div className="space-y-2">
            <Label htmlFor="submission-file" className="sr-only">Arquivo</Label>
            <Input id="submission-file" type="file" accept="image/*,video/*,.pdf" onChange={(e) => setFileUploaded(e.target.files.length > 0)} />
            <p className="text-xs text-muted-foreground pt-1">Envie uma imagem, vídeo ou PDF como comprovação.</p>
        </div>
    );

    const statusInfo = {
        completa: {
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            text: "Missão Completa",
            color: "text-green-600",
            button: <Button disabled variant="secondary">Concluída</Button>
        },
        pendente: {
            icon: null,
            text: "",
            color: "",
            button: (
                 <ActionDialog
                    title="Enviar Comprovação"
                    description={`Envie um anexo para completar a missão "${title}".`}
                    trigger={<Button><Upload className="mr-2 h-4 w-4" /> Enviar Comprovação</Button>}
                    actionText={fileUploaded ? "Concluir Missão" : "Selecione um arquivo"}
                    showCancel
                >
                    {uploadForm}
                </ActionDialog>
            )
        },
        agendada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missão Agendada",
            color: "text-muted-foreground",
            button: <Button disabled>Em breve</Button>
        }
    }

    const currentStatus = statusInfo[status];
    
    return (
    <Card>
        <CardHeader>
            <div className="flex justify-between items-start gap-4">
                <CardTitle className="font-headline text-lg">{title}</CardTitle>
                 <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                    <Zap className="h-3 w-3 mr-1"/>
                    {points}
                </Badge>
            </div>
             <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            {period && (
                 <div className="text-xs text-muted-foreground flex items-center">
                    <CalendarDays className="h-3 w-3 mr-1.5" />
                    <span>Período: {period}</span>
                </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            {status !== 'pendente' ? (
                <div className={`text-sm ${currentStatus.color} flex items-center font-medium`}>
                    {currentStatus.icon}
                    {currentStatus.text}
                </div>
            ) : (
                <span/>
            )}
            {currentStatus.button}
        </CardFooter>
    </Card>
)};

export default function InfluencerMissoesPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [stats, setStats] = useState({ weeklyPoints: 0, fixedProgress: 0, fixedCompleted: 0, fixedTotal: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMissions = async () => {
            setIsLoading(true);
            // MOCK DATA - In a real app, fetch from Firestore
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockMissions: Mission[] = [
                { id: 'm1', title: "Compartilhar post no LinkedIn", description: "Ajude a divulgar nosso último artigo sobre as tendências de IA para 2025.", points: 100, status: "pendente", period: "15/07 - 22/07", type: "semana" },
                { id: 'm2', title: "Gravar vídeo sobre novo feature", description: "Crie um vídeo curto (1 min) explicando a nova funcionalidade XYZ para nossos clientes.", points: 250, status: "agendada", period: "25/07 - 01/08", type: "semana" },
                { id: 'f1', title: "Atualize seu banner do LinkedIn", description: "Use nosso banner oficial para mostrar que você faz parte do time.", points: 50, status: "completa", type: "fixa" },
            ];

            const weeklyMissions = mockMissions.filter(m => m.type === 'semana');
            const fixedMissions = mockMissions.filter(m => m.type === 'fixa');
            const completedFixed = fixedMissions.filter(m => m.status === 'completa').length;

            setMissions(mockMissions);
            setStats({
                weeklyPoints: 0, // This would be calculated based on completed missions in the last 7 days
                fixedCompleted: completedFixed,
                fixedTotal: fixedMissions.length,
                fixedProgress: (completedFixed / fixedMissions.length) * 100,
            });
            setIsLoading(false);
        };

        fetchMissions();
    }, []);

    const weeklyMissions = missions.filter(m => m.type === 'semana');
    const fixedMissions = missions.filter(m => m.type === 'fixa');

    const renderMissions = (missionList: Mission[]) => {
        if (isLoading) {
             return (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            );
        }
        if (missionList.length === 0) {
            return <p className="text-center text-muted-foreground py-8">Nenhuma missão nesta categoria.</p>;
        }
        return (
            <div className="space-y-4">
                {missionList.map(mission => <MissionCard key={mission.id} {...mission} />)}
            </div>
        )
    }

  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
            <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                <div className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Zap className="h-4 w-4"/>
                        Pontos de Missões da Semana
                    </div>
                    <div className="text-3xl font-bold">{stats.weeklyPoints}</div>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <span>Progresso em Missões Fixas</span>
                        <span>{stats.fixedCompleted} / {stats.fixedTotal}</span>
                    </div>
                    <Progress value={stats.fixedProgress} className="h-2" />
                     {stats.fixedProgress === 100 && <p className="text-xs text-muted-foreground mt-2">Você completou todas as missões fixas!</p>}
                </div>
            </CardContent>
        </Card>
        
        <Tabs defaultValue="semana">
            <TabsList className="mb-4">
                <TabsTrigger value="semana">Missões da Semana</TabsTrigger>
                <TabsTrigger value="fixas">Missões Fixas</TabsTrigger>
            </TabsList>
            <TabsContent value="semana">
                {renderMissions(weeklyMissions)}
            </TabsContent>
             <TabsContent value="fixas">
                 {renderMissions(fixedMissions)}
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
