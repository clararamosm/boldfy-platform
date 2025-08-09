import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminRecompensasPage() {
  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="loja">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="loja">Loja de Recompensas</TabsTrigger>
              <TabsTrigger value="historico">Histórico de Resgates</TabsTrigger>
            </TabsList>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Recompensa
            </Button>
          </div>
          <TabsContent value="loja">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Loja de Recompensas</CardTitle>
                <CardDescription>Adicione, edite ou remova as recompensas disponíveis.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recompensa</TableHead>
                      <TableHead>Custo (Pontos)</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Vale-presente iFood R$50</TableCell>
                      <TableCell>5000</TableCell>
                      <TableCell>15</TableCell>
                      <TableCell><Badge variant="default">Disponível</Badge></TableCell>
                       <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Ocultar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Day Off</TableCell>
                      <TableCell>10000</TableCell>
                      <TableCell>Ilimitado</TableCell>
                      <TableCell><Badge variant="default">Disponível</Badge></TableCell>
                       <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Ocultar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Resgates</CardTitle>
                <CardDescription>Acompanhe os resgates feitos pelos colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Recompensa</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Carla Costa</TableCell>
                      <TableCell>Vale-presente iFood R$50</TableCell>
                      <TableCell>2024-07-10</TableCell>
                      <TableCell><Badge variant="destructive">Pendente</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">Marcar como Pago</Button>
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
