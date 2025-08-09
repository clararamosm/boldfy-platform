// src/app/influencer/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload, Circle, Clock, Zap, CalendarDays, FileImage } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React from "react";


type MissionStatus = 'completa' | 'pendente' | 'agendada';

const MissionCard = ({ title, description, points, status, period }: { title: string, description: string, points: number, status: MissionStatus, period?: string }) => {
    
    const [fileUploaded, setFileUploaded] = React.useState(false);

    const uploadForm = (
        <div className="space-y-2">
            <Label htmlFor="submission-file" className="sr-only">Arquivo</Label>
            <Input id="submission-file" type="file" accept="image/*" onChange={(e) => setFileUploaded(e.target.files.length > 0)} />
            <p className="text-xs text-muted-foreground pt-1">Envie uma imagem como comprovação.</p>
        </div>
    );

    const uploadButton = (
        <Button disabled={!fileUploaded}>
            <Upload className="mr-2 h-4 w-4" /> Concluir Missão
        </Button>
    )

    const statusInfo = {
        completa: {
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            text: "Missão Completa",
            color: "text-green-600",
            button: null
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
                    actionText="Concluir Missão"
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
                    {points} pts
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
                    <div className="text-3xl font-bold">0</div>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <span>Pontos de Missões Fixas</span>
                        <span>50 / 50</span>
                    </div>
                    <Progress value={100} className="h-2" />
                     <p className="text-xs text-muted-foreground mt-2">Você completou todas as missões fixas!</p>
                </div>
            </CardContent>
        </Card>
        
        <Tabs defaultValue="semana">
            <TabsList className="mb-4">
                <TabsTrigger value="semana">Missões da Semana</TabsTrigger>
                <TabsTrigger value="onboarding">Missões Fixas</TabsTrigger>
            </TabsList>
            <TabsContent value="semana">
                <div className="space-y-4">
                    <MissionCard
                        title="Compartilhar post no LinkedIn"
                        description="Ajude a divulgar nosso último artigo sobre as tendências de IA para 2025."
                        points={100}
                        status="pendente"
                        period="15/07 - 22/07"
                    />
                     <MissionCard
                        title="Gravar vídeo sobre novo feature"
                        description="Crie um vídeo curto (1 min) explicando a nova funcionalidade XYZ para nossos clientes."
                        points={250}
                        status="agendada"
                        period="25/07 - 01/08"
                    />
                </div>
            </TabsContent>
             <TabsContent value="onboarding">
                 <div className="space-y-4">
                    <MissionCard
                        title="Atualize seu banner do LinkedIn"
                        description="Use nosso banner oficial para mostrar que você faz parte do time."
                        points={50}
                        status="completa"
                    />
                </div>
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
