// src/app/master/empresas/[id]/billing/page.tsx
// Painel do Master para configurar cobranca e beta de uma empresa.
//
// Princı́pios:
// - Este componente NAO decide nada. Apenas:
//   1. le estado serializado via server action `getCompanyBilling`
//   2. mostra os controles em 4 cards independentes
//   3. envia TODAS as mudancas via server action unica `saveMasterBilling`
// - Toda validacao acontece no servidor (master-rules.ts).
//
// Layout dos cards (apos refactor):
//   - Status dos Modulos (read-only)
//   - Parceiro Boldfy (toggle isolado)
//   - Teste Gratuito (duracao do trial Platform)
//   - Beta Tester (duracao em meses; data de inicio e setada AUTOMATICAMENTE
//     pelo webhook do Stripe quando a 1a fatura do Platform e paga)
//   - Plano Thought Leader (Omie)
//
// Quando "Parceiro Boldfy" esta ligado, os cards Teste/Beta ficam
// visualmente desabilitados — partner companies nao tem trial nem beta.

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
import { Loader2, ArrowLeft, CheckCircle2, Users, Mic, Palette, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getCompanyBilling,
  saveMasterBilling,
  type SerializableBillingBlock,
  type PlatformUsageInfo,
  type TLUsageInfo,
  type DesignUsageInfo,
  type BillingChargeType,
} from '@/app/actions/billing';
import { formatBRL } from '@/lib/billing/pricing';

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

  // Estado visual do beta com 3 fases:
  //   - waiting:   isBetaTester=true mas betaStartsAt ausente (ainda nao pagou 1a fatura)
  //   - active:    betaStartsAt presente, betaEndsAt no futuro
  //   - concluded: betaEndsAt no passado
  const betaState = useMemo(() => {
    if (!billing || !isBetaTester) return null;
    const start = billing.betaStartsAtISO;
    const end = billing.betaEndsAtISO;
    if (!start) return { phase: 'waiting' as const };
    if (end && isPast(end)) {
      return {
        phase: 'concluded' as const,
        start: formatDateShortBR(start),
        end: formatDateShortBR(end),
      };
    }
    return {
      phase: 'active' as const,
      start: formatDateShortBR(start),
      end: end ? formatDateShortBR(end) : '—',
    };
  }, [billing, isBetaTester]);

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

    startSavingTransition(async () => {
      const res = await saveMasterBilling({
        idToken: token,
        companyId,
        trialDurationDays,
        freeTrialUnlimited,
        isBetaTester,
        betaDurationMonths: isBetaTester ? betaDurationMonths : null,
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
                <PlatformStatusCard
                  status={billing.platform.status}
                  usage={billing.platform.usage}
                />
                <TLStatusCard
                  status={billing.tl.status}
                  usage={billing.tl.usage}
                />
                <DesignStatusCard
                  status={billing.design.status}
                  usage={billing.design.usage}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Card 2: Parceiro Boldfy (isolado, controla habilitacao dos proximos) */}
        <Card>
          <CardHeader>
            <CardTitle>Parceiro Boldfy</CardTitle>
            <CardDescription>
              Empresas parceiras nao tem cobranca. Quando ligado, Teste Gratuito e
              Beta Tester ficam inativos — a empresa permanece em status &quot;free&quot;
              permanente, sem prazo de bloqueio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
              <div>
                <Label htmlFor="freeTrialUnlimited" className="text-sm font-medium">
                  Sem cobranca
                </Label>
                <p className="text-xs text-muted-foreground">
                  Liga o modo parceiro: empresa nunca e cobrada nem bloqueada.
                </p>
              </div>
              <Switch
                id="freeTrialUnlimited"
                checked={freeTrialUnlimited}
                onCheckedChange={setFreeTrialUnlimited}
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Teste Gratuito */}
        <Card className={freeTrialUnlimited ? 'opacity-60' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Teste Gratuito</span>
              {trialConcluded ? (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Concluido — {trialConcluded.start} — {trialConcluded.end}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Define a duracao do teste gratuito do modulo Platform. Comeca quando o
              admin loga pela primeira vez. Apos o fim, a empresa tem 7 dias para
              cadastrar cartao antes do bloqueio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {freeTrialUnlimited ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                Inativo porque <strong>Parceiro Boldfy</strong> esta ligado.
              </div>
            ) : null}

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
          </CardContent>
        </Card>

        {/* Card 4: Beta Tester */}
        <Card className={freeTrialUnlimited ? 'opacity-60' : ''}>
          <CardHeader>
            <CardTitle>Beta Tester</CardTitle>
            <CardDescription>
              Aplica 30% de desconto no modulo Platform durante o periodo definido.
              O beta comeca <strong>automaticamente</strong> quando a empresa paga a
              primeira fatura — nao e necessario informar data de inicio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {freeTrialUnlimited ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                Inativo porque <strong>Parceiro Boldfy</strong> esta ligado.
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <Label htmlFor="isBetaTester" className="text-sm font-medium">
                  Empresa em beta
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desconto aplicado apenas no Platform. TL e Design nao tem desconto.
                </p>
              </div>
              <Switch
                id="isBetaTester"
                checked={isBetaTester}
                onCheckedChange={setIsBetaTester}
                disabled={isSaving || freeTrialUnlimited}
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
                    disabled={isSaving || freeTrialUnlimited}
                  />
                  <p className="text-xs text-muted-foreground">
                    Inicio e setado automaticamente quando a empresa paga a 1a fatura
                    do Platform.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Estado atual do beta</Label>
                  <div className="rounded-md border p-3 text-xs space-y-1">
                    {betaState?.phase === 'waiting' && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="secondary">Aguardando 1a fatura paga</Badge>
                      </div>
                    )}
                    {betaState?.phase === 'active' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant="default">Ativo</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Iniciou:</span>
                          <span>{formatDateBR(billing?.betaStartsAtISO ?? null)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Termina:</span>
                          <span>{formatDateBR(billing?.betaEndsAtISO ?? null)}</span>
                        </div>
                      </>
                    )}
                    {betaState?.phase === 'concluded' && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Concluido — {betaState.start} — {betaState.end}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Plano Thought Leader (Omie) */}
        <Card>
          <CardHeader>
            <CardTitle>Plano Thought Leader</CardTitle>
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

// ────────────────────────────────────────────────────────────
// Status cards por modulo
// ────────────────────────────────────────────────────────────

/**
 * Tag visual de tipo de cobranca. Substitui a logica antiga que so
 * mostrava status. Agora a UI deixa explicito o regime financeiro
 * (free/trial/beta/paid/external/pending).
 */
function chargeTag(type: BillingChargeType): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (type) {
    case 'free':
      return { label: 'Sem cobranca', variant: 'secondary' };
    case 'trial':
      return { label: 'Em teste gratuito', variant: 'secondary' };
    case 'beta':
      return { label: 'Beta -30%', variant: 'default' };
    case 'paid':
      return { label: 'Pagando', variant: 'default' };
    case 'external':
      return { label: 'Externo (Omie)', variant: 'outline' };
    case 'pending':
      return { label: 'Aguardando pagamento', variant: 'secondary' };
    case 'inactive':
    default:
      return { label: 'Sem cobranca', variant: 'outline' };
  }
}

/** Header padrao reutilizavel pelos 3 cards. */
function StatusCardHeader({
  icon: Icon,
  title,
  status,
  chargeType,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: string;
  chargeType: BillingChargeType;
}) {
  const tag = chargeTag(chargeType);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={statusBadgeVariant(status)} className="text-[11px]">
          {statusLabel(status)}
        </Badge>
        <Badge variant={tag.variant} className="text-[11px]">
          {tag.label}
        </Badge>
      </div>
    </div>
  );
}

/** Linha de breakdown monetario (icone + texto). */
function PriceBreakdown({
  text,
  total,
}: {
  text: string;
  total: string | null;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="space-y-0.5">
        <p className="text-muted-foreground">{text}</p>
        {total ? <p className="font-medium text-foreground">{total}</p> : null}
      </div>
    </div>
  );
}

function PlatformStatusCard({
  status,
  usage,
}: {
  status: string;
  usage: PlatformUsageInfo;
}) {
  const { collaboratorsCount, billedSeats, atMinimum, perSeatCents, totalCents, chargeType } = usage;

  // Texto de breakdown depende do tipo de cobranca
  let breakdown: { text: string; total: string | null };
  if (chargeType === 'free' || chargeType === 'trial' || chargeType === 'inactive') {
    breakdown = {
      text:
        chargeType === 'free'
          ? 'Parceiro Boldfy — sem cobranca.'
          : chargeType === 'trial'
            ? 'Em teste gratuito — sem cobranca ate o fim do trial.'
            : 'Modulo nao ativado — sem cobranca.',
      total: null,
    };
  } else if (perSeatCents != null && totalCents != null) {
    const perSeat = formatBRL(perSeatCents);
    const total = formatBRL(totalCents);
    const minNote = atMinimum ? ' (minimo 5)' : '';
    breakdown = {
      text: `${billedSeats} seats${minNote} × ${perSeat}/seat`,
      total: `${total}/mes`,
    };
  } else {
    breakdown = {
      text: 'Acima de 70 seats — enterprise. Calculo manual.',
      total: null,
    };
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <StatusCardHeader
        icon={Users}
        title="Platform"
        status={status}
        chargeType={chargeType}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>
          {collaboratorsCount} {collaboratorsCount === 1 ? 'colaborador' : 'colaboradores'}
        </span>
      </div>
      <PriceBreakdown text={breakdown.text} total={breakdown.total} />
    </div>
  );
}

function TLStatusCard({
  status,
  usage,
}: {
  status: string;
  usage: TLUsageInfo;
}) {
  const { thoughtLeadersCount, totalCents, chargeType } = usage;

  let breakdown: { text: string; total: string | null };
  if (chargeType === 'external') {
    breakdown = {
      text: 'Cobrado fora da plataforma (contrato direto).',
      total: null,
    };
  } else if (chargeType === 'paid' && totalCents != null) {
    breakdown = {
      text: 'Cobrado via Stripe',
      total: `${formatBRL(totalCents)}/mes`,
    };
  } else if (chargeType === 'pending') {
    breakdown = {
      text: 'Modulo aguardando 1o pagamento.',
      total: null,
    };
  } else {
    breakdown = {
      text: 'Modulo nao ativado — sem cobranca.',
      total: null,
    };
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <StatusCardHeader
        icon={Mic}
        title="Thought Leaders"
        status={status}
        chargeType={chargeType}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mic className="h-3.5 w-3.5" />
        <span>
          {thoughtLeadersCount} {thoughtLeadersCount === 1 ? 'thought leader' : 'thought leaders'}
        </span>
      </div>
      <PriceBreakdown text={breakdown.text} total={breakdown.total} />
    </div>
  );
}

function DesignStatusCard({
  status,
  usage,
}: {
  status: string;
  usage: DesignUsageInfo;
}) {
  const { packLabel, totalCents, chargeType } = usage;

  let breakdown: { text: string; total: string | null };
  if (chargeType === 'paid' && totalCents != null) {
    breakdown = {
      text: 'Cobrado via Stripe',
      total: `${formatBRL(totalCents)}/mes`,
    };
  } else if (chargeType === 'pending') {
    breakdown = {
      text: 'Modulo aguardando 1o pagamento.',
      total: null,
    };
  } else {
    breakdown = {
      text: 'Modulo nao ativado — sem cobranca.',
      total: null,
    };
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <StatusCardHeader
        icon={Palette}
        title="Design"
        status={status}
        chargeType={chargeType}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Palette className="h-3.5 w-3.5" />
        <span>{packLabel ? `Pack ${packLabel}` : 'Sem pack'}</span>
      </div>
      <PriceBreakdown text={breakdown.text} total={breakdown.total} />
    </div>
  );
}
