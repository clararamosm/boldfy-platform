import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trophy, Gift, CheckCircle } from "lucide-react";

const StatCard = ({ title, value, description, icon: Icon }) => (
    <Card>
        <CardHeader>
            <Icon className="h-6 w-6 text-muted-foreground mb-2" />
            <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold font-headline">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);


export default function AdminDashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Colaboradores Ativos" value="45 / 50" description="Licenças usadas" icon={Users} />
            <StatCard title="Engajamento" value="82%" description="+5% vs. mês passado" icon={Trophy} />
            <StatCard title="Recompensas Resgatadas" value="12" description="Este mês" icon={Gift} />
            <StatCard title="Missões Completas" value="153" description="Esta semana" icon={CheckCircle} />
        </div>
        <div className="mt-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline">Atividade Recente</CardTitle>
                        <CardDescription>Acompanhe as últimas atividades na plataforma.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Ação</TableHead>
                                <TableHead>Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Carla Costa</TableCell>
                                <TableCell>Completou a trilha "Onboarding de Novos Influenciadores"</TableCell>
                                <TableCell>2024-07-20</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">João Paulo</TableCell>
                                <TableCell>Resgatou a recompensa "Vale-presente iFood R$50"</TableCell>
                                <TableCell>2024-07-19</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Carla Costa</TableCell>
                                <TableCell>Completou a missão "Compartilhar Post no LinkedIn"</TableCell>
                                <TableCell>2024-07-18</TableCell>
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
