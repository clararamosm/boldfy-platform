// src/app/master/empresas/[id]/billing/page.tsx
// Painel do Master para ligar/desligar cobranca e beta de uma empresa.
//
// Princı́pios:
// - Este componente NAO decide nada. Apenas:
//   1. le estado serializado via server action `getCompanyBilling`
//   2. mostra switches
//   3. envia mudancas via server action `updateCompanyBillingToggles`
// - Toda validacao acontece no servidor (master-rules.ts).

'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getCompanyBilling,
  updateCompanyBillingToggles,
  setTLBilledOutsidePlatform,
  setMasterTrialDuration,
  toggleFreeTrialUnlimited,
  type SerializableBillingBlock,
} from '@/app/actions/billing';

function formatDateForInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // yyyy-MM-dd (input[type=date])
  return d.toISOString().slice(0, 10);
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'pending') return 'secondary';
  if (status === 'blocked') return 'destructive';
  return 'outline';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'free':
      return 'Teste gratuito';
    case 'pending':
      return 'Aguardando pagamento';
    case 'blocked':
      return 'Bloqueado';
    case 'disabled':
    default:
      return 'Desativado';
  }
}

function statusBadgeVariantPlatform(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'free') return 'secondary';
  if (status === 'pending') return 'secondary';
  if (status === 'blocked') return 'destructive';
  return 'outline';
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function MasterCompanyBillingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const companyId = params?.id;

  const [companyName, setCompanyName] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [billing, setBilling] = useState<SerializableBillingBlock | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [isBetaTester, setIsBetaTester] = useState(false);
  const [betaExpiresAt, setBetaExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [tlOutsideEnabled, setTlOutsideEnabled] = useState(false);
  const [tlOutsideExecutives, setTlOutsideExecutives] = useState<number>(1);
  const [tlOutsideFrequency, setTlOutsideFrequency] = useState<2 | 3 | 4>(2);
  const [isPendingTLOutside, startTLOutsideTransition] = useTransition();

  // Trial Platform (master)
  const [trialDurationDays, setTrialDurationDays] = useState<15 | 30 | 60>(15);
  const [freeTrialUnlimited, setFreeTrialUnlimited] = useState(false);
  const [isPendingTrialDuration, startTrialDurationTransition] = useTransition();
  const [isPendingFreeUnlimited, startFreeUnlimitedTransition] = useTransition();

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    (async () => {
      try {
        const idToken = await getAuthToken();
        if (cancelled) return;
        setToken(idToken);

        // Nome da empresa (UI) — leitura direta do doc
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (!cancelled && snap.exists()) {
          setCompanyName((snap.data()?.companyName as string) || '');
        }

        // Estado de billing via server action (valida role master)
        const res = await getCompanyBilling(idToken, companyId);
        if (cancelled) return;
        if (!res.success || !res.data) {
          toast({
            title: 'Erro ao carregar',
            description: res.error || 'Nao foi possivel ler o billing.',
            variant: 'destructive',
          });
          return;
        }
        setBilling(res.data);
        setEnabled(res.data.enabled);
        setIsBetaTester(res.data.isBetaTester);
        setBetaExpiresAt(formatDateForInput(res.data.betaExpiresAtISO));
        setNotes(res.data.notes ?? '');
        setTlOutsideEnabled(res.data.tl.billedOutsidePlatform === true);
        const execs = res.data.tl.executives;
        setTlOutsideExecutives(execs >= 1 && execs <= 5 ? execs : 1);
        const freq = res.data.tl.frequency;
        setTlOutsideFrequency(freq === 2 || freq === 3 || freq === 4 ? freq : 2);

        // Hidrata trial Platform
        const trialDur = res.data.platform.trialDurationDays;
        if (trialDur === 15 || trialDur === 30 || trialDur === 60) {
          setTrialDurationDays(trialDur);
        } else {
          setTrialDurationDays(15);
        }
        setFreeTrialUnlimited(res.data.platform.freeTrialUnlimited === true);
      } catch (e) {
        if (!cancelled) {
          toast({
            title: 'Erro',
            description:
              e instanceof Error ? e.message : 'Erro desconhecido ao carregar.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, toast]);

  // Regra de UI (espelho de validateMasterToggleInput; servidor e fonte de verdade):
  // se nao e beta, desabilita campo de expiracao.
  useEffect(() => {
    if (!isBetaTester && betaExpiresAt) {
      setBetaExpiresAt('');
    }
  }, [isBetaTester, betaExpiresAt]);

  function handleSaveTrialDuration(value: 15 | 30 | 60) {
    if (!companyId || !token) return;
    setTrialDurationDays(value);
    startTrialDurationTransition(async () => {
      const res = await setMasterTrialDuration({
        idToken: token,
        companyId,
        trialDurationDays: value,
      });
      if (!res.success || !res.data) {
        toast({
          title: 'Erro ao salvar duracao do teste',
          description: res.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      setBilling(res.data);
      toast({
        title: 'Duracao do teste atualizada',
        description: `Teste Platform agora dura ${value} dias.`,
      });
    });
  }

  function handleToggleFreeUnlimited(enabled: boolean) {
    if (!companyId || !token) return;
    setFreeTrialUnlimited(enabled);
    startFreeUnlimitedTransition(async () => {
      const res = await toggleFreeTrialUnlimited({
        idToken: token,
        companyId,
        enabled,
      });
      if (!res.success || !res.data) {
        // rollback visual
        setFreeTrialUnlimited(!enabled);
        toast({
          title: 'Erro ao alterar teste gratuito ilimitado',
          description: res.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      setBilling(res.data);
      toast({
        title: enabled ? 'Teste gratuito ilimitado ativado' : 'Teste gratuito ilimitado desativado',
        description: enabled
          ? 'Empresa marcada como parceira Boldfy. Sem cobranca.'
          : 'Empresa volta para o fluxo normal de teste gratuito.',
      });
    });
  }

  function handleSaveTLOutside() {
    if (!companyId || !token) return;

    if (tlOutsideEnabled) {
      if (!enabled) {
        toast({
          title: 'Cobranca desligada',
          description:
            'Ative "Cobranca Ativa" antes de configurar a ativacao especial do TL.',
          variant: 'destructive',
        });
        return;
      }
      if (
        !Number.isInteger(tlOutsideExecutives) ||
        tlOutsideExecutives < 1 ||
        tlOutsideExecutives > 5
      ) {
        toast({
          title: 'Numero de executivos invalido',
          description: 'Informe um numero inteiro entre 1 e 5.',
          variant: 'destructive',
        });
        return;
      }
    }

    startTLOutsideTransition(async () => {
      const res = await setTLBilledOutsidePlatform({
        idToken: token,
        companyId,
        enabled: tlOutsideEnabled,
        executives: tlOutsideEnabled
          ? (tlOutsideExecutives as 1 | 2 | 3 | 4 | 5)
          : undefined,
        frequency: tlOutsideEnabled ? tlOutsideFrequency : undefined,
      });
      if (!res.success || !res.data) {
        toast({
          title: 'Erro ao salvar',
          description: res.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      setBilling(res.data);
      toast({
        title: 'Ativacao especial atualizada',
        description: tlOutsideEnabled
          ? 'TL marcado como cobrado fora da plataforma.'
          : 'TL voltou para desativado.',
      });
    });
  }

  function handleSave() {
    if (!companyId || !token) return;

    let betaExpiresAtISO: string | null = null;
    if (isBetaTester && betaExpiresAt) {
      const d = new Date(betaExpiresAt + 'T23:59:59');
      if (Number.isNaN(d.getTime())) {
        toast({
          title: 'Data invalida',
          description: 'Verifique a data de expiracao do beta.',
          variant: 'destructive',
        });
        return;
      }
      betaExpiresAtISO = d.toISOString();
    }

    startTransition(async () => {
      const res = await updateCompanyBillingToggles({
        idToken: token,
        companyId,
        enabled,
        isBetaTester,
        betaExpiresAt: betaExpiresAtISO,
        notes: notes || undefined,
      });
      if (!res.success || !res.data) {
        toast({
          title: 'Erro ao salvar',
          description: res.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      setBilling(res.data);
      toast({
        title: 'Billing atualizado',
        description: 'Flags de cobranca e beta foram salvas.',
      });
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/master/empresas"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar para empresas
            </Link>
            <h1 className="mt-2 text-2xl font-bold">
              Billing — {companyName || companyId}
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle Master de cobranca e beta. Apenas flags — Stripe na Fase 2.
            </p>
          </div>
        </div>

        {/* Status atual dos modulos (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Modulos</CardTitle>
            <CardDescription>
              Estado atual de cada modulo de cobranca. Modulos serao ativados via
              integracao Stripe na Fase 2.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {billing ? (
              <>
                <ModuleStatusCard
                  title="Platform (colaboradores)"
                  status={billing.platform.status}
                  extra={`${billing.platform.seats} seats`}
                />
                <ModuleStatusCard
                  title="Thought Leaders"
                  status={billing.tl.status}
                  extra={
                    billing.tl.billedOutsidePlatform
                      ? 'Cobrado fora da plataforma'
                      : `${billing.tl.seats} TLs`
                  }
                />
                <ModuleStatusCard
                  title="Design"
                  status={billing.design.status}
                  extra={billing.design.pack ? `Pack ${billing.design.pack}` : '—'}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Plano Platform — Trial (master) */}
        <Card>
          <CardHeader>
            <CardTitle>Plano Platform</CardTitle>
            <CardDescription>
              Define a duracao do teste gratuito do modulo Platform. O teste comeca
              quando o admin loga pela primeira vez. Apos o fim, a empresa tem 7 dias
              para cadastrar cartao antes do bloqueio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="trialDurationDays">Duracao do teste</Label>
                <Select
                  value={String(trialDurationDays)}
                  onValueChange={(v) =>
                    handleSaveTrialDuration(Number(v) as 15 | 30 | 60)
                  }
                  disabled={isPendingTrialDuration || freeTrialUnlimited}
                >
                  <SelectTrigger id="trialDurationDays">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Padrao: 15 dias. Se o teste ja comecou, mudar a duracao recalcula
                  trialEndsAt e cardDeadlineEndsAt a partir de trialStartedAt.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Estado atual do teste</Label>
                <div className="rounded-md border p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={statusBadgeVariantPlatform(billing?.platform.status ?? 'disabled')}>
                      {statusLabel(billing?.platform.status ?? 'disabled')}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teste iniciou:</span>
                    <span>{formatDateBR(billing?.platform.trialStartedAtISO ?? null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teste termina:</span>
                    <span>{formatDateBR(billing?.platform.trialEndsAtISO ?? null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prazo do cartao:</span>
                    <span>{formatDateBR(billing?.platform.cardDeadlineEndsAtISO ?? null)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="freeTrialUnlimited" className="text-base">
                  Teste gratuito ilimitado (parceiro Boldfy)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use para empresas parceiras que nao serao cobradas. Mantem o modulo
                  Platform em status &quot;free&quot; sem prazo de bloqueio. Desligar volta
                  para o fluxo normal de teste gratuito.
                </p>
              </div>
              <Switch
                id="freeTrialUnlimited"
                checked={freeTrialUnlimited}
                onCheckedChange={handleToggleFreeUnlimited}
                disabled={isPendingFreeUnlimited}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ativacao Especial — TL cobrado fora da plataforma */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" /> Ativacao Especial — TL cobrado fora da plataforma
            </CardTitle>
            <CardDescription>
              Use quando a empresa paga o modulo TL por fora da Boldfy (contrato direto, sem
              Stripe). O modulo fica ativo, os TLs tem acesso, e nada e cobrado pela plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="tlOutsideEnabled" className="text-base">
                  TL cobrado fora da plataforma
                </Label>
                <p className="text-sm text-muted-foreground">
                  Requer "Cobranca Ativa" ligada. Marca o modulo TL como ativo sem cobranca via
                  Stripe.
                </p>
              </div>
              <Switch
                id="tlOutsideEnabled"
                checked={tlOutsideEnabled}
                onCheckedChange={setTlOutsideEnabled}
                disabled={isPendingTLOutside}
              />
            </div>

            {tlOutsideEnabled && (
              <div className="grid gap-4 md:grid-cols-2 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label htmlFor="tlOutsideExecutives">Numero de executivos (1 a 5)</Label>
                  <Input
                    id="tlOutsideExecutives"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={tlOutsideExecutives}
                    onChange={(e) => setTlOutsideExecutives(Number(e.target.value))}
                    disabled={isPendingTLOutside}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tlOutsideFrequency">Frequencia semanal</Label>
                  <Select
                    value={String(tlOutsideFrequency)}
                    onValueChange={(v) =>
                      setTlOutsideFrequency(Number(v) as 2 | 3 | 4)
                    }
                    disabled={isPendingTLOutside}
                  >
                    <SelectTrigger id="tlOutsideFrequency">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2x por semana</SelectItem>
                      <SelectItem value="3">3x por semana</SelectItem>
                      <SelectItem value="4">4x por semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={handleSaveTLOutside}
                disabled={isPendingTLOutside}
              >
                {isPendingTLOutside && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar ativacao especial
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Toggles do Master */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Toggles do Master
            </CardTitle>
            <CardDescription>
              Ligar cobranca inicia o periodo de 7 dias para o primeiro pagamento
              de cada modulo ativado pelo admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="enabled" className="text-base">
                  Cobranca Ativa
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ligado, a empresa passa a ser cobrada por modulos que o
                  admin ativar. Desligado = empresa em periodo gratuito (sem
                  prazo).
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isBetaTester" className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Beta Tester
                </Label>
                <p className="text-sm text-muted-foreground">
                  Aplica 30% de desconto apenas no modulo Platform. TL e Design
                  nao tem desconto beta.
                </p>
              </div>
              <Switch
                id="isBetaTester"
                checked={isBetaTester}
                onCheckedChange={setIsBetaTester}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="betaExpiresAt">
                Data de expiracao do beta (opcional)
              </Label>
              <Input
                id="betaExpiresAt"
                type="date"
                value={betaExpiresAt}
                onChange={(e) => setBetaExpiresAt(e.target.value)}
                disabled={!isBetaTester || isPending}
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, beta nao expira automaticamente. Ao expirar, desconto e
                removido e subscription e recalculada (Fase 4).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas (apenas Master)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente Omie, TL cobrado externamente."
                maxLength={1000}
                disabled={isPending}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alteracoes
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Todas as mudancas sao logadas no Firestore com o UID do master que executou.
        </p>
      </div>
    </div>
  );
}

function ModuleStatusCard({
  title,
  status,
  extra,
}: {
  title: string;
  status: string;
  extra: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <Badge variant={statusBadgeVariant(status)}>{statusLabel(status)}</Badge>
      <p className="text-xs text-muted-foreground">{extra}</p>
    </div>
  );
}
