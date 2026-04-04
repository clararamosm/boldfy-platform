// src/app/admin/recompensas/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { markRescueAsPaid } from '@/app/actions';
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
import { useToast } from '@/hooks/use-toast';

type Reward = {
    id: string;
    name: string;
    points: number;
    stock: string | number;
    status: 'Disponível' | 'Desativada';
};

type Rescue = {
    id: string;
    userId: string;
    userName: string;
    rewardName: string;
    date: any;
    points: number;
    status: 'Pendente' | 'Pago';
}

const RewardForm = ({ reward, isSubmitting, formRef }: { reward?: Reward, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement> }) => (
    <form id="reward-form" ref={formRef} className="space-y-4">
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
    </form>
);


export default function AdminRecompensasPage() {
    const { toast } = useToast();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [monthlyPrize, setMonthlyPrize] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const fetchRewards = useCallback(async (currentCompanyId: string) => {
        try {
            const rewardsCollection = collection(db, "companies", currentCompanyId, "rewards");
            const rewardsSnapshot = await getDocs(rewardsCollection);
            const rewardsList = rewardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
            setRewards(rewardsList);
        } catch (error) {
            console.error("Error fetching rewards:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar recompensas.' });
        }
    }, [toast]);

     const fetchRescues = useCallback(async (currentCompanyId: string) => {
        try {
            const rescuesCollection = collection(db, "companies", currentCompanyId, "rescues");
            const rescuesSnapshot = await getDocs(rescuesCollection);
            const rescuesList = rescuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rescue));
            setRescues(rescuesList);
        } catch (error) {
            console.error("Error fetching rescues:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar resgates.' });
        }
    }, [toast]);
    
    const fetchMonthlyPrize = useCallback(async (currentCompanyId: string) => {
        try {
            const companyDocRef = doc(db, "companies", currentCompanyId);
            const companyDoc = await getDoc(companyDocRef);
            if(companyDoc.exists()) {
                setMonthlyPrize(companyDoc.data()?.monthlyPrize || '');
            }
        } catch (error) {
             console.error("Error fetching monthly prize:", error);
        }
    }, []);

    const fetchData = useCallback(async (currentCompanyId: string) => {
        setIsLoading(true);
        await Promise.all([
            fetchRewards(currentCompanyId), 
            fetchRescues(currentCompanyId), 
            fetchMonthlyPrize(currentCompanyId)
        ]);
        setIsLoading(false);
    }, [fetchRewards, fetchRescues, fetchMonthlyPrize]);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userCompanyId = userDocSnap.data().companyId;
                    setCompanyId(userCompanyId);
                    fetchData(userCompanyId);
                } else {
                     toast({ variant: "destructive", title: "Usuário não encontrado."});
                     setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchData, toast]);

    const handleAction = async (rewardId?: string) => {
        if(!formRef.current || !companyId) return;

        setIsSubmitting(true);
        const formData = new FormData(formRef.current);
        const name = formData.get('name') as string;
        const points = Number(formData.get('points'));
        const stockInput = formData.get('stock') as string;
        const stock = stockInput && !isNaN(Number(stockInput)) ? Number(stockInput) : 'Ilimitado';

        if(!name || !points) {
            toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Nome e pontos são obrigatórios.' });
            setIsSubmitting(false);
            return;
        }

        const rewardData = { name, points, stock, status: 'Disponível' as const };

        try {
            if (rewardId) {
                const rewardDoc = doc(db, "companies", companyId, "rewards", rewardId);
                await updateDoc(rewardDoc, rewardData);
                toast({ title: 'Recompensa atualizada!' });
            } else {
                await addDoc(collection(db, "companies", companyId, "rewards"), rewardData);
                toast({ title: 'Recompensa criada!' });
            }
            fetchRewards(companyId);
            setIsDialogOpen(false); // Close dialog on success
        } catch (error) {
            console.error("Error saving reward:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar recompensa.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleToggleStatus = async (reward: Reward) => {
        if (!companyId) return;
        try {
            const rewardDoc = doc(db, "companies", companyId, "rewards", reward.id);
            const newStatus = reward.status === 'Disponível' ? 'Desativada' : 'Disponível';
            await updateDoc(rewardDoc, { status: newStatus });
            toast({ title: `Status alterado para ${newStatus}` });
            fetchRewards(companyId);
        } catch(error) {
             console.error("Error toggling status:", error);
            toast({ variant: 'destructive', title: 'Erro ao alterar status.' });
        }
    }

    const handleDelete = async (rewardId: string) => {
        if (!companyId || !confirm('Tem certeza que deseja excluir esta recompensa?')) return;
        try {
            const rewardDoc = doc(db, "companies", companyId, "rewards", rewardId);
            await deleteDoc(rewardDoc);
            toast({ title: 'Recompensa excluída.' });
            fetchRewards(companyId);
        } catch (error) {
            console.error("Error deleting reward:", error);
            toast({ variant: 'destructive', title: 'Erro ao excluir recompensa.' });
        }
    }

    const handleMarkAsPaid = async (rescue: Rescue) => {
        if (!companyId) return;
        try {
            const result = await markRescueAsPaid(rescue.id, companyId, rescue.userId);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao marcar como pago.', description: result.error });
                return;
            }
            toast({ title: 'Resgate marcado como pago.' });
            fetchRescues(companyId);
        } catch (error) {
            console.error("Error marking as paid:", error);
            toast({ variant: 'destructive', title: 'Erro ao marcar como pago.' });
        }
    }
    
    const handleSaveMonthlyPrize = async () => {
        if (!companyId) return;
        setIsSubmitting(true);
        try {
            const companyDocRef = doc(db, "companies", companyId);
            await setDoc(companyDocRef, { monthlyPrize }, { merge: true });
            toast({ title: "Prêmio do mês salvo com sucesso!"});
        } catch(error) {
            console.error("Error saving monthly prize: ", error);
            toast({ variant: 'destructive', title: "Erro ao salvar prêmio do mês."});
        } finally {
            setIsSubmitting(false);
        }
    }

    const addRewardButton = (
        <Button size="sm" disabled={isSubmitting || !companyId}>
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
            formId="reward-form"
        >
            <RewardForm reward={reward} isSubmitting={isSubmitting} formRef={formRef}/>
        </ActionDialog>
    );

    const TableSkeleton = ({ cols }: { cols: number }) => (
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
              formId="reward-form"
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
            >
              <RewardForm isSubmitting={isSubmitting} formRef={formRef} />
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
                        <Select value={monthlyPrize} onValueChange={setMonthlyPrize} disabled={isLoading || !companyId}>
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
                    <Button disabled={isSubmitting || !companyId} onClick={handleSaveMonthlyPrize}>
                        {isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                        Salvar Prêmio do Mês
                    </Button>
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
                    {isLoading ? <TableSkeleton cols={5} /> : rewards.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhuma recompensa encontrada.</TableCell></TableRow>
                    ) : rewards.map((reward) => (
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
                                <DropdownMenuItem onSelect={() => handleToggleStatus(reward)}>{reward.status === 'Disponível' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(reward.id)}>Excluir</DropdownMenuItem>
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
                      <TableHead>Pontos</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton cols={5} /> : rescues.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhum resgate encontrado.</TableCell></TableRow>
                    ) : rescues.map((rescue) => (
                         <TableRow key={rescue.id}>
                          <TableCell className="font-medium">{rescue.userName}</TableCell>
                          <TableCell>{rescue.rewardName}</TableCell>
                          <TableCell>{rescue.points?.toLocaleString() || '—'}</TableCell>
                          <TableCell>{rescue.date?.toDate ? rescue.date.toDate().toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={rescue.status === 'Pendente' ? 'destructive' : 'default'} className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}>{rescue.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" disabled={rescue.status === 'Pago'} onClick={() => handleMarkAsPaid(rescue)}>
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
