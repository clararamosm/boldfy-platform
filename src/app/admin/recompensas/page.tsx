// src/app/admin/recompensas/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { markRescueAsPaid, addVoucherCodes, getCodeStats, getCodeHistory } from '@/app/actions';
import { getAuthToken } from '@/lib/auth-client';
import { REWARD_SUGGESTIONS, type RewardSuggestion } from '@/lib/reward-suggestions';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Trophy, Loader2, Lightbulb, ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoinIcon } from "@/components/coin-icon";
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/context';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';
import { completeOnboardingItem } from '@/hooks/use-onboarding';

// ─── Types ────────────────────────────────────────────────────────

type Reward = {
  id: string;
  name: string;
  points: number;
  stock: string | number;
  status: 'Disponível' | 'Desativada';
  isNative?: boolean;
  deliveryMethod?: 'manual' | 'code' | 'instant';
  type?: string;
};

type Rescue = {
  id: string;
  userId: string;
  userName: string;
  rewardName: string;
  date: { toDate?: () => Date } | string | null;
  points: number;
  status: 'Pendente' | 'Pago';
  deliveryMethod?: string;
};

type MaskedCode = {
  id: string;
  maskedCode: string;
  status: 'available' | 'used';
  usedByName?: string;
  usedAt?: string;
};

// ─── CodeManager Component ────────────────────────────────────────

