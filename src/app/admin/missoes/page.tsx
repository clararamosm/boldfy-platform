
'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon, ChevronDown, GripVertical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// MOCK DATA - In a real app, this data would be fetched from Firestore
const mockFixedMissions = [
  { id: 'fix1', name: 'Atualize seu banner do LinkedIn', points: 50, participants: '45 / 45', status: 'Fixa' },
];
const mockTimedMissions = [
  { id: 'time1', name: 'Compartilhar post no LinkedIn', points: 100, participants: '32 / 45', status: 'Ativa', period: '15/07 - 22/07' },
  { id: 'time2', name: 'Gravar vídeo sobre novo feature', points: 250, participants: '0 / 45', status: 'Agendada', period: '25/07 - 01/08' },
];
const mockPastMissions = [
  { id: 'past1', name: 'Post sobre o Dia do Programador', points: 100, participants: '41 / 45', status: 'Passada', period: '01/07 - 08/07' },
];


type Mission = {
  id: string;
  name: string;
  points: number;
  participants: string;
  status: 'Fixa' | 'Ativa' | 'Agendada' | 'Passada';
  period?: string;
}

const TimedMissionForm = ({ isSubmitting = false }) => (
    <>
      <div className="space-y-2">
        <Label htmlFor="mission-name">Nome da Missão</Label>
        <Input id="mission-name" placeholder="Ex: Compartilhar post no LinkedIn" disabled={isSubmitting} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-description">Descrição</Label>
        <Textarea id="mission-description" placeholder="Descreva o que o colaborador precisa fazer." disabled={isSubmitting} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-points">Pontos</Label>
        <Input id="mission-points" type="number" placeholder="Ex: 100" disabled={isSubmitting} />
      </div>
       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="start-date">Data de Início</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <span>Selecione uma data</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" />
                </PopoverContent>
            </Popover>
        </div>
        <div className="space-y-2">
            <Label htmlFor="end-date">Data de Término</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <span>Selecione uma data</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" />
                </PopoverContent>
            </Popover>
        </div>
      </div>
    </>
  );

  const FixedMissionForm = ({ isSubmitting = false }) => (
     <>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-name">Nome da Missão</Label>
        <Input id="fixed-mission-name" placeholder="Ex: Atualize seu banner do LinkedIn" disabled={isSubmitting}/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-description">Descrição</Label>
        <Textarea id="fixed-mission-description" placeholder="Descreva o que o colaborador precisa fazer." disabled={isSubmitting} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-points">Pontos</Label>
        <Input id="fixed-mission-points" type="number" placeholder="Ex: 50" disabled={isSubmitting}/>
      </div>
    </>
  );

  const SubmissionsView = () => (
    <p className="text-sm text-muted-foreground">Nenhum envio para esta missão ainda.</p>
  );

  const TableSkeleton = ({ cols }) => (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center">
        <div className="flex justify-center items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando missões...
        </div>
      </TableCell>
    </TableRow>
  );


