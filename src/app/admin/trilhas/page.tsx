// src/app/admin/trilhas/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Globe, Zap, Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trail, TrailForm } from '@/components/dashboard/trail-form';


const globalTrails = [
    { name: "Cultura da Empresa 101", points: 250, bonus: 50, active: true },
    { name: "Dominando Nossos Produtos", points: 400, bonus: 0, active: false }
]

const EditTrailButton = ({ trail }: { trail: Trail }) => (
  <ActionDialog
    title="Editar Trilha de Aprendizagem"
    description="Altere o conteúdo da sua trilha, adicione tópicos, vídeos e edite o quiz."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar Conteúdo</DropdownMenuItem>}
    actionText="Publicar Alterações"
    secondaryAction={<Button variant="outline">Salvar como Rascunho</Button>}
    className="sm:max-w-3xl"
  >
    <TrailForm trail={trail} />
  </ActionDialog>
);

const ProgressView = () => (
  <div className="space-y-4">
      <div className="flex items-center gap-3">
           <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
              <AvatarFallback>CC</AvatarFallback>
          </Avatar>
          <div className="flex-1">
              <p className="font-medium text-sm">Carla Costa</p>
              <Progress value={100} className="h-2 mt-1" />
          </div>
          <span className="text-sm font-semibold">100%</span>
      </div>
      <div className="flex items-center gap-3">
           <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
              <AvatarFallback>JP</AvatarFallback>
          </Avatar>
          <div className="flex-1">
              <p className="font-medium text-sm">João Paulo</p>
              <Progress value={75} className="h-2 mt-1" />
          </div>
          <span className="text-sm font-semibold">75%</span>
      </div>
  </div>
);

 const ViewProgressButton = () => (
  <ActionDialog
    title="Progresso da Trilha"
    description="Acompanhe o progresso dos colaboradores nesta trilha."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Ver Progresso</DropdownMenuItem>}
    actionText="Fechar"
    showCancel={false}
  >
    <ProgressView />
  </ActionDialog>
);


export default function AdminTrilhasPage() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrails = async () => {
      setIsLoading(true);
      try {
        const mockTrails: Trail[] = [
            { name: "Onboarding de Novos Influenciadores", status: "Ativa", enrolled: 45, total: 45, description: "Prepare novos colaboradores para se tornarem advogados da marca.", points: 500, bonus: 100 },
            { name: "Como criar conteúdo viral", status: "Inativa", enrolled: 30, total: 45, description: "Aprenda técnicas para criar posts que engajam.", points: 300, bonus: 50 },
        ];
        // In a real scenario, you'd fetch from Firestore:
        // const querySnapshot = await getDocs(collection(db, "companies", "company-123", "trails"));
        // const fetchedTrails = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Trail[];
        // setTrails(fetchedTrails);
        setTrails(mockTrails);
      } catch (error) {
        console.error("Error fetching trails: ", error);
        // handle error
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrails();
  }, []);

  const createTrailButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Criar Trilha
    </Button>
  );

  return (
    <>
      <Header title="Trilhas de Aprendizagem" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="personalizadas">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="personalizadas">Trilhas Personalizadas</TabsTrigger>
              <TabsTrigger value="globais">Trilhas Globais</TabsTrigger>
            </TabsList>
             <ActionDialog
              title="Criar Trilha Personalizada"
              description="Crie uma nova trilha de aprendizagem para sua equipe com tópicos, vídeos e quizzes."
              trigger={createTrailButton}
              actionText="Publicar Trilha"
              secondaryAction={<Button variant="outline">Salvar como Rascunho</Button>}
              className="sm:max-w-3xl"
            >
              <TrailForm />
            </ActionDialog>
          </div>
          <TabsContent value="personalizadas">
            <Card>
              <CardHeader>
                <CardTitle>Suas Trilhas Personalizadas</CardTitle>
                <CardDescription>Crie e gerencie trilhas de aprendizagem para sua equipe.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                       <TableHead>Pontuação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inscritos</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                           <div className="flex justify-center items-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2">Carregando trilhas...</span>
                           </div>
                        </TableCell>
                      </TableRow>
                    ) : trails.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center">
                                Nenhuma trilha personalizada encontrada.
                            </TableCell>
                        </TableRow>
                    ) : (
                        trails.map((trail) => (
                            <TableRow key={trail.name} className={trail.status === 'Inativa' ? 'text-muted-foreground' : ''}>
                            <TableCell className="font-medium">{trail.name}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                        <Zap className="h-3 w-3 mr-1"/>
                                        {trail.points}
                                    </Badge>
                                    {trail.bonus > 0 && (
                                    <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                                        <Star className="h-3 w-3 mr-1"/>
                                        {trail.bonus}
                                    </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell><Badge variant={trail.status === 'Ativa' ? 'default' : 'outline'}>{trail.status}</Badge></TableCell>
                            <TableCell>{trail.enrolled} / {trail.total}</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <EditTrailButton trail={trail} />
                                    <ViewProgressButton />
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>{trail.status === 'Ativa' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="globais">
             <Card>
              <CardHeader>
                <CardTitle>Trilhas de Aprendizagem Globais</CardTitle>
                <CardDescription>Ative ou desative trilhas padrão para seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Trilha</TableHead>
                      <TableHead>Pontuação</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalTrails.map((trail) => (
                         <TableRow key={trail.name}>
                         <TableCell className="font-medium">
                           <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              {trail.name}
                           </div>
                         </TableCell>
                         <TableCell>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    {trail.points}
                                </Badge>
                                {trail.bonus > 0 && (
                                <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                                    <Star className="h-3 w-3 mr-1"/>
                                </Badge>
                                )}
                            </div>
                         </TableCell>
                         <TableCell>
                            <div className="flex items-center space-x-2">
                               <Switch id={`${trail.name}-switch`} defaultChecked={trail.active} />
                               <Label htmlFor={`${trail.name}-switch`}>{trail.active ? 'Ativa' : 'Inativa'}</Label>
                           </div>
                         </TableCell>
                       </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
