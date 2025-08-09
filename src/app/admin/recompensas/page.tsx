
'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Trophy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type Reward = {
    id: string;
    name: string;
    points: number;
    stock: string | number;
    status: 'Disponível' | 'Desativada';
};

type Rescue = {
    id: string;
    userName: string;
    rewardName: string;
    date: string;
    status: 'Pendente' | 'Pago';
}

const RewardForm = ({ reward, isSubmitting }: { reward?: Reward, isSubmitting: boolean }) => (
    <>
      <div className="space-y-2">
        <Label htmlFor="reward-name">Nome da Recompensa</Label>
        <Input id="reward-name" name="name" placeholder="Ex: Vale-presente iFood R$50" defaultValue={reward?.name} disabled={isSubmitting} required />
      </div>
       <div className="space-y-2">
        <Label htmlFor="reward-points">Custo (Pontos)</Label>
        <Input id="reward-points" name="points" type="number" placeholder="Ex: 5000" defaultValue={reward?.points} disabled={isSubmitting} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reward-stock">Estoque</Label>
        <Input id="reward-stock" name="stock" type="number" placeholder="Deixe em branco para ilimitado" defaultValue={reward?.stock === 'Ilimitado' ? '' : reward?.stock} disabled={isSubmitting} />
      </div>
    </>
);


export default function AdminRecompensasPage() {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, fetch from Firestore
                const mockRewards: Reward[] = [
                    { id: "1", name: "Vale-presente iFood R$50", points: 5000, stock: 15, status: "Disponível" },
                    { id: "2", name: "Day Off", points: 10000, stock: "Ilimitado", status: "Disponível" },
                    { id: "3", name: "Vale-presente Spotify", points: 3000, stock: 0, status: "Desativada" },
                ];
                const mockRescues: Rescue[] = [
                    { id: "r1", userName: "Carla Costa", rewardName: "Vale-presente iFood R$50", date: "2024-07-10", status: "Pendente" },
                    { id: "r2", userName: "João Paulo", rewardName: "Day Off", date: "2024-07-05", status: "Pago" },
                ];

                await new Promise(resolve => setTimeout(resolve, 1000));
                setRewards(mockRewards);
                setRescues(mockRescues);
            } catch (error) {
                console.error("Error fetching data:", error);
                // Handle error with toast
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleAction = async (rewardId?: string) => {
        setIsSubmitting(true);
        // TODO: Implement create/update logic for Firestore
        console.log("Submitting form for reward:", rewardId);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        // Close dialog and show toast
    }

    const addRewardButton = (
        <Button size="sm" disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Recompensa
        </Button>
    );

    const EditRewardButton = ({ reward }: { reward: Reward }) => (
        <ActionDialog
            title="Editar Recompensa"
            description="Atualize os detalhes da recompensa."
            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
            actionText={isSubmitting ? "Salvando..." : "Salvar Alterações"}
            onAction={() => handleAction(reward.id)}
        >
            <RewardForm reward={reward} isSubmitting={isSubmitting} />
        </ActionDialog>
    );

    const TableSkeleton = ({ cols }) => (
        <TableRow>
            <TableCell colSpan={cols} className="text-center">
                <div className="flex justify-center items-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2">Carregando...</span>
                </div>
            </TableCell>
        </TableRow>
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
              actionText={isSubmitting ? "Salvando..." : "Salvar Recompensa"}
              onAction={() => handleAction()}
            >
              <RewardForm isSubmitting={isSubmitting} />
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
                                {rewards.filter(r => r.status === 'Disponível').map(r => (
                                     <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button disabled={isSubmitting}>Salvar Prêmio do Mês</Button>
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
                    {isLoading ? <TableSkeleton cols={5} /> : rewards.map((reward) => (
                        <TableRow key={reward.id} className={reward.status === 'Desativada' ? 'text-muted-foreground' : ''}>
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
                    {isLoading ? <TableSkeleton cols={5} /> : rescues.map((rescue) => (
                         <TableRow key={rescue.id}>
                          <TableCell className="font-medium">{rescue.userName}</TableCell>
                          <TableCell>{rescue.rewardName}</TableCell>
                          <TableCell>{rescue.date}</TableCell>
                          <TableCell>
                            <Badge variant={rescue.status === 'Pendente' ? 'destructive' : 'default'} className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}>{rescue.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" disabled={rescue.status === 'Pago'}>
                                {rescue.status === 'Pendente' ? 'Marcar como Pago' : 'Pago'}
                            </Button>
                          </TableCell>
                        </TableRow>
                    ))}
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
