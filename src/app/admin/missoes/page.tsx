import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
      <div className="space-y-2">
        <Label>Duração da Missão</Label>
        <RadioGroup defaultValue="7d" className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="7d" id="d7" />
            <Label htmlFor="d7" className="font-normal">7 dias</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="14d" id="d14" />
            <Label htmlFor="d14" className="font-normal">14 dias</Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );

  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="ativas">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="ativas">Missões Ativas</TabsTrigger>
              <TabsTrigger value="fixas">Missões Fixas (Onboarding)</TabsTrigger>
              <TabsTrigger value="calendario">Calendário</TabsTrigger>
            </TabsList>
            <ActionDialog
              title="Criar Nova Missão"
              description="Configure uma nova missão para seus colaboradores."
              trigger={createMissionButton}
              actionText="Salvar Missão"
            >
              {missionForm}
            </ActionDialog>
          </div>
          <TabsContent value="ativas">
            <Card>
              <CardHeader>
                <CardTitle>Missões da Semana</CardTitle>
                <CardDescription>Gerencie as missões que estão ativas para seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Compartilhar post no LinkedIn</TableCell>
                      <TableCell>100</TableCell>
                      <TableCell><Badge variant="default">Ativa</Badge></TableCell>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="fixas">
            <Card>
              <CardHeader>
                <CardTitle>Missões Fixas (Onboarding)</CardTitle>
                <CardDescription>Gerencie as missões que todo novo colaborador deve completar.</CardDescription>
              </CardHeader>
               <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                       <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Atualize seu banner do LinkedIn</TableCell>
                      <TableCell>50</TableCell>
                      <TableCell><Badge variant="default">Ativa</Badge></TableCell>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
           <TabsContent value="calendario">
            <Card>
              <CardHeader>
                <CardTitle>Calendário de Missões</CardTitle>
                <CardDescription>Planeje as missões para as próximas semanas.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Componente de calendário de missões aqui.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
