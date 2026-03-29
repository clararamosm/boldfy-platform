// src/app/master/conteudo-global/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Zap, Star, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { TrailForm, Trail } from "@/components/dashboard/trail-form";
import { Badge } from "@/components/ui/badge";

// Adicionando novas propriedades para as métricas
type GlobalTrail = Trail & {
    views?: number;
    uniqueUsers?: number;
}

const EditTrailButton = ({ trail }: { trail: Trail }) => (
  <ActionDialog
    title="Editar Trilha Global"
    description="Altere o conteúdo da sua trilha, adicione tópicos, vídeos e edite o quiz."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar Conteúdo</DropdownMenuItem>}
    actionText="Publicar Alterações"
    secondaryAction={<Button variant="outline">Salvar como Rascunho</Button>}
    className="sm:max-w-3xl"
  >
    <TrailForm trail={trail} />
  </ActionDialog>
);

const TableSkeleton = ({ colSpan }) => (
    <TableRow>
        <TableCell colSpan={colSpan} className="text-center h-24">
            <div className="flex justify-center items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando trilhas...
            </div>
        </TableCell>
    </TableRow>
);


export default function MasterConteudoGlobalPage() {
    const [activeTrails, setActiveTrails] = useState<GlobalTrail[]>([]);
    const [inactiveTrails, setInactiveTrails] = useState<GlobalTrail[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTrails = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, this would be fetched from Firestore
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                 const mockActiveTrails: GlobalTrail[] = [
                    { name: "Cultura da Empresa 101", topics: 4, creationDate: "2023-02-10", status: 'Ativa', description: "Uma introdução à cultura da empresa.", views: 1250, uniqueUsers: 450, points: 250, bonus: 50 },
                    { name: "Dominando Nossos Produtos", topics: 3, creationDate: "2023-04-05", status: 'Ativa', description: "Conheça a fundo os produtos que oferecemos.", views: 890, uniqueUsers: 320, points: 400, bonus: 0 },
                ];

                const mockInactiveTrails: GlobalTrail[] = [
                    { name: "Guia de Boas Práticas em Redes Sociais", topics: 5, creationDate: "2023-08-15", status: 'Arquivada', description: "Um guia completo para colaboradores.", views: 2300, uniqueUsers: 950, points: 150, bonus: 0 },
                    { name: "Introdução à IA Generativa", topics: 2, creationDate: "2024-01-20", status: 'Rascunho', description: "Primeiros passos com IA.", views: 0, uniqueUsers: 0, points: 100, bonus: 20 },
                ];

                setActiveTrails(mockActiveTrails);
                setInactiveTrails(mockInactiveTrails);
            } catch (error) {
                console.error("Error fetching global trails:", error);
                // Handle error with a toast notification
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrails();
    }, []);

    const createTrailButton = (
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar Trilha Global
        </Button>
    );

  return (
    <>
      <Header title="Conteúdo Global" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Trilhas Globais</CardTitle>
              <CardDescription>Crie e edite o conteúdo das trilhas de aprendizagem padrão.</CardDescription>
            </div>
            <ActionDialog
                title="Criar Trilha Global"
                description="Crie uma nova trilha de aprendizagem que ficará disponível para todas as empresas."
                trigger={createTrailButton}
                actionText="Publicar Trilha"
                secondaryAction={<Button variant="outline">Salvar como Rascunho</Button>}
                className="sm:max-w-3xl"
            >
                <TrailForm />
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Trilha</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Visualizações</TableHead>
                  <TableHead>Usuários Únicos</TableHead>
                   <TableHead>Data de Criação</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableSkeleton colSpan={6} /> : activeTrails.map((trail) => (
                    <TableRow key={trail.name}>
                        <TableCell className="font-medium">{trail.name}</TableCell>
                         <TableCell>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    {trail.points}
                                </Badge>
                                {(trail.bonus ?? 0) > 0 && (
                                <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                                    <Star className="h-3 w-3 mr-1"/>
                                    {trail.bonus ?? 0}
                                </Badge>
                                )}
                            </div>
                         </TableCell>
                        <TableCell>{trail.views}</TableCell>
                        <TableCell>{trail.uniqueUsers}</TableCell>
                        <TableCell>{trail.creationDate}</TableCell>
                        <TableCell>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <EditTrailButton trail={trail} />
                                <DropdownMenuItem className="text-destructive">Arquivar</DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle className="font-headline">Trilhas Inativas</CardTitle>
              <CardDescription>Gerencie trilhas arquivadas ou em rascunho.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome da Trilha</TableHead>
                            <TableHead>Pontuação</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data de Criação</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? <TableSkeleton colSpan={5} /> : inactiveTrails.map((trail) => (
                            <TableRow key={trail.name} className="text-muted-foreground">
                                <TableCell className="font-medium">{trail.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                            <Zap className="h-3 w-3 mr-1"/>
                                            {trail.points}
                                        </Badge>
                                        {(trail.bonus ?? 0) > 0 && (
                                        <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                                            <Star className="h-3 w-3 mr-1"/>
                                            {trail.bonus ?? 0}
                                        </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={trail.status === 'Arquivada' ? 'outline' : 'secondary'}>
                                        {trail.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{trail.creationDate}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <EditTrailButton trail={trail} />
                                            <DropdownMenuItem>Ativar</DropdownMenuItem>
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
      </main>
    </>
  );
}