function CodeManager({ companyId, rewardId }: { companyId: string; rewardId: string }) {
  const t = useT();
  const { toast } = useToast();
  const [stats, setStats] = useState<{ available: number; used: number } | null>(null);
  const [codes, setCodes] = useState<MaskedCode[]>([]);
  const [newCodes, setNewCodes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const [statsResult, historyResult] = await Promise.all([
        getCodeStats(token, companyId, rewardId),
        getCodeHistory(token, companyId, rewardId),
      ]);
      if (!statsResult.error) setStats({ available: statsResult.available, used: statsResult.used });
      if (!historyResult.error) setCodes(historyResult.codes);
    } catch (err) {
      console.error('Error fetching code stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [companyId, rewardId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleAddCodes = async () => {
    const lines = newCodes.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setIsAdding(true);
    try {
      const token = await getAuthToken();
      const result = await addVoucherCodes(token, companyId, rewardId, lines);
      if (result.error) {
        toast({ variant: 'destructive', title: t.adminRewards.toastCodesError, description: result.error });
      } else {
        toast({ title: t.adminRewards.toastCodesAdded.replace('{count}', String(result.added || 0)) });
        setNewCodes('');
        fetchStats();
      }
    } catch (err) {
      console.error('Error adding codes:', err);
      toast({ variant: 'destructive', title: t.adminRewards.toastCodesError });
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Package className="h-4 w-4" />
        {t.adminRewards.manageCodes}
      </h4>

      {/* Stats */}
      {stats && (
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">
            {t.adminRewards.codesAvailable}: {stats.available}
          </span>
          <span className="text-muted-foreground">
            {t.adminRewards.codesUsed}: {stats.used}
          </span>
        </div>
      )}

      {/* Add codes */}
      <div className="space-y-2">
        <Label className="text-xs">{t.adminRewards.addCodes}</Label>
        <Textarea
          placeholder={t.adminRewards.addCodesPlaceholder}
          value={newCodes}
          onChange={(e) => setNewCodes(e.target.value)}
          rows={4}
          className="font-mono text-xs"
          disabled={isAdding}
        />
        <Button
          size="sm"
          onClick={handleAddCodes}
          disabled={isAdding || !newCodes.trim()}
        >
          {isAdding && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {t.adminRewards.addCodes}
        </Button>
      </div>

      {/* History */}
      {codes.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs">{t.adminRewards.codesHistory}</Label>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-background">
                <code className="font-mono">{c.maskedCode}</code>
                {c.status === 'used' ? (
                  <span className="text-muted-foreground">
                    {c.usedByName} — {c.usedAt ? new Date(c.usedAt).toLocaleDateString() : ''}
                  </span>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
                    {t.adminRewards.statusAvailable}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.adminRewards.noCodesYet}</p>
      )}
    </div>
  );
}

// ─── RewardSuggestionsDialog ──────────────────────────────────────

function RewardSuggestionsDialog({
  onCreateFromSuggestion,
}: {
  onCreateFromSuggestion: (s: RewardSuggestion) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const categories: { key: RewardSuggestion['category']; label: string }[] = [
    { key: 'micro', label: t.adminRewards.suggestionsCategoryMicro },
    { key: 'medium', label: t.adminRewards.suggestionsCategoryMedium },
    { key: 'aspirational', label: t.adminRewards.suggestionsCategoryAspirational },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lightbulb className="mr-2 h-4 w-4" />
          {t.adminRewards.viewSuggestions}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.adminRewards.suggestionsTitle}</DialogTitle>
          <DialogDescription>{t.adminRewards.suggestionsSubtitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {categories.map(({ key, label }) => (
            <div key={key}>
              <h3 className="font-semibold text-sm mb-3">{label}</h3>
              <div className="grid gap-3">
                {REWARD_SUGGESTIONS.filter(s => s.category === key).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CoinIcon size="xs" /> {s.suggestedPoints.toLocaleString()} pts
                        </span>
                        <span>{t.adminRewards.suggestionsRealValue}: {s.realValue}</span>
                        {s.whereToBuyUrl ? (
                          <a href={s.whereToBuyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                            {s.whereToBuy} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{s.whereToBuy}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {s.delivery === 'code' ? t.adminRewards.deliveryBadgeCode : t.adminRewards.deliveryBadgeManual}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-3 shrink-0 text-xs"
                      onClick={() => {
                        onCreateFromSuggestion(s);
                        setOpen(false);
                      }}
                    >
                      <PlusCircle className="mr-1 h-3 w-3" />
                      {t.adminRewards.suggestionsCreateReward}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── RewardForm ───────────────────────────────────────────────────

const RewardForm = ({
  reward,
  isSubmitting,
  formRef,
  companyId,
  deliveryMethod,
  setDeliveryMethod,
}: {
  reward?: Reward;
  isSubmitting: boolean;
  formRef: React.RefObject<HTMLFormElement>;
  companyId?: string | null;
  deliveryMethod: string;
  setDeliveryMethod: (v: string) => void;
}) => {
  const t = useT();
  const isCodeDelivery = deliveryMethod === 'code';

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
        <Label htmlFor="reward-delivery">{t.adminRewards.deliveryMethod}</Label>
        <Select value={deliveryMethod} onValueChange={setDeliveryMethod} disabled={isSubmitting}>
          <SelectTrigger id="reward-delivery">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">{t.adminRewards.deliveryManual}</SelectItem>
            <SelectItem value="code">{t.adminRewards.deliveryCode}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reward-stock">{t.adminRewards.stock}</Label>
        {isCodeDelivery ? (
          <Input
            id="reward-stock"
            name="stock"
            value={t.adminRewards.stockManagedByCodes}
            disabled
            className="text-muted-foreground"
          />
        ) : (
          <Input id="reward-stock" name="stock" type="number" placeholder={t.adminRewards.stockHelp} defaultValue={reward?.stock === 'Ilimitado' ? '' : reward?.stock} disabled={isSubmitting} />
        )}
      </div>

      {/* Inline CodeManager for existing code-delivery rewards */}
      {isCodeDelivery && reward?.id && companyId && (
        <CodeManager companyId={companyId} rewardId={reward.id} />
      )}
    </form>
  );
};

// ─── Delivery badge helper ────────────────────────────────────────

function getDeliveryBadge(method: string | undefined, t: ReturnType<typeof useT>) {
  switch (method) {
    case 'code':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">{t.adminRewards.deliveryBadgeCode}</Badge>;
    case 'instant':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">{t.adminRewards.deliveryBadgeInstant}</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.adminRewards.deliveryBadgeManual}</Badge>;
  }
}

// ─── Main Page ────────────────────────────────────────────────────

export default function AdminRecompensasPage() {
  const { toast } = useToast();
  const t = useT();
  const { user } = useAuth();
  const companyId = useResolvedCompanyId();
  const { company } = useCompanyData(companyId);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [monthlyPrize, setMonthlyPrize] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteRewardId, setDeleteRewardId] = useState<string | null>(null);
  const [deleteRewardName, setDeleteRewardName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('manual');
  const [editingReward, setEditingReward] = useState<Reward | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const fetchRewards = useCallback(async (currentCompanyId: string) => {
    try {
      const rewardsCollection = collection(db, "companies", currentCompanyId, "rewards");
      const rewardsSnapshot = await getDocs(rewardsCollection);
      const rewardsList = rewardsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reward));
      setRewards(rewardsList);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastFetchError });
    }
  }, [toast, t]);

  const fetchRescues = useCallback(async (currentCompanyId: string) => {
    try {
      const rescuesCollection = collection(db, "companies", currentCompanyId, "rescues");
      const rescuesSnapshot = await getDocs(rescuesCollection);
      const rescuesList = rescuesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rescue));
      setRescues(rescuesList);
    } catch (error) {
      console.error("Error fetching rescues:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastFetchHistoryError });
    }
  }, [toast, t]);

  useEffect(() => {
    if (company?.monthlyPrize !== undefined) {
      setMonthlyPrize(company.monthlyPrize || '');
    }
  }, [company]);

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
    if (!formRef.current || !companyId) return;

    setIsSubmitting(true);
    const formData = new FormData(formRef.current);
    const name = formData.get('name') as string;
    const points = Number(formData.get('points'));
    const stockInput = formData.get('stock') as string;

    // For code delivery, stock is managed automatically
    const stock = deliveryMethod === 'code'
      ? 0
      : (stockInput && !isNaN(Number(stockInput)) ? Number(stockInput) : 'Ilimitado');

    if (!name || !points) {
      toast({ variant: 'destructive', title: t.adminRewards.requiredFields, description: t.adminRewards.requiredFieldsMessage });
      setIsSubmitting(false);
      return;
    }

    const rewardData = {
      name,
      points,
      stock,
      status: 'Disponível' as const,
      deliveryMethod: deliveryMethod as 'manual' | 'code' | 'instant',
    };

    try {
      if (rewardId) {
        const rewardDoc = doc(db, "companies", companyId, "rewards", rewardId);
        await updateDoc(rewardDoc, rewardData);
        toast({ title: t.adminRewards.toastUpdated });
      } else {
        await addDoc(collection(db, "companies", companyId, "rewards"), rewardData);
        toast({ title: t.adminRewards.toastCreated });
        completeOnboardingItem(user?.uid, 'add-reward');
      }
      fetchRewards(companyId);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving reward:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastSaveError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reward: Reward) => {
    if (!companyId) return;
    try {
      const rewardDoc = doc(db, "companies", companyId, "rewards", reward.id);
      const newStatus = reward.status === 'Disponível' ? 'Desativada' : 'Disponível';
      await updateDoc(rewardDoc, { status: newStatus });
      toast({ title: t.adminRewards.toastStatusChanged.replace('{status}', newStatus) });
      fetchRewards(companyId);
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastStatusError });
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!companyId || !deleteRewardId) return;
    try {
      const rewardDoc = doc(db, "companies", companyId, "rewards", deleteRewardId);
      await deleteDoc(rewardDoc);
      toast({ title: t.adminRewards.toastDeleted });
      setDeleteRewardId(null);
      setDeleteRewardName('');
      fetchRewards(companyId);
    } catch (error) {
      console.error("Error deleting reward:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastDeleteError });
    }
  };

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
  };

  const handleSaveMonthlyPrize = async () => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      const companyDocRef = doc(db, "companies", companyId);
      await setDoc(companyDocRef, { monthlyPrize }, { merge: true });
      toast({ title: t.adminRewards.toastMonthlyPrizeSaved });
    } catch (error) {
      console.error("Error saving monthly prize:", error);
      toast({ variant: 'destructive', title: t.adminRewards.toastMonthlyPrizeSaveError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFromSuggestion = (s: RewardSuggestion) => {
    setEditingReward(undefined);
    setDeliveryMethod(s.delivery);
    setIsDialogOpen(true);

    // Pre-fill form after dialog renders
    requestAnimationFrame(() => {
      if (formRef.current) {
        const nameInput = formRef.current.querySelector<HTMLInputElement>('[name="name"]');
        const pointsInput = formRef.current.querySelector<HTMLInputElement>('[name="points"]');
        if (nameInput) nameInput.value = s.name;
        if (pointsInput) pointsInput.value = String(s.suggestedPoints);
      }
    });
  };

  const openAddDialog = () => {
    setEditingReward(undefined);
    setDeliveryMethod('manual');
    setIsDialogOpen(true);
  };

  const openEditDialog = (reward: Reward) => {
    setEditingReward(reward);
    setDeliveryMethod(reward.deliveryMethod || 'manual');
  };

  const addRewardButton = (
    <Button size="sm" disabled={isSubmitting || !companyId} onClick={openAddDialog}>
      <PlusCircle className="mr-2 h-4 w-4" />
      {t.adminRewards.addReward}
    </Button>
  );

  const EditRewardButton = ({ reward }: { reward: Reward }) => (
    <ActionDialog
      title={t.adminRewards.editTitle}
      description={t.adminRewards.editDescription}
      trigger={<DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditDialog(reward); }}>{t.common.edit}</DropdownMenuItem>}
      actionText={isSubmitting ? t.common.saving : t.common.saveChanges}
      onAction={() => handleAction(reward.id)}
      formId="reward-form"
    >
      <RewardForm
        reward={reward}
        isSubmitting={isSubmitting}
        formRef={formRef}
        companyId={companyId}
        deliveryMethod={deliveryMethod}
        setDeliveryMethod={setDeliveryMethod}
      />
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
            <div className="flex items-center gap-2">
              <RewardSuggestionsDialog onCreateFromSuggestion={handleCreateFromSuggestion} />
              {addRewardButton}
            </div>
          </div>

          {/* Add / Edit Reward Dialog (controlled) */}
          <ActionDialog
            title={editingReward ? t.adminRewards.editTitle : t.adminRewards.addTitle}
            description={editingReward ? t.adminRewards.editDescription : t.adminRewards.addDescription}
            trigger={<span className="hidden" />}
            actionText={isSubmitting ? t.common.saving : (editingReward ? t.common.saveChanges : t.adminRewards.saveReward)}
            onAction={() => handleAction(editingReward?.id)}
            formId="reward-form"
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          >
            <RewardForm
              reward={editingReward}
              isSubmitting={isSubmitting}
              formRef={formRef}
              companyId={companyId}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
            />
          </ActionDialog>

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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.adminRewards.tableReward}</TableHead>
                        <TableHead>{t.adminRewards.tableCost}</TableHead>
                        <TableHead>{t.adminRewards.tableStock}</TableHead>
                        <TableHead>{t.adminRewards.deliveryMethod}</TableHead>
                        <TableHead>{t.common.status}</TableHead>
                        <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? <TableSkeleton cols={6} /> : rewards.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8">{t.adminRewards.empty}</TableCell></TableRow>
                      ) : rewards.map((reward) => (
                        <TableRow key={reward.id} className={reward.status === 'Desativada' ? 'text-muted-foreground' : ''}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              {reward.name}
                              {reward.isNative && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                  {t.gamification?.nativeReward || 'Boldfy'}
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>{reward.points}</TableCell>
                          <TableCell>
                            {reward.deliveryMethod === 'code'
                              ? t.adminRewards.stockManagedByCodes
                              : reward.stock === 'Ilimitado'
                                ? t.adminRewards.stockUnlimited
                                : reward.stock}
                          </TableCell>
                          <TableCell>{getDeliveryBadge(reward.deliveryMethod, t)}</TableCell>
                          <TableCell>
                            <Badge variant={reward.status === 'Disponível' ? 'default' : 'outline'}>
                              {reward.status === 'Disponível' ? t.adminRewards.statusAvailable : t.adminRewards.statusDisabled}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!reward.isNative && <EditRewardButton reward={reward} />}
                                <DropdownMenuItem onSelect={() => handleToggleStatus(reward)}>
                                  {reward.status === 'Disponível' ? t.common.deactivate : t.common.activate}
                                </DropdownMenuItem>
                                {!reward.isNative && (
                                  <DropdownMenuItem className="text-destructive" onSelect={() => { setDeleteRewardId(reward.id); setDeleteRewardName(reward.name); }}>
                                    {t.common.delete}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
                <div className="overflow-x-auto">
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
                      {isLoading ? <TableSkeleton cols={6} /> : rescues.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8">{t.adminRewards.historyEmpty}</TableCell></TableRow>
                      ) : rescues.map((rescue) => (
                        <TableRow key={rescue.id}>
                          <TableCell className="font-medium">{rescue.userName}</TableCell>
                          <TableCell>{rescue.rewardName}</TableCell>
                          <TableCell>{rescue.points?.toLocaleString() || '—'}</TableCell>
                          <TableCell>
                            {rescue.date && typeof rescue.date === 'object' && rescue.date !== null && 'toDate' in rescue.date && typeof rescue.date.toDate === 'function'
                              ? rescue.date.toDate().toLocaleDateString()
                              : rescue.date
                                ? new Date(rescue.date as string).toLocaleDateString()
                                : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={rescue.status === 'Pendente' ? 'destructive' : 'default'}
                              className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {rescue.status === 'Pendente' ? t.adminRewards.statusPending : t.adminRewards.paid}
                            </Badge>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <ActionDialog
          open={!!deleteRewardId}
          onOpenChange={(open) => { if (!open) { setDeleteRewardId(null); setDeleteRewardName(''); } }}
          title={'Excluir recompensa'}
          description={t.adminRewards.deleteConfirm}
        >
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setDeleteRewardId(null); setDeleteRewardName(''); }}>{t.common.cancel || 'Cancelar'}</Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed}>{t.common.delete}</Button>
          </div>
        </ActionDialog>
      </main>
    </>
  );
}
