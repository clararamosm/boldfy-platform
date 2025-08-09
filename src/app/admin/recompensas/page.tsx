
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Reward = {
    name: string;
    points: number;
    stock: string | number;
    status: 'Disponível' | 'Desativada';
};


export default function AdminRecompensasPage() {

    const rewards: Reward[] = [
        { name: "Vale-presente iFood R$50", points: 5000, stock: 15, status: "Disponível" },
        { name: "Day Off", points: 10000, stock: "Ilimitado", status: "Disponível" },
        { name: "Vale-presente Spotify", points: 3000, stock: 0, status: "Desativada" },
    ];


  const addRewardButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Adicionar Recompensa
    </Button>
  );

  const EditRewardButton = ({ reward }: { reward: Reward }) => (
    <ActionDialog
        title="Editar Recompensa"
        description="Atualize os detalhes da recompensa."
        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
        actionText="Salvar Alterações"
    >
        <RewardForm reward={reward} />
    </ActionDialog>
  );

  const RewardForm = ({ reward }: { reward?: Reward }) => (
    <>
      <div className="space-y-2">
        <Label htmlFor="reward-name">Nome da Recompensa</Label>
        <Input id="reward-name" placeholder="Ex: Vale-presente iFood R$50" defaultValue={reward?.name} />
      </div>
       <div className="space-y-2">
        <Label htmlFor="reward-points">Custo (Pontos)</Label>
        <Input id="reward-points" type="number" placeholder="Ex: 5000" defaultValue={reward?.points} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reward-stock">Estoque</Label>
        <Input id="reward-stock" type="number" placeholder="Deixe em branco para ilimitado" defaultValue={reward?.stock === 'Ilimitado' ? '' : reward?.stock} />
      </div>
    </>
  );

  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Tabs defaultValue="loja">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="loja">Loja de Recompensas</TabsTrigger>
              <TabsTrigger value="historico">Histórico de Resgates</TabsTrigger>
            </TabsList>
            <ActionDialog
              title="Adicionar Nova Recompensa"
              description="Cadastre uma nova recompensa na loja para seus colaboradores."
              trigger={addRewardButton}
              actionText="Salvar Recompensa"
            >
              <RewardForm />
            </ActionDialog>
          </div>
          <TabsContent value="loja" className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-muted-foreground" />
                        Prêmio do Mês (Top 1 Ranking)
                    </CardTitle>
                    <CardDescription>Selecione qual recompensa da loja será o prêmio para o primeiro lugar do ranking neste mês.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-xs">
                        <Label htmlFor="monthly-prize">Recompensa</Label>
                        <Select defaultValue="day-off">
                            <SelectTrigger id="monthly-prize">
                                <SelectValue placeholder="Selecione uma recompensa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ifood-50">Vale-presente iFood R$50</SelectItem>
                                <SelectItem value="day-off">Day Off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button>Salvar Prêmio do Mês</Button>
                </CardFooter>
            </Card>
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
                    {rewards.map((reward) => (
                        <TableRow key={reward.name} className={reward.status === 'Desativada' ? 'text-muted-foreground' : ''}>
                          <TableCell className="font-medium">{reward.name}</TableCell>
                          <TableCell>{reward.points}</TableCell>
                          <TableCell>{reward.stock}</TableCell>
                          <TableCell><Badge variant={reward.status === 'Disponível' ? 'default' : 'outline'}>{reward.status}</Badge></TableCell>
                           <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <EditRewardButton reward={reward} />
                                <DropdownMenuItem>{reward.status === 'Disponível' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                    ))}
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
