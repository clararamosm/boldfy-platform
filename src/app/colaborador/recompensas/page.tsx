// src/app/colaborador/recompensas/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { getAuthToken } from '@/lib/auth-client';
import { redeemReward } from '@/app/actions';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, History, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Loader2, BookOpen, Trophy, FileText, Flame, Award, Zap, Copy, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ActionDialog } from '@/components/dashboard/action-dialog';
import { useT } from '@/lib/i18n/context';

// ─── Types ────────────────────────────────────────────────────────

type Reward = {
  id: string;
  title: string;
  name: string;
  points: number;
  imageUrl?: string;
  stock: number | 'Ilimitado';
  deliveryMethod?: 'manual' | 'code' | 'instant';
  type?: string;
  isNative?: boolean;
  status?: string;
  creditsAmount?: number;
};

type Rescue = {
  id: string;
  rewardName: string;
  date: { toDate?: () => Date } | string | null;
  status: 'Pendente' | 'Pago';
  code?: string;
  deliveryMethod?: string;
};

type HistoryItem = {
  id: string;
  icon: React.ReactNode;
  description: string;
  date: { toDate?: () => Date } | string | null;
  points: number;
  type: 'gain' | 'spend';
  source?: 'missao' | 'trilha' | 'resgate' | 'publicacao' | 'streak' | 'conquest' | 'extract';
};

// ─── CodeRevealDialog ─────────────────────────────────────────────

function CodeRevealDialog({
  open,
  onOpenChange,
  code,
  rewardName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  rewardName: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: t.colabRewards.codeCopied });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast({ title: t.colabRewards.codeCopied });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t.colabRewards.codeRedeemed}</DialogTitle>
          <DialogDescription className="text-center">{rewardName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Code display */}
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border-2 border-dashed border-primary/30">
            <code className="flex-1 text-center text-lg font-bold font-mono tracking-wider">
              {code}
            </code>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Warning */}
          <p className="text-sm text-muted-foreground text-center">
            {t.colabRewards.codeRedeemedMessage}
          </p>

          {/* Copy button */}
          <Button className="w-full" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {t.colabRewards.copyCode}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reward Card ──────────────────────────────────────────────────