export default function AdminMissoesPage() {
  const [fixedMissions, setFixedMissions] = useState<Mission[]>([]);
  const [timedMissions, setTimedMissions] = useState<Mission[]>([]);
  const [pastMissions, setPastMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMissions = async () => {
      setIsLoading(true);
      // MOCK DATA - In a real app, fetch from Firestore
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFixedMissions(mockFixedMissions);
      setTimedMissions(mockTimedMissions);
      setPastMissions(mockPastMissions);
      setIsLoading(false);
    }
    fetchMissions();
  }, []);

  const handleAction = async () => {
    setIsSubmitting(true);
    console.log("Submitting form...");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate async
    setIsSubmitting(false);
  }

  const createTimedMissionButton = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      Criar Missão Padrão
    </DropdownMenuItem>
  );

  const createFixedMissionButton = (
     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      Criar Missão Fixa
    </DropdownMenuItem>
  );

    const editFixedMissionButton = (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Editar
        </DropdownMenuItem>
    );

    const editActiveMissionButton = (
         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Editar
        </DropdownMenuItem>
    );

     const viewSubmissionsButton = (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Ver Envios
        </DropdownMenuItem>
    );


  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
             <div/>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={isSubmitting}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Criar Missão</span>
                        <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <ActionDialog
                      title="Criar Missão Padrão"
                      description="Configure uma nova missão com data de início e fim."
                      trigger={createTimedMissionButton}
                      actionText={isSubmitting ? "Salvando..." : "Salvar Missão"}
                      onAction={handleAction}
                    >
                      <TimedMissionForm isSubmitting={isSubmitting} />
                    </ActionDialog>
                    <ActionDialog
                      title="Criar Missão Fixa"
                      description="Configure uma missão que ficará sempre ativa."
                      trigger={createFixedMissionButton}
                      actionText={isSubmitting ? "Salvando..." : "Salvar Missão"}
                      onAction={handleAction}
                    >
                      <FixedMissionForm isSubmitting={isSubmitting} />
                    </ActionDialog>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
            <Card>
              <CardHeader>
                <CardTitle>Missões Fixas</CardTitle>
                <CardDescription>Gerencie as missões de onboarding que estão sempre ativas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"><span className="sr-only">Reordenar</span></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading ? <TableSkeleton cols={6} /> : fixedMissions.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhuma missão fixa encontrada.</TableCell>
                        </TableRow>
                     ) : fixedMissions.map((mission) => (
                        <TableRow key={mission.id}>
                          <TableCell className="cursor-grab"><GripVertical className="h-5 w-5 text-muted-foreground" /></TableCell>
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell><Badge variant="outline">{mission.status}</Badge></TableCell>
                          <TableCell>{mission.participants}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                 <ActionDialog
                                  title="Editar Missão Fixa"
                                  description="Atualize os detalhes desta missão."
                                  trigger={editFixedMissionButton}
                                  actionText="Salvar Alterações"
                                >
                                  <FixedMissionForm isSubmitting={isSubmitting} />
                                </ActionDialog>
                                <DropdownMenuItem>Desativar</DropdownMenuItem>
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

            <Card>
              <CardHeader>
                <CardTitle>Missões Ativas e Agendadas</CardTitle>
                <CardDescription>Gerencie as missões com data definida para seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton cols={6} /> : timedMissions.length === 0 ? (
                         <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhuma missão ativa ou agendada.</TableCell>
                        </TableRow>
                    ) : timedMissions.map((mission) => (
                        <TableRow key={mission.id}>
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.period}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell>
                            <Badge variant={mission.status === 'Ativa' ? 'default' : 'secondary'} className={mission.status === 'Agendada' ? 'bg-primary/80 text-primary-foreground' : ''}>
                              {mission.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{mission.participants}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {mission.status === 'Ativa' && (
                                  <ActionDialog
                                    title="Ver Envios"
                                    description="Veja as comprovações enviadas pelos colaboradores."
                                    trigger={viewSubmissionsButton}
                                    actionText="Fechar"
                                    >
                                    <SubmissionsView />
                                  </ActionDialog>
                                )}
                                 <ActionDialog
                                  title="Editar Missão"
                                  description="Atualize os detalhes desta missão."
                                  trigger={editActiveMissionButton}
                                  actionText="Salvar Alterações"
                                >
                                  <TimedMissionForm isSubmitting={isSubmitting}/>
                                </ActionDialog>
                                <DropdownMenuItem>{mission.status === 'Agendada' ? 'Cancelar' : 'Desativar'}</DropdownMenuItem>
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

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Missões</CardTitle>
                <CardDescription>Visualize o desempenho das missões que já foram encerradas.</CardDescription>
              </CardHeader>
               <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                       <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading ? <TableSkeleton cols={6} /> : pastMissions.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhum histórico de missões.</TableCell>
                        </TableRow>
                     ) : pastMissions.map((mission) => (
                        <TableRow key={mission.id} className="text-muted-foreground">
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.period}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell><Badge variant="outline">{mission.status}</Badge></TableCell>
                          <TableCell>{mission.participants}</TableCell>
                          <TableCell>
                             <ActionDialog
                                title="Ver Envios"
                                description="Veja as comprovações enviadas pelos colaboradores."
                                trigger={<Button variant="ghost" size="sm">Ver Envios</Button>}
                                actionText="Fechar"
                                >
                                <SubmissionsView />
                            </ActionDialog>
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
