
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon, ChevronDown, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function AdminMissoesPage() {
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


  const timedMissionForm = (
    <>
      <div className="space-y-2">
        <Label htmlFor="mission-name">Nome da Missão</Label>
        <Input id="mission-name" placeholder="Ex: Compartilhar post no LinkedIn" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-description">Descrição</Label>
        <Textarea id="mission-description" placeholder="Descreva o que o colaborador precisa fazer." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-points">Pontos</Label>
        <Input id="mission-points" type="number" placeholder="Ex: 100" />
      </div>
       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="start-date">Data de Início</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
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

  const fixedMissionForm = (
     <>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-name">Nome da Missão</Label>
        <Input id="fixed-mission-name" placeholder="Ex: Atualize seu banner do LinkedIn" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-description">Descrição</Label>
        <Textarea id="fixed-mission-description" placeholder="Descreva o que o colaborador precisa fazer." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fixed-mission-points">Pontos</Label>
        <Input id="fixed-mission-points" type="number" placeholder="Ex: 50" />
      </div>
    </>
  );

  const submissionsView = (
    <p className="text-sm text-muted-foreground">Nenhum envio para esta missão ainda.</p>
  );

  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
             <div/>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm">
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
                      actionText="Salvar Missão"
                    >
                      {timedMissionForm}
                    </ActionDialog>
                    <ActionDialog
                      title="Criar Missão Fixa"
                      description="Configure uma missão que ficará sempre ativa."
                      trigger={createFixedMissionButton}
                      actionText="Salvar Missão"
                    >
                      {fixedMissionForm}
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
                     <TableRow>
                      <TableCell className="cursor-grab"><GripVertical className="h-5 w-5 text-muted-foreground" /></TableCell>
                      <TableCell className="font-medium">Atualize seu banner do LinkedIn</TableCell>
                      <TableCell>50</TableCell>
                      <TableCell><Badge variant="outline">Fixa</Badge></TableCell>
                      <TableCell>45 / 45</TableCell>
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
                              {fixedMissionForm}
                            </ActionDialog>
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
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
                    <TableRow>
                      <TableCell className="font-medium">Compartilhar post no LinkedIn</TableCell>
                      <TableCell>15/07 - 22/07</TableCell>
                      <TableCell>100</TableCell>
                      <TableCell><Badge>Ativa</Badge></TableCell>
                      <TableCell>32 / 45</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <ActionDialog
                                title="Ver Envios"
                                description="Veja as comprovações enviadas pelos colaboradores."
                                trigger={viewSubmissionsButton}
                                actionText="Fechar"
                                >
                                {submissionsView}
                            </ActionDialog>
                             <ActionDialog
                              title="Editar Missão"
                              description="Atualize os detalhes desta missão."
                              trigger={editActiveMissionButton}
                              actionText="Salvar Alterações"
                            >
                              {timedMissionForm}
                            </ActionDialog>
                            <DropdownMenuItem>Desativar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell className="font-medium">Gravar vídeo sobre novo feature</TableCell>
                       <TableCell>25/07 - 01/08</TableCell>
                      <TableCell>250</TableCell>
                      <TableCell><Badge className="bg-primary/80 text-primary-foreground">Agendada</Badge></TableCell>
                      <TableCell>0 / 45</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <ActionDialog
                              title="Editar Missão"
                              description="Atualize os detalhes desta missão."
                              trigger={editActiveMissionButton}
                              actionText="Salvar Alterações"
                            >
                              {timedMissionForm}
                            </ActionDialog>
                            <DropdownMenuItem>Cancelar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
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
                    <TableRow className="text-muted-foreground">
                      <TableCell className="font-medium">Post sobre o Dia do Programador</TableCell>
                      <TableCell>01/07 - 08/07</TableCell>
                      <TableCell>100</TableCell>
                      <TableCell><Badge variant="outline">Passada</Badge></TableCell>
                      <TableCell>41 / 45</TableCell>
                      <TableCell>
                         <ActionDialog
                            title="Ver Envios"
                            description="Veja as comprovações enviadas pelos colaboradores."
                            trigger={<Button variant="ghost" size="sm">Ver Envios</Button>}
                            actionText="Fechar"
                            >
                            {submissionsView}
                        </ActionDialog>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
      </main>
    </>
  );
}