const RewardCard = ({ reward, onRedeem, disabled, isSubmitting }: { reward: Reward; onRedeem: () => void; disabled: boolean; isSubmitting: boolean }) => {
  const t = useT();
  const isAiCredits = reward.type === 'ai_credits';
  return (
    <Card className={`hover:shadow-lg transition-shadow flex flex-col ${isAiCredits ? 'border-purple-200 dark:border-purple-800' : ''}`}>
      <CardHeader className="p-0">
        <div className={`aspect-video flex items-center justify-center rounded-t-lg overflow-hidden ${isAiCredits ? 'bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-900/20' : 'bg-muted'}`}>
          {reward.imageUrl ? (
            <Image src={reward.imageUrl} alt={reward.name} width={300} height={168} className="w-full h-full object-cover" data-ai-hint="reward gift" />
          ) : isAiCredits ? (
            <Sparkles className="h-12 w-12 text-purple-500" />
          ) : (
            <Gift className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-base font-semibold">{reward.name}</CardTitle>
        {/* Delivery method badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {isAiCredits && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
              <Sparkles className="h-3 w-3 mr-0.5" />
              {t.colabRewards.instantCredit || 'Crédito instantâneo'}
            </Badge>
          )}
          {reward.deliveryMethod === 'code' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
              <Zap className="h-3 w-3 mr-0.5" />
              {t.colabRewards.instantCode}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
          <CoinIcon size="xs" className="mr-1" /> {reward.points.toLocaleString()}
        </Badge>
        <ActionDialog
          title={`${t.colabRewards.redeem} ${reward.name}?`}
          description={t.colabRewards.redeemConfirmDescription}
          trigger={
            <Button size="sm" disabled={disabled || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : disabled ? t.colabRewards.insufficientPoints : t.colabRewards.redeem}
            </Button>
          }
          actionText={t.colabRewards.confirmRedeem}
          onAction={onRedeem}
          showCancel
        >
          <p>{t.colabRewards.redeemConfirmQuestion}</p>
        </ActionDialog>
      </CardFooter>
    </Card>
  );
};

// ─── AI Credits Card (Consolidated) ──────────────────────────────

const AiCreditsCard = ({
  rewards,
  availablePoints,
  onRedeem,
  isSubmitting,
}: {
  rewards: Reward[];
  availablePoints: number;
  onRedeem: (reward: Reward) => void;
  isSubmitting: boolean;
}) => {
  const t = useT();
  const [selectedId, setSelectedId] = useState(rewards[0]?.id || '');
  const selected = rewards.find(r => r.id === selectedId) || rewards[0];
  const disabled = !selected || availablePoints < selected.points;

  return (
    <Card className="border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow flex flex-col">
      <CardHeader className="p-0">
        <div className="aspect-video flex items-center justify-center rounded-t-lg overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-900/20">
          <Sparkles className="h-12 w-12 text-purple-500" />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-3">
        <div>
          <CardTitle className="text-base font-semibold">{t.colabRewards.aiCreditsTitle}</CardTitle>
          <CardDescription className="text-xs mt-1">{t.colabRewards.aiCreditsDescription}</CardDescription>
        </div>
        {/* Tier selector */}
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.colabRewards.selectCredits} />
          </SelectTrigger>
          <SelectContent>
            {rewards.map(r => (
              <SelectItem key={r.id} value={r.id}>
                +{r.creditsAmount} — {r.points.toLocaleString()} pts
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Badge */}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
          <Sparkles className="h-3 w-3 mr-0.5" />
          {t.colabRewards.instantCredit}
        </Badge>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
          <CoinIcon size="xs" className="mr-1" /> {selected?.points.toLocaleString() || 0}
        </Badge>
        <ActionDialog
          title={`${t.colabRewards.redeem} +${selected?.creditsAmount || 0} ${t.colabRewards.aiCreditsTitle}?`}
          description={t.colabRewards.redeemConfirmDescription}
          trigger={
            <Button size="sm" disabled={disabled || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : disabled ? t.colabRewards.insufficientPoints : t.colabRewards.redeem}
            </Button>
          }
          actionText={t.colabRewards.confirmRedeem}
          onAction={() => selected && onRedeem(selected)}
          showCancel
        >
          <p>{t.colabRewards.redeemConfirmQuestion}</p>
        </ActionDialog>
      </CardFooter>
    </Card>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────

const getHistoryIcon = (source: HistoryItem['source'], type: HistoryItem['type']) => {
  if (type === 'spend') return <MinusCircle className="h-6 w-6 text-destructive" />;
  switch (source) {
    case 'publicacao': return <FileText className="h-6 w-6 text-primary" />;
    case 'missao': return <Trophy className="h-6 w-6 text-green-500" />;
    case 'trilha': return <BookOpen className="h-6 w-6 text-blue-500" />;
    case 'streak': return <Flame className="h-6 w-6 text-amber-500" />;
    case 'conquest': return <Award className="h-6 w-6 text-purple-500" />;
    case 'extract': return <Zap className="h-6 w-6 text-orange-500" />;
    default: return <PlusCircle className="h-6 w-6 text-green-500" />;
  }
};

const PointHistoryItem = ({ icon, description, date, points, type }: HistoryItem) => (
  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="font-medium">{description}</p>
        <p className="text-sm text-muted-foreground">{date && typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function' ? date.toDate().toLocaleDateString() : date ? new Date(date as string).toLocaleDateString() : 'N/A'}</p>
      </div>
    </div>
    <Badge variant="secondary" className={`${type === 'gain' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} whitespace-nowrap shrink-0`}>
      <CoinIcon size="xs" className="mr-1" /> {type === 'gain' ? '+' : '-'}{points.toLocaleString()}
    </Badge>
  </div>
);

// ─── Rescue Item with Code Reveal ─────────────────────────────────

function RescueItem({ rescue }: { rescue: Rescue }) {
  const t = useT();
  const { toast } = useToast();
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!rescue.code) return;
    try {
      await navigator.clipboard.writeText(rescue.code);
      setCopied(true);
      toast({ title: t.colabRewards.codeCopied });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="p-3 rounded-lg hover:bg-muted/50">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-medium">{rescue.rewardName}</p>
          <p className="text-sm text-muted-foreground">
            {rescue.date && typeof rescue.date === 'object' && rescue.date !== null && 'toDate' in rescue.date && typeof rescue.date.toDate === 'function'
              ? rescue.date.toDate().toLocaleDateString()
              : rescue.date
                ? new Date(rescue.date as string).toLocaleDateString()
                : 'N/A'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rescue.code && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowCode(!showCode)}
            >
              {showCode ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {t.colabRewards.viewCode}
            </Button>
          )}
          <Badge
            variant={rescue.status === 'Pendente' ? 'destructive' : 'default'}
            className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {rescue.status}
          </Badge>
        </div>
      </div>

      {/* Expandable code section */}
      {showCode && rescue.code && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded border">
          <code className="flex-1 font-mono text-sm font-medium tracking-wider">{rescue.code}</code>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyCode}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card & Skeleton ─────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string; value: string | number; icon: React.ElementType; isLoading: boolean }) => (
  <Card>
    <CardHeader>
      <Icon className="h-6 w-6 text-muted-foreground mb-2" />
      <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold font-headline">{typeof value === 'number' ? value.toLocaleString() : value}</p>}
    </CardContent>
  </Card>
);

const PageSkeleton = () => {
  const t = useT();
  return (
    <>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <StatCard title={t.colabRewards.availablePoints} value="0" icon={CoinIcon} isLoading={true} />
        <StatCard title={t.colabRewards.totalGained} value="0" icon={TrendingUp} isLoading={true} />
        <StatCard title={t.colabRewards.totalSpent} value="0" icon={TrendingDown} isLoading={true} />
        <StatCard title={t.colabRewards.redeemed} value="0" icon={Gift} isLoading={true} />
      </div>
      <Tabs defaultValue="loja">
        <TabsList>
          <TabsTrigger value="loja">{t.colabRewards.shopTab}</TabsTrigger>
          <TabsTrigger value="meus-resgates">{t.colabRewards.myRedemptions}</TabsTrigger>
          <TabsTrigger value="historico-pontos">{t.colabRewards.pointsHistory}</TabsTrigger>
        </TabsList>
        <TabsContent value="loja" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="p-0"><Skeleton className="aspect-video rounded-t-lg" /></CardHeader>
                <CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-3/4" /></CardContent>
                <CardFooter className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-10 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────

export default function InfluencerRecompensasPage() {
  const t = useT();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({ available: 0, gained: 0, spent: 0, redeemed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState<{ uid: string; companyId: string; name: string } | null>(null);

  // Code reveal dialog state
  const [codeReveal, setCodeReveal] = useState<{ open: boolean; code: string; rewardName: string }>({
    open: false,
    code: '',
    rewardName: '',
  });

  const fetchData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        toast({ variant: 'destructive', title: t.common.error, description: t.colabRewards.toastUserNotFound });
        setIsLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      const companyId = userData.companyId;

      if (!companyId) {
        toast({ variant: 'destructive', title: t.common.error, description: t.colabRewards.toastCompanyNotFound });
        setIsLoading(false);
        return;
      }

      setUserInfo({ uid: userId, companyId, name: userData.name || '' });

      // Fetch rewards from companies/{companyId}/rewards — only available ones
      const rewardsSnapshot = await getDocs(collection(db, 'companies', companyId, 'rewards'));
      const rewardsData: Reward[] = rewardsSnapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || '',
            name: data.name || '',
            points: data.points || 0,
            imageUrl: data.imageUrl,
            stock: data.stock ?? 'Ilimitado',
            deliveryMethod: data.deliveryMethod,
            type: data.type,
            isNative: data.isNative,
            status: data.status,
            creditsAmount: data.creditsAmount,
          };
        })
        .filter((r) => r.status !== 'Desativada');

      // Sort: native AI credit rewards first (cheapest first), then others by points
      rewardsData.sort((a, b) => {
        if (a.isNative && !b.isNative) return -1;
        if (!a.isNative && b.isNative) return 1;
        return a.points - b.points;
      });
      setRewards(rewardsData);

      // Fetch rescues from users/{userId}/rescues
      const rescuesQuery = query(
        collection(db, 'users', userId, 'rescues'),
        orderBy('date', 'desc')
      );
      const rescuesSnapshot = await getDocs(rescuesQuery);
      const rescuesData: Rescue[] = rescuesSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          rewardName: data.rewardName || '',
          date: data.date?.toDate(),
          status: data.status || 'Pendente',
          code: data.code,
          deliveryMethod: data.deliveryMethod,
        };
      });
      setRescues(rescuesData);

      // Fetch history from users/{userId}/pointsHistory
      const historyQuery = query(
        collection(db, 'users', userId, 'pointsHistory'),
        orderBy('date', 'desc')
      );
      const historySnapshot = await getDocs(historyQuery);
      const historyData: HistoryItem[] = historySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          icon: getHistoryIcon(data.source, data.type),
          description: data.description || '',
          date: data.date,
          points: data.points || 0,
          type: data.type || 'gain',
          source: data.source,
        };
      });
      setHistory(historyData);

      // Calculate stats
      const available = userData.points || 0;
      const gained = historyData
        .filter((item) => item.type === 'gain')
        .reduce((sum, item) => sum + item.points, 0);
      const spent = historyData
        .filter((item) => item.type === 'spend')
        .reduce((sum, item) => sum + item.points, 0);
      const redeemed = rescuesData.length;

      setStats({ available, gained, spent, redeemed });
    } catch (error) {
      console.error("Erro ao buscar dados de recompensas:", error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.colabRewards.toastLoadError,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (authUser?.uid) fetchData(authUser.uid);
  }, [authUser?.uid, fetchData]);

  const handleRedeem = async (reward: Reward) => {
    if (!userInfo) return;
    if (stats.available < reward.points) {
      toast({ variant: 'destructive', title: t.colabRewards.insufficientPoints });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const result = await redeemReward(
        token,
        userInfo.uid,
        reward.id,
        userInfo.companyId,
        userInfo.name
      );

      if (result.error) {
        toast({ variant: 'destructive', title: t.colabRewards.toastRedeemError, description: result.error });
        return;
      }

      // If a code was returned, show the code reveal dialog
      if (result.code) {
        setCodeReveal({ open: true, code: result.code, rewardName: reward.name });
      } else {
        toast({ title: t.colabRewards.toastRedeemed });
      }

      fetchData(userInfo.uid);
    } catch (error) {
      console.error("Erro ao resgatar recompensa:", error);
      toast({ variant: 'destructive', title: t.colabRewards.toastRedeemError });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !userInfo) {
    return (
      <>
        <Header title={t.colabRewards.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <PageSkeleton />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.colabRewards.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <StatCard title={t.colabRewards.availablePoints} value={stats.available} icon={CoinIcon} isLoading={isLoading} />
          <StatCard title={t.colabRewards.totalGained} value={stats.gained} icon={TrendingUp} isLoading={isLoading} />
          <StatCard title={t.colabRewards.totalSpent} value={stats.spent} icon={TrendingDown} isLoading={isLoading} />
          <StatCard title={t.colabRewards.redeemed} value={stats.redeemed} icon={Gift} isLoading={isLoading} />
        </div>

        <Tabs defaultValue="loja">
          <TabsList>
            <TabsTrigger value="loja">{t.colabRewards.shopTab}</TabsTrigger>
            <TabsTrigger value="meus-resgates">{t.colabRewards.myRedemptions}</TabsTrigger>
            <TabsTrigger value="historico-pontos">{t.colabRewards.pointsHistory}</TabsTrigger>
          </TabsList>

          <TabsContent value="loja" className="mt-4">
            {(() => {
              const aiCreditRewards = rewards.filter(r => r.type === 'ai_credits');
              const otherRewards = rewards.filter(r => r.type !== 'ai_credits');
              const hasAny = aiCreditRewards.length > 0 || otherRewards.length > 0;
              return hasAny ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {aiCreditRewards.length > 0 && (
                    <AiCreditsCard
                      rewards={aiCreditRewards}
                      availablePoints={stats.available}
                      onRedeem={handleRedeem}
                      isSubmitting={isSubmitting}
                    />
                  )}
                  {otherRewards.map(reward => (
                    <RewardCard key={reward.id} reward={reward} onRedeem={() => handleRedeem(reward)} disabled={stats.available < reward.points} isSubmitting={isSubmitting} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">{t.colabRewards.noRewards}</p>
              );
            })()}
          </TabsContent>

          <TabsContent value="meus-resgates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  {t.colabRewards.myRedemptions}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rescues.length > 0 ? (
                  rescues.map(rescue => <RescueItem key={rescue.id} rescue={rescue} />)
                ) : (
                  <p className="text-muted-foreground text-center py-8">{t.colabRewards.noRedemptions}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico-pontos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  {t.colabRewards.pointsHistory}
                </CardTitle>
                <CardDescription>{t.colabRewards.pointsHistoryDescription}</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border -mt-2">
                {history.length > 0 ? (
                  history.map(item => <PointHistoryItem key={item.id} {...item} />)
                ) : (
                  <p className="text-muted-foreground text-center py-8">{t.colabRewards.noTransactions}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Code Reveal Dialog — shown once after successful code redemption */}
      <CodeRevealDialog
        open={codeReveal.open}
        onOpenChange={(open) => setCodeReveal(prev => ({ ...prev, open }))}
        code={codeReveal.code}
        rewardName={codeReveal.rewardName}
      />
    </>
  );
}
