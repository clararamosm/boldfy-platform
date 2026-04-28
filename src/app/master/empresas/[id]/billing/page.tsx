// src/app/master/empresas/[id]/billing/page.tsx
// Painel do Master para configurar cobranca e beta de uma empresa.
//
// Princı́pios:
// - Este componente NAO decide nada. Apenas:
//   1. le estado serializado via server action `getCompanyBilling`
//   2. mostra os controles em 3 cards
//   3. envia TODAS as mudancas via server action unica `saveMasterBilling`
// - Toda validacao acontece no servidor (master-rules.ts).
//
// NOTA: Antigo flag billing.enabled foi REMOVIDO. Toda empresa entra
// no fluxo de cobranca; a unica forma de nao pagar e o toggle nativo
// "Parceiro Boldfy" (freeTrialUnlimited).

'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
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
import { Loader2, ArrowLeft, Sparkles, ExternalLink, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getCompanyBilling,
  saveMasterBilling,
  type SerializableBillingBlock,
} from '@/app/actions/billing';

function formatDateForInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'free') return 'secondary';
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

function formatDateShortBR(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Retorna true se a data ISO ja passou (em relacao a now). */
function isPast(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

export default function MasterCompanyBillingPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const companyId = params?.id;

  const [companyName, setCompanyName] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [billing, setBilling] = useState<SerializableBillingBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();

  // Form state — Plano Platform
  const [trialDurationDays, setTrialDurationDays] = useState<15 | 30 | 60>(15);
  const [freeTrialUnlimited, setFreeTrialUnlimited] = useState(false);

  // Form state — Beta Tester
  const [isBetaTester, setIsBetaTester] = useState(false);
  const [betaDurationMonths, setBetaDurationMonths] = useState<number>(3);
  const [betaStartsAt, setBetaStartsAt] = useState<string>('');

  // Form state — Plano Thought Leader (Omie)
  const [tlOutsideEnabled, setTlOutsideEnabled] = useState(false);
  const [tlOutsideExecutives, setTlOutsideExecutives] = useState<number>(1);
  const [tlOutsideFrequency, setTlOutsideFrequency] = useState<2 | 3 | 4>(2);

  // Form state — Notas
  const [notes, setNotes] = useState('');

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
        setNotes(res.data.notes ?? '');

        // Hidrata Plano Platform
        const trialDur = res.data.platform.trialDurationDays;
        setTrialDurationDays(
          trialDur === 15 || trialDur === 30 || trialDur === 60 ? trialDur : 15,
        );
        setFreeTrialUnlimited(res.data.platform.freeTrialUnlimited === true);

        // Hidrata Beta Tester
        setIsBetaTester(res.data.isBetaTester === true);
        setBetaDurationMonths(
          typeof res.data.betaDurationMonths === 'number' && res.data.betaDurationMonths > 0
            ? res.data.betaDurationMonths
            : 3,
        );
        setBetaStartsAt(formatDateForInput(res.data.betaStartsAtISO));

        // Hidrata Plano TL
        setTlOutsideEnabled(res.data.tl.billedOutsidePlatform === true);
        const execs = res.data.tl.executives;
        setTlOutsideExecutives(execs >= 1 && execs <= 5 ? execs : 1);
        const freq = res.data.tl.frequency;
        setTlOutsideFrequency(freq === 2 || freq === 3 || freq === 4 ? freq : 2);
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

  // Tags historicas "Concluido"
  const trialConcluded = useMemo(() => {
    if (!billing) return null;
    if (freeTrialUnlimited) return null;
    const start = billing.platform.trialStartedAtISO;
    const end = billing.platform.trialEndsAtISO;
    if (!end || !isPast(end)) return null;
    return {
      start: formatDateShortBR(start),
      end: formatDateShortBR(end),
    };
  }, [billing, freeTrialUnlimited]);

  const betaConcluded = useMemo(() => {
    if (!billing) return null;
    const start = billing.betaStartsAtISO;
    const end = billing.betaEndsAtISO;
    if (!end || !isPast(end)) return null;
    return {
      start: formatDateShortBR(start),
      end: formatDateShortBR(end),
    };
  }, [billing]);

  function handleSaveAll() {
    if (!companyId || !token) return;

    // Validacoes leves de UI antes de mandar pro servidor
    if (isBetaTester) {
      if (
        !Number.isInteger(betaDurationMonths) ||
        betaDurationMonths < 1 ||
        betaDurationMonths > 24
      ) {
        toast({
          title: 'Duracao do beta invalida',
          description: 'Informe um numero inteiro entre 1 e 24 meses.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (tlOutsideEnabled) {
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

    let betaStartsAtISO: string | null = null;
    if (isBetaTester && betaStartsAt) {
      const d = new Date(betaStartsAt + 'T00:00:00');
      if (Number.isNaN(d.getTime())) {
        toast({
          title: 'Data invalida',
          description: 'Verifique a data de inicio do beta.',
          variant: 'destructive',
        });
        return;
      }
      betaStartsAtISO = d.toISOString();
    }

    startSavingTransition(async () => {
      const res = await saveMasterBilling({
        idToken: token,
        companyId,
        trialDurationDays,
        freeTrialUnlimited,
        isBetaTester,
        betaDurationMonths: isBetaTester ? betaDurationMonths : null,
        betaStartsAt: betaStartsAtISO,
        tlBilledOutsidePlatform: tlOutsideEnabled,
        tlExecutives: tlOutsideEnabled
          ? (tlOutsideExecutives as 1 | 2 | 3 | 4 | 5)
          : undefined,
        tlFrequency: tlOutsideEnabled ? tlOutsideFrequency : undefined,
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
        title: 'Configuracoes salvas',
        description: 'Todas as alteracoes de billing foram aplicadas.',
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
            Configure o plano, parceiros e ativacao especial. Toda mudanca e aplicada
            ao clicar em &quot;Salvar alteracoes&quot; no fim da pagina.
          </p>
        </div>

        {/* Card 1: Status dos Modulos (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Modulos</CardTitle>
            <CardDescription>
              Estado atual de cada modulo de cobranca.
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

        {/* Card 2: Plano Platform — engloba Teste Gratuito + Beta Tester */}
        <Card>
          <CardHeader>
            <CardTitle>Plano Platform</CardTitle>
            <CardDescription>
              Define o teste gratuito do modulo Platform, parceria especial (sem cobranca)
              e periodo de beta tester.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sub-secao: Teste Gratuito */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Teste Gratuito</h3>
                {trialConcluded ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Concluido — {trialConcluded.start} — {trialConcluded.end}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trialDurationDays">Duracao do teste</Label>
                  <Select
                    value={String(trialDurationDays)}
                    onValueChange={(v) =>
                      setTrialDurationDays(Number(v) as 15 | 30 | 60)
                    }
                    disabled={isSaving || freeTrialUnlimited}
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
                    Comeca quando o admin loga pela primeira vez. Apos o fim, a empresa
                    tem 7 dias para cadastrar cartao antes do bloqueio.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Estado atual do teste</Label>
                  <div className="rounded-md border p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={statusBadgeVariant(billing?.platform.status ?? 'disabled')}>
                        {statusLabel(billing?.platform.status ?? 'disabled')}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Iniciou:</span>
                      <span>{formatDateBR(billing?.platform.trialStartedAtISO ?? null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Termina:</span>
                      <span>{formatDateBR(billing?.platform.trialEndsAtISO ?? null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prazo do cartao:</span>
                      <span>{formatDateBR(billing?.platform.cardDeadlineEndsAtISO ?? null)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div>
                  <Label htmlFor="freeTrialUnlimited" className="text-sm font-medium">
                    Parceiro Boldfy (sem cobranca)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Empresa fica em status &quot;free&quot; permanente, sem prazo de bloqueio.
                  </p>
                </div>
                <Switch
                  id="freeTrialUnlimited"
                  checked={freeTrialUnlimited}
                  onCheckedChange={setFreeTrialUnlimited}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Sub-secao: Beta Tester */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Beta Tester
                </h3>
                {betaConcluded ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Concluido — {betaConcluded.start} — {betaConcluded.end}
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                <div>
                  <Label htmlFor="isBetaTester" className="text-sm font-medium">
                    Empresa em beta
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aplica 30% de desconto apenas no modulo Platform durante o periodo
                    definido. TL e Design nao tem desconto beta.
                  </p>
                </div>
                <Switch
                  id="isBetaTester"
                  checked={isBetaTester}
                  onCheckedChange={setIsBetaTester}
                  disabled={isSaving}
                />
              </div>

              {isBetaTester && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="betaDurationMonths">Duracao (meses)</Label>
                    <Input
                      id="betaDurationMonths"
                      type="number"
                      min={1}
                      max={24}
                      step={1}
                      value={betaDurationMonths}
                      onChange={(e) =>
                        setBetaDurationMonths(Number(e.target.value))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="betaStartsAt">Data de inicio</Label>
                    <Input
                      id="betaStartsAt"
                      type="date"
                      value={betaStartsAt}
                      onChange={(e) => setBetaStartsAt(e.target.value)}
                      disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Termina automaticamente em inicio + meses.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Plano Thought Leader (Omie) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" /> Plano Thought Leader
            </CardTitle>
            <CardDescription>
              Use quando a empresa paga o modulo TL por fora da Boldfy (contrato direto,
              sem Stripe). O modulo fica ativo, os TLs tem acesso, e nada e cobrado pela
              plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="tlOutsideEnabled" className="text-base">
                  TL cobrado fora da plataforma (Omie)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Marca o modulo TL como ativo sem cobranca via Stripe.
                </p>
              </div>
              <Switch
                id="tlOutsideEnabled"
                checked={tlOutsideEnabled}
                onCheckedChange={setTlOutsideEnabled}
                disabled={isSaving}
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
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tlOutsideFrequency">Frequencia semanal</Label>
                  <Select
                    value={String(tlOutsideFrequency)}
                    onValueChange={(v) =>
                      setTlOutsideFrequency(Number(v) as 2 | 3 | 4)
                    }
                    disabled={isSaving}
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
          </CardContent>
        </Card>

        {/* Notas internas + botao unico Salvar */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas (apenas Master)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente Omie, TL cobrado externamente."
                maxLength={1000}
                disabled={isSaving}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveAll} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
