import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminMissoesPage() {
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
             <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Missão
            </Button>
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
