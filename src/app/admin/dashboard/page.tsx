import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trophy, Gift, CheckCircle } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Colaboradores Ativos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-headline">45 / 50</div>
                    <p className="text-xs text-muted-foreground">Licenças usadas</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Engajamento</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-headline">82%</div>
                    <p className="text-xs text-muted-foreground">+5% vs. mês passado</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Recompensas Resgatadas</CardTitle>
                    <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-headline">12</div>
                    <p className="text-xs text-muted-foreground">Este mês</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Missões Completas</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-headline">153</div>
                    <p className="text-xs text-muted-foreground">Esta semana</p>
                </CardContent>
            </Card>
        </div>
        <div className="mt-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline">Gerenciar Conteúdo</CardTitle>
                        <CardDescription>Crie e edite missões, trilhas e recompensas.</CardDescription>
                    </div>
                    <Button size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Criar Novo
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data de Criação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Onboarding de Novos Influenciadores</TableCell>
                                <TableCell>Trilha</TableCell>
                                <TableCell><Badge variant="default">Ativa</Badge></TableCell>
                                <TableCell>2024-05-10</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Compartilhar Post no LinkedIn</TableCell>
                                <TableCell>Missão</TableCell>
                                <TableCell><Badge variant="default">Ativa</Badge></TableCell>
                                <TableCell>2024-05-15</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Vale-presente iFood R$50</TableCell>
                                <TableCell>Recompensa</TableCell>
                                <TableCell><Badge variant="outline">Disponível</Badge></TableCell>
                                <TableCell>2024-05-01</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}
