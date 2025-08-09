import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function AdminMissoesPage() {
  const createMissionButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Criar Missão
    </Button>
  );

  const missionForm = (
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

  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
             <div/>
            <ActionDialog
              title="Criar Nova Missão"
              description="Configure uma nova missão para seus colaboradores."
              trigger={createMissionButton}
              actionText="Salvar Missão"
            >
              {missionForm}
            </ActionDialog>
          </div>
            <Card>
              <CardHeader>
                <CardTitle>Missões Ativas e Agendadas</CardTitle>
                <CardDescription>Gerencie as missões que estão ativas ou programadas para seus colaboradores.</CardDescription>
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
                      <TableCell className="font-medium">Atualize seu banner do LinkedIn</TableCell>
                      <TableCell>Sempre Ativa</TableCell>
                      <TableCell>50</TableCell>
                      <TableCell><Badge variant="secondary">Fixa</Badge></TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Desativar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
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
                            <DropdownMenuItem>Ver Envios</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
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
                            <DropdownMenuItem>Editar</DropdownMenuItem>
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
                         <Button variant="ghost" size="sm">Ver Envios</Button>
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
