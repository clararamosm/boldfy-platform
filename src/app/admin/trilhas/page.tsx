// src/app/admin/trilhas/page.tsx
'use client';

import React from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trail, TrailForm } from '@/components/dashboard/trail-form';

const trails: Trail[] = [
  { name: "Onboarding de Novos Influenciadores", status: "Ativa", enrolled: 45, total: 45, description: "Prepare novos colaboradores para se tornarem advogados da marca." },
  { name: "Como criar conteúdo viral", status: "Inativa", enrolled: 30, total: 45, description: "Aprenda técnicas para criar posts que engajam." },
];

const EditTrailButton = ({ trail }: { trail: Trail }) => (
  <ActionDialog
    title="Editar Trilha de Aprendizagem"
    description="Altere o conteúdo da sua trilha, adicione tópicos, vídeos e edite o quiz."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar Conteúdo</DropdownMenuItem>}
    actionText="Salvar Alterações"
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
              actionText="Salvar Trilha"
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
                      <TableHead>Status</TableHead>
                      <TableHead>Inscritos</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trails.map((trail) => (
                        <TableRow key={trail.name} className={trail.status === 'Inativa' ? 'text-muted-foreground' : ''}>
                          <TableCell className="font-medium">{trail.name}</TableCell>
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
                    ))}
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
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <Globe className="h-4 w-4 text-muted-foreground" />
                           Cultura da Empresa 101
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center space-x-2">
                            <Switch id="cultura-switch" defaultChecked />
                            <Label htmlFor="cultura-switch">Ativa</Label>
                        </div>
                      </TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <Globe className="h-4 w-4 text-muted-foreground" />
                           Dominando Nossos Produtos
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center space-x-2">
                            <Switch id="produtos-switch" />
                            <Label htmlFor="produtos-switch">Inativa</Label>
                        </div>
                      </TableCell>
                    </TableRow>
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
