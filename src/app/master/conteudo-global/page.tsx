// src/app/master/conteudo-global/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { TrailForm, Trail } from "@/components/dashboard/trail-form";

// Adicionando novas propriedades para as métricas
type GlobalTrail = Trail & {
    views: number;
    uniqueUsers: number;
}

const globalTrails: GlobalTrail[] = [
    { name: "Cultura da Empresa 101", topics: 4, companies: 12, creationDate: "2023-02-10", status: 'Ativa', description: "Uma introdução à cultura da empresa.", views: 1250, uniqueUsers: 450 },
    { name: "Dominando Nossos Produtos", topics: 3, companies: 8, creationDate: "2023-04-05", status: 'Ativa', description: "Conheça a fundo os produtos que oferecemos.", views: 890, uniqueUsers: 320 },
];

const EditTrailButton = ({ trail }: { trail: Trail }) => (
  <ActionDialog
    title="Editar Trilha Global"
    description="Altere o conteúdo da sua trilha, adicione tópicos, vídeos e edite o quiz."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar Conteúdo</DropdownMenuItem>}
    actionText="Salvar Alterações"
    className="sm:max-w-3xl"
  >
    <TrailForm trail={trail} />
  </ActionDialog>
);

export default function MasterConteudoGlobalPage() {
    const createTrailButton = (
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar Trilha Global
        </Button>
    );

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
            <ActionDialog
                title="Criar Trilha Global"
                description="Crie uma nova trilha de aprendizagem que ficará disponível para todas as empresas."
                trigger={createTrailButton}
                actionText="Salvar Trilha"
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
                  <TableHead>Tópicos</TableHead>
                  <TableHead>Visualizações</TableHead>
                  <TableHead>Usuários Únicos</TableHead>
                   <TableHead>Data de Criação</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalTrails.map((trail) => (
                    <TableRow key={trail.name}>
                        <TableCell className="font-medium">{trail.name}</TableCell>
                        <TableCell>{trail.topics}</TableCell>
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
                                <DropdownMenuItem>Ver Empresas</DropdownMenuItem>
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
      </main>
    </>
  );
}
