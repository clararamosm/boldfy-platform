import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function MasterConteudoGlobalPage() {
  return (
    <>
      <Header title="Conteúdo Global" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Trilhas Globais</CardTitle>
              <CardDescription>Crie e edite o conteúdo das trilhas de aprendizagem padrão.</CardDescription>
            </div>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Trilha Global
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Trilha</TableHead>
                  <TableHead>Tópicos</TableHead>
                  <TableHead>Empresas Ativas</TableHead>
                   <TableHead>Data de Criação</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Cultura da Empresa 101</TableCell>
                  <TableCell>4</TableCell>
                  <TableCell>12</TableCell>
                  <TableCell>2023-02-10</TableCell>
                  <TableCell>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar Conteúdo</DropdownMenuItem>
                        <DropdownMenuItem>Ver Empresas</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Arquivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Dominando Nossos Produtos</TableCell>
                  <TableCell>3</TableCell>
                  <TableCell>8</TableCell>
                  <TableCell>2023-04-05</TableCell>
                  <TableCell>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar Conteúdo</DropdownMenuItem>
                        <DropdownMenuItem>Ver Empresas</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Arquivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
