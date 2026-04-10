// src/app/admin/recompensas/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { markRescueAsPaid } from '@/app/actions';
import { getAuthToken } from '@/lib/auth-client';
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
import { useT } from '@/lib/i18n/context';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';

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

const RewardForm = ({ reward, isSubmitting, formRef }: { reward?: Reward, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement> }) => {
    const t = useT();
    return (
    <form id="reward-form" ref={formRef} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reward-name">{t.adminRewards.rewardName}</Label>
        <Input id="reward-name" name="name" placeholder={t.adminRewards.rewardNamePlaceholder} defaultValue={reward?.name} disabled={isSubmitting} required />
      </div>
       <div className="space-y-2">
        <Label htmlFor="reward-points">{t.adminRewards.costPoints}</Label>
        <Input id="reward-points" name="points" type="number" placeholder={t.adminRewards.costPlaceholder} defaultValue={reward?.points} disabled={isSubmitting} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reward-stock">{t.adminRewards.stock}</Label>
        <Input id="reward-stock" name="stock" type="number" placeholder={t.adminRewards.stockHelp} defaultValue={reward?.stock === 'Ilimitado' ? '' : reward?.stock} disabled={isSubmitting} />
      </div>
    </form>
    );
};


export default function AdminRecompensasPage() {
    const { toast } = useToast();
    const t = useT();
    const { user } = useAuth();
    const companyId = user?.companyId || null;
    const { company } = useCompanyData(companyId);

    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [monthlyPrize, setMonthlyPrize] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            toast({ variant: 'destructive', title: t.adminRewards.toastFetchError });
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
            toast({ variant: 'destructive', title: t.adminRewards.toastFetchHistoryError });
        }
    }, [toast]);
    
    // Sync monthlyPrize from company doc
    useEffect(() => {
        if (company?.monthlyPrize !== undefined) {
            setMonthlyPrize(company.monthlyPrize || '');
        }
    }, [company]);

    // Fetch rewards + rescues when companyId becomes available
    useEffect(() => {
        if (!companyId) return;
        const fetchAll = async () => {
            setIsLoading(true);
            await Promise.all([fetchRewards(companyId), fetchRescues(companyId)]);
            setIsLoading(false);
        };
        fetchAll();
    }, [companyId, fetchRewards, fetchRescues]);

    const handleAction = async (rewardId?: string) => {
        if(!formRef.current || !companyId) return;

        setIsSubmitting(true);
        const formData = new FormData(formRef.current);
        const name = formData.get('name') as string;
        const points = Number(formData.get('points'));
        const stockInput = formData.get('stock') as string;
        const stock = stockInput && !isNaN(Number(stockInput)) ? Number(stockInput) : 'Ilimitado';

        if(!name || !points) {
            toast({ variant: 'destructive', title: t.adminRewards.requiredFields, description: t.adminRewards.requiredFieldsMessage });
            setIsSubmitting(false);
            return;
        }

        const rewardData = { name, points, stock, status: 'Disponível' as const };

        try {
            if (rewardId) {
                const rewardDoc = doc(db, "companies", companyId, "rewards", rewardId);
                await updateDoc(rewardDoc, rewardData);
                toast({ title: t.adminRewards.toastUpdated });
            } else {
                await addDoc(collection(db, "companies", companyId, "rewards"), rewardData);
                toast({ title: t.adminRewards.toastCreated });
            }
            fetchRewards(companyId);
            setIsDialogOpen(false); // Close dialog on success
        } catch (error) {
            console.error("Error saving reward:", error);
            toast({ variant: 'destructive', title: t.adminRewards.toastSaveError });
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
            toast({ title: t.adminRewards.toastStatusChanged.replace('{status}', newStatus) });
            fetchRewards(companyId);
        } catch(error) {
             console.error("Error toggling status:", error);
            toast({ variant: 'destructive', title: t.adminRewards.toastStatusError });
        }
    }

    const handleDelete = async (rewardId: string) => {
        if (!companyId || !confirm(t.adminRewards.deleteConfirm)) return;
        try {
            const rewardDoc = doc(db, "companies", companyId, "rewards", rewardId);
            await deleteDoc(rewardDoc);
            toast({ title: t.adminRewards.toastDeleted });
            fetchRewards(companyId);
        } catch (error) {
            console.error("Error deleting reward:", error);
            toast({ variant: 'destructive', title: t.adminRewards.toastDeleteError });
        }
    }

    const handleMarkAsPaid = async (rescue: Rescue) => {
        if (!companyId) return;
        try {
            const token = await getAuthToken();
            const result = await markRescueAsPaid(token, rescue.id, companyId, rescue.userId);
            if (result.error) {
                toast({ variant: 'destructive', title: t.adminRewards.toastPaidError, description: result.error });
                return;
            }
            toast({ title: t.adminRewards.toastPaid });
            fetchRescues(companyId);
        } catch (error) {
            console.error("Error marking as paid:", error);
            toast({ variant: 'destructive', title: t.adminRewards.toastPaidError });
        }
    }
    
    const handleSaveMonthlyPrize = async () => {
        if (!companyId) return;
        setIsSubmitting(true);
        try {
            const companyDocRef = doc(db, "companies", companyId);
            await setDoc(companyDocRef, { monthlyPrize }, { merge: true });
            toast({ title: t.adminRewards.toastMonthlyPrizeSaved});
        } catch(error) {
            console.error("Error saving monthly prize: ", error);
            toast({ variant: 'destructive', title: t.adminRewards.toastMonthlyPrizeSaveError});
        } finally {
            setIsSubmitting(false);
        }
    }

    const addRewardButton = (
        <Button size="sm" disabled={isSubmitting || !companyId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.adminRewards.addReward}
        </Button>
    );

    const EditRewardButton = ({ reward }: { reward: Reward }) => (
        <ActionDialog
            title={t.adminRewards.editTitle}
            description={t.adminRewards.editDescription}
            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t.common.edit}</DropdownMenuItem>}
            actionText={isSubmitting ? t.common.saving : t.common.saveChanges}
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
                    <span className="ml-2">{t.common.loading}</span>
                </div>
            </TableCell>
        </TableRow>
    );

  return (
    <>
      <Header title={t.adminRewards.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Tabs defaultValue="loja">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="loja">{t.adminRewards.shopTab}</TabsTrigger>
              <TabsTrigger value="historico">{t.adminRewards.historyTab}</TabsTrigger>
            </TabsList>
            <ActionDialog
              title={t.adminRewards.addTitle}
              description={t.adminRewards.addDescription}
              trigger={addRewardButton}
              actionText={isSubmitting ? t.common.saving : t.adminRewards.saveReward}
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
                        {t.adminRewards.monthlyPrize}
                    </CardTitle>
                    <CardDescription>{t.adminRewards.monthlyPrizeDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-xs">
                        <Label htmlFor="monthly-prize">{t.adminRewards.tableReward}</Label>
                        <Select value={monthlyPrize} onValueChange={setMonthlyPrize} disabled={isLoading || !companyId}>
                            <SelectTrigger id="monthly-prize">
                                <SelectValue placeholder={t.adminRewards.monthlyPrizeSelect} />
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
                        {t.adminRewards.monthlyPrizeSave}
                    </Button>
                </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t.adminRewards.manageTitle}</CardTitle>
                <CardDescription>{t.adminRewards.manageDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.adminRewards.tableReward}</TableHead>
                      <TableHead>{t.adminRewards.tableCost}</TableHead>
                      <TableHead>{t.adminRewards.tableStock}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                      <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton cols={5} /> : rewards.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8">{t.adminRewards.empty}</TableCell></TableRow>
                    ) : rewards.map((reward) => (
                        <TableRow key={reward.id} className={reward.status === 'Desativada' ? 'text-muted-foreground' : ''}>
                          <TableCell className="font-medium">{reward.name}</TableCell>
                          <TableCell>{reward.points}</TableCell>
                          <TableCell>{reward.stock === 'Ilimitado' ? t.adminRewards.stockUnlimited : reward.stock}</TableCell>
                          <TableCell><Badge variant={reward.status === 'Disponível' ? 'default' : 'outline'}>{reward.status === 'Disponível' ? t.adminRewards.statusAvailable : t.adminRewards.statusDisabled}</Badge></TableCell>
                           <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <EditRewardButton reward={reward} />
                                <DropdownMenuItem onSelect={() => handleToggleStatus(reward)}>{reward.status === 'Disponível' ? t.common.deactivate : t.common.activate}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(reward.id)}>{t.common.delete}</DropdownMenuItem>
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
                <CardTitle>{t.adminRewards.historyTitle}</CardTitle>
                <CardDescription>{t.adminRewards.historyDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.adminRewards.historyCollaborator}</TableHead>
                      <TableHead>{t.adminRewards.historyReward}</TableHead>
                      <TableHead>{t.adminRewards.historyPoints}</TableHead>
                      <TableHead>{t.adminRewards.historyDate}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                      <TableHead>{t.adminRewards.historyAction}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton cols={5} /> : rescues.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8">{t.adminRewards.historyEmpty}</TableCell></TableRow>
                    ) : rescues.map((rescue) => (
                         <TableRow key={rescue.id}>
                          <TableCell className="font-medium">{rescue.userName}</TableCell>
                          <TableCell>{rescue.rewardName}</TableCell>
                          <TableCell>{rescue.points?.toLocaleString() || '—'}</TableCell>
                          <TableCell>{rescue.date?.toDate ? rescue.date.toDate().toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={rescue.status === 'Pendente' ? 'destructive' : 'default'} className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}>{rescue.status === 'Pendente' ? t.adminRewards.statusPending : t.adminRewards.paid}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" disabled={rescue.status === 'Pago'} onClick={() => handleMarkAsPaid(rescue)}>
                                {rescue.status === 'Pendente' ? t.adminRewards.markPaid : t.adminRewards.paid}
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
