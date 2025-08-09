import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminTrilhasPage() {
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
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Trilha
            </Button>
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
                    <TableRow>
                      <TableCell className="font-medium">Onboarding de Novos Influenciadores</TableCell>
                      <TableCell><Badge>Ativa</Badge></TableCell>
                      <TableCell>45 / 45</TableCell>
                      <TableCell>
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar Conteúdo</DropdownMenuItem>
                            <DropdownMenuItem>Ver Progresso</DropdownMenuItem>
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
