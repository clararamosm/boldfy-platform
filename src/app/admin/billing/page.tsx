// src/app/admin/billing/page.tsx
// Tela "Planos e Cobranca" do Admin (redesign — refactor billing-trial-flow).
//
// Objetivos do redesign:
// - Card Platform sempre visivel (sem toggle), mostra estado real (free/pending/active/blocked)
//   e o preco do tier atual (cheio + beta quando aplicavel).
// - Cards TL e Design colapsados por default, expandem com inputs minimos quando o admin
//   liga o toggle. Botao "Ativar" leva para Stripe Checkout.
// - Banners condicionais no topo, calculados a partir do billing block:
//     - Roxo: free trial ilimitado (parceiro Boldfy)
//     - Verde / Amarelo / Vermelho: countdown do trial Platform e do prazo de cartao
//     - Azul: empresa em beta tester (desconto ativo)
// - REMOVIDO: sliders, simulador interativo, card "Total mensal simulado".
//   simulatePricing() ainda e chamada UMA vez no load para preencher o preco do tier
//   atual (sem reatividade a inputs). Sem regra de negocio no client.

'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { auth as firebaseAuth } from '@/lib/firebase';
import { Header } from '@/components/dashboard/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Gift,
  Info,
  Loader2,
  MessagesSquare,
  Palette,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  activateBillingModule,
  getMyCompanyBilling,
  simulatePricing,
  type SerializableBillingBlock,
  type SimulatePricingResult,
} from '@/app/actions/billing';
import { formatBRL } from '@/lib/billing/format';

// ─── Format helpers (client-safe, sem regra de negocio) ─────────

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

/** Dias restantes ate uma data ISO. Negativo se ja passou. */
function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const target = new Date(iso).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// ─── Token helper ───────────────────────────────────────────────

async function getIdToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Não autenticado.');
  return currentUser.getIdToken();
}

// ─── Status badge helper ────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
    active: { label: 'Ativo', cls: 'bg-green-100 text-green-800 hover:bg-green-100', Icon: CheckCircle },
    free: { label: 'Teste gratuito', cls: 'bg-blue-100 text-blue-800 hover:bg-blue-100', Icon: Gift },
    pending: { label: 'Aguardando pagamento', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100', Icon: Clock },
    blocked: { label: 'Bloqueado', cls: 'bg-red-100 text-red-800 hover:bg-red-100', Icon: AlertTriangle },
    disabled: { label: 'Desligado', cls: 'bg-slate-100 text-slate-700 hover:bg-slate-100', Icon: Info },
  };
  const entry = map[status] ?? map.disabled;
  const { Icon } = entry;
  return (
    <Badge className={entry.cls}>
      <Icon className="h-3 w-3 mr-1" />
      {entry.label}
    </Badge>
  );
}

// ─── Banner helper ──────────────────────────────────────────────

interface BannerProps {
  variant: 'success' | 'info' | 'warning' | 'critical' | 'beta';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  cta?: { label: string; onClick: () => void; loading?: boolean };
}

const BANNER_VARIANT: Record<BannerProps['variant'], { container: string; iconClass: string; btnClass: string }> = {
  success: {
    container: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    iconClass: 'text-emerald-600',
    btnClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
  info: {
    container: 'border-blue-300 bg-blue-50 text-blue-900',
    iconClass: 'text-blue-600',
    btnClass: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  warning: {
    container: 'border-amber-300 bg-amber-50 text-amber-900',
    iconClass: 'text-amber-600',
    btnClass: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  critical: {
    container: 'border-red-300 bg-red-50 text-red-900',
    iconClass: 'text-red-600',
    btnClass: 'bg-red-600 text-white hover:bg-red-700',
  },
  beta: {
    container: 'border-purple-300 bg-purple-50 text-purple-900',
    iconClass: 'text-purple-600',
    btnClass: 'bg-purple-600 text-white hover:bg-purple-700',
  },
};

function Banner({ variant, icon: Icon, title, message, cta }: BannerProps) {
  const v = BANNER_VARIANT[variant];
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${v.container}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${v.iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm mt-1 opacity-90">{message}</p>
      </div>
      {cta && (
        <Button size="sm" className={v.btnClass} onClick={cta.onClick} disabled={cta.loading}>
          {cta.loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {cta.label}
        </Button>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const { toast } = useToast();

  // Estado do billing vindo do servidor
  const [billing, setBilling] = useState<SerializableBillingBlock | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);

  // Preco do tier atual (calculado UMA vez ao carregar, sem reatividade)
  const [currentPricing, setCurrentPricing] = useState<SimulatePricingResult | null>(null);

  // Local UI state — toggles dos modulos opcionais
  const [tlExpanded, setTlExpanded] = useState(false);
  const [designExpanded, setDesignExpanded] = useState(false);

  // Inputs minimos pros modulos opcionais (so usados ao ativar)
  const [tlExecutives, setTlExecutives] = useState<number>(1);
  const [tlFrequency, setTlFrequency] = useState<2 | 3 | 4>(2);
  const [designPack, setDesignPack] = useState<'starter' | 'growth' | 'scale'>('starter');

  // Transicoes de acao
  const [activatingModule, setActivatingModule] = useState<
    'platform' | 'tl' | 'design' | null
  >(null);
  const [, startTransition] = useTransition();

  // ─── Fetch billing + pricing inicial ──────────────────────────
  const loadBilling = useCallback(async () => {
    setLoadingBilling(true);
    try {
      const idToken = await getIdToken();
      const res = await getMyCompanyBilling(idToken);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Falha ao carregar billing.');
      }
      setBilling(res.data);

      // Hidrata UI dos opcionais com valores ja salvos (para botao "Ativar"
      // refletir o que ja esta no Firestore)
      if (res.data.tl.executives > 0) setTlExecutives(res.data.tl.executives);
      if ([2, 3, 4].includes(res.data.tl.frequency)) {
        setTlFrequency(res.data.tl.frequency as 2 | 3 | 4);
      }
      if (res.data.design.pack) setDesignPack(res.data.design.pack);

      // Se modulo ja esta ativo, expande seu card pra mostrar configuracao atual
      if (res.data.tl.status === 'active' || res.data.tl.status === 'pending') {
        setTlExpanded(true);
      }
      if (res.data.design.status === 'active' || res.data.design.status === 'pending') {
        setDesignExpanded(true);
      }

      // Calcula preco do tier ATUAL (uma vez). Sem reatividade.
      // - Platform: usa seats reais (min 5)
      // - TL: usa executives/frequency reais se > 0, senao defaults pra preview vazio nao quebrar
      // - Design: usa pack atual ou starter
      const previewSeats = Math.max(res.data.platform.seats || 5, 5);
      const previewExec = res.data.tl.executives > 0 ? res.data.tl.executives : 1;
      const previewFreq = [2, 3, 4].includes(res.data.tl.frequency)
        ? (res.data.tl.frequency as 2 | 3 | 4)
        : 2;
      const previewPack = res.data.design.pack ?? 'starter';

      const sim = await simulatePricing({
        idToken,
        platform: { seats: previewSeats },
        tl: { executives: previewExec, frequency: previewFreq },
        design: { pack: previewPack },
      });
      if (sim.success && sim.data) {
        setCurrentPricing(sim.data);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar o billing.',
      });
    } finally {
      setLoadingBilling(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // ─── Recalcular preco TL/Design quando inputs mudam ───────────
  // (so executa se o admin mexeu nos inputs locais; debounce leve)
  useEffect(() => {
    if (loadingBilling || !billing) return;
    const handle = setTimeout(async () => {
      try {
        const idToken = await getIdToken();
        const sim = await simulatePricing({
          idToken,
          platform: { seats: Math.max(billing.platform.seats || 5, 5) },
          tl: { executives: tlExecutives, frequency: tlFrequency },
          design: { pack: designPack },
        });
        if (sim.success && sim.data) {
          setCurrentPricing(sim.data);
        }
      } catch {
        // silencioso — preview opcional
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [tlExecutives, tlFrequency, designPack, billing, loadingBilling]);

  // ─── Acao: ativar modulo (cria Checkout Stripe) ───────────────
  const handleActivate = (module: 'platform' | 'tl' | 'design') => {
    setActivatingModule(module);
    startTransition(async () => {
      try {
        const idToken = await getIdToken();
        const res = await activateBillingModule({
          idToken,
          module,
          // Para Platform o server faz resync e usa seats reais; passamos o que vimos
          platformSeats:
            module === 'platform' ? Math.max(billing?.platform.seats || 5, 5) : undefined,
          tlExecutives: module === 'tl' ? tlExecutives : undefined,
          tlFrequency: module === 'tl' ? tlFrequency : undefined,
          designPack: module === 'design' ? designPack : undefined,
        });
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Falha ao ativar modulo.');
        }
        toast({
          title: 'Redirecionando para pagamento',
          description: `Prazo de 7 dias. Deadline: ${formatDateBR(res.data.deadlineISO)}`,
        });
        window.location.href = res.data.checkoutUrl;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro ao ativar',
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
        setActivatingModule(null);
      }
    });
  };

  // ─── Banner principal (1 por vez, prioridade decrescente) ─────
  // Calcula client-side com base no SerializableBillingBlock.
  // Banners de pending/blocked/beta dos modulos ja aparecem via
  // BillingWarningBanner (admin/layout.tsx). Aqui focamos no estado
  // do trial e de free unlimited do Platform.
  const topBanner = useMemo<BannerProps | null>(() => {
    if (!billing) return null;
    const p = billing.platform;

    // Free trial ilimitado (parceiro Boldfy)
    if (p.freeTrialUnlimited && p.status === 'free') {
      return {
        variant: 'beta',
        icon: Sparkles,
        title: 'Free trial ilimitado',
        message: 'Sua empresa tem acesso cortesia da Boldfy. Sem cobranca recorrente.',
      };
    }

    // Trial Platform ativo: mostra countdown
    if (p.status === 'free' && p.trialEndsAtISO) {
      const days = daysFromNow(p.trialEndsAtISO);
      if (days !== null) {
        if (days > 7) {
          return {
            variant: 'success',
            icon: Gift,
            title: `Teste gratuito termina em ${days} dias`,
            message: `Aproveite a plataforma. Voce ainda nao precisa cadastrar cartao.`,
          };
        }
        if (days > 0) {
          return {
            variant: 'warning',
            icon: Clock,
            title: `Teste termina em ${days} ${days === 1 ? 'dia' : 'dias'}`,
            message: 'Cadastre seu cartão para não perder o acesso quando o teste acabar.',
            cta: {
              label: 'Cadastrar cartão',
              onClick: () => handleActivate('platform'),
              loading: activatingModule === 'platform',
            },
          };
        }
        // days <= 0 mas ainda 'free' (cron ainda nao rodou) — trata como urgente
        return {
          variant: 'critical',
          icon: AlertCircle,
          title: 'Teste gratuito encerrado',
          message: 'Cadastre seu cartao agora para evitar bloqueio.',
          cta: {
            label: 'Cadastrar cartao',
            onClick: () => handleActivate('platform'),
            loading: activatingModule === 'platform',
          },
        };
      }
    }

    // Pending: tem 7 dias pra cadastrar cartao apos trial
    if (p.status === 'pending') {
      const days = daysFromNow(p.cardDeadlineEndsAtISO ?? p.firstPaymentDeadlineISO);
      const daysText = days !== null ? `${days} ${days === 1 ? 'dia' : 'dias'}` : 'poucos dias';
      return {
        variant: 'critical',
        icon: AlertCircle,
        title: 'Teste encerrado — cadastre seu cartao',
        message: `Voce tem ${daysText} para cadastrar pagamento ou a plataforma sera bloqueada.`,
        cta: {
          label: 'Cadastrar agora',
          onClick: () => handleActivate('platform'),
          loading: activatingModule === 'platform',
        },
      };
    }

    // Active + beta
    if (p.status === 'active' && billing.isBetaTester) {
      const days = daysFromNow(billing.betaEndsAtISO);
      if (days !== null && days > 0) {
        return {
          variant: 'info',
          icon: Sparkles,
          title: 'Você está pagando preço beta',
          message: `Desconto de 30% no Platform por mais ${days} ${days === 1 ? 'dia' : 'dias'}. Depois disso, preço cheio.`,
        };
      }
    }

    return null;
  }, [billing, activatingModule]);

  // ─── Render ───────────────────────────────────────────────────

  if (loadingBilling) {
    return (
      <>
        <Header title="Planos e Cobrança" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-6 max-w-5xl mx-auto">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!billing) {
    return (
      <>
        <Header title="Planos e Cobrança" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Não foi possível carregar</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={loadBilling}>Tentar novamente</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  const platformSeats = Math.max(billing.platform.seats || 5, 5);
  const isBeta = billing.isBetaTester;

  // Botao Platform: muda conforme estado
  const platformButton = (() => {
    const p = billing.platform;
    if (p.status === 'active') {
      return { label: 'Gerenciar cobranca', icon: CreditCard, primary: false };
    }
    if (p.status === 'pending' || p.status === 'blocked') {
      return { label: 'Cadastrar cartao agora', icon: AlertCircle, primary: true };
    }
    if (p.status === 'free') {
      // Antecipar (opcional)
      return { label: 'Adicionar cartao de pagamento', icon: CreditCard, primary: false };
    }
    return { label: 'Ativar Platform', icon: CreditCard, primary: true };
  })();

  return (
    <>
      <Header
        title="Planos e Cobranca"
        subtitle="Veja seu plano atual e gerencie modulos opcionais."
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-5xl mx-auto">
          {/* ─── Banner principal (1 por vez) ───────────────────── */}
          {topBanner && <Banner {...topBanner} />}

          {/* ─── PLATFORM (sempre visivel) ──────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Platform
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Gamificacao, trilhas, recompensas e gestao de colaboradores.
                  </CardDescription>
                </div>
                <StatusBadge status={billing.platform.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Linha de info: tier + seats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Tier</p>
                  <p className="text-lg font-semibold">
                    {currentPricing?.platform?.valid ? currentPricing.platform.tierName : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Colaboradores</p>
                  <p className="text-lg font-semibold">{platformSeats}</p>
                </div>
              </div>

              {/* Precos */}
              {currentPricing?.platform?.valid && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preco cheio</span>
                    <span className="text-sm font-medium">
                      {formatBRL(currentPricing.platform.totalCents / (isBeta ? 0.7 : 1))}/mes
                    </span>
                  </div>
                  {isBeta && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-purple-700 font-medium">Com beta (-30%)</span>
                        <span className="text-lg font-bold text-purple-700">
                          {formatBRL(currentPricing.platform.totalCents)}/mes
                        </span>
                      </div>
                      {billing.betaEndsAtISO && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Beta termina em {formatDateBR(billing.betaEndsAtISO)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Proxima cobranca (so quando active) */}
              {billing.platform.status === 'active' && billing.platform.firstPaymentDeadlineISO && (
                <p className="text-sm text-muted-foreground">
                  Proxima cobranca:{' '}
                  <span className="font-medium text-foreground">
                    {formatDateBR(billing.platform.firstPaymentDeadlineISO)}
                  </span>
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button
                onClick={() => handleActivate('platform')}
                disabled={activatingModule !== null || billing.platform.freeTrialUnlimited}
                className={
                  platformButton.primary ? 'bg-purple-600 hover:bg-purple-700' : ''
                }
                variant={platformButton.primary ? 'default' : 'outline'}
              >
                {activatingModule === 'platform' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <platformButton.icon className="h-4 w-4 mr-2" />
                {platformButton.label}
              </Button>
              {billing.platform.freeTrialUnlimited && (
                <p className="text-xs text-muted-foreground ml-3">
                  Cobranca desabilitada (cortesia Boldfy).
                </p>
              )}
            </CardFooter>
          </Card>

          {/* ─── THOUGHT LEADERS (toggle, collapsed por default) ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessagesSquare className="h-5 w-5" />
                    Thought Leaders
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Content Full-Service para executivos da sua empresa.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={billing.tl.status} />
                  <Switch
                    id="tl-toggle"
                    checked={tlExpanded}
                    onCheckedChange={setTlExpanded}
                    disabled={
                      billing.tl.billedOutsidePlatform ||
                      billing.tl.status === 'active' ||
                      billing.tl.status === 'pending'
                    }
                    aria-label="Expandir Thought Leaders"
                  />
                </div>
              </div>
            </CardHeader>

            {tlExpanded && (
              <>
                <CardContent className="space-y-4">
                  {billing.tl.billedOutsidePlatform && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                      Este modulo esta sendo cobrado fora da plataforma (contrato direto).
                      Ativacao via Stripe desabilitada aqui.
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tl-execs">Executivos</Label>
                      <Input
                        id="tl-execs"
                        type="number"
                        min={1}
                        max={5}
                        value={tlExecutives}
                        onChange={(e) => setTlExecutives(Number(e.target.value) || 1)}
                        disabled={
                          billing.tl.billedOutsidePlatform ||
                          billing.tl.status === 'active' ||
                          billing.tl.status === 'pending'
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Entre 1 e 5 (acima e enterprise).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tl-freq">Frequencia</Label>
                      <Select
                        value={String(tlFrequency)}
                        onValueChange={(v) => setTlFrequency(Number(v) as 2 | 3 | 4)}
                        disabled={
                          billing.tl.billedOutsidePlatform ||
                          billing.tl.status === 'active' ||
                          billing.tl.status === 'pending'
                        }
                      >
                        <SelectTrigger id="tl-freq">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 posts/semana</SelectItem>
                          <SelectItem value="3">3 posts/semana</SelectItem>
                          <SelectItem value="4">4 posts/semana</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {currentPricing?.tl?.valid && (
                    <div className="rounded-lg border p-4 bg-muted/20 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {tlExecutives} executivo(s) × {tlFrequency} posts/semana
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          + 7 dias de trial apos pagamento
                        </p>
                      </div>
                      <span className="text-xl font-bold">
                        {formatBRL(currentPricing.tl.totalCents)}/mes
                      </span>
                    </div>
                  )}
                </CardContent>
                {!billing.tl.billedOutsidePlatform && (
                  <CardFooter className="border-t px-6 py-4">
                    <Button
                      onClick={() => handleActivate('tl')}
                      disabled={
                        activatingModule !== null ||
                        billing.tl.status === 'active' ||
                        billing.tl.status === 'pending' ||
                        !currentPricing?.tl?.valid
                      }
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {activatingModule === 'tl' && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <CreditCard className="h-4 w-4 mr-2" />
                      {billing.tl.status === 'active'
                        ? 'Ativo'
                        : billing.tl.status === 'pending'
                        ? 'Aguardando pagamento'
                        : 'Ativar Thought Leaders'}
                    </Button>
                  </CardFooter>
                )}
              </>
            )}
          </Card>

          {/* ─── DESIGN (toggle, collapsed por default) ─────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Design
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Pacotes de pecas de design mensais.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={billing.design.status} />
                  <Switch
                    id="design-toggle"
                    checked={designExpanded}
                    onCheckedChange={setDesignExpanded}
                    disabled={
                      billing.design.status === 'active' || billing.design.status === 'pending'
                    }
                    aria-label="Expandir Design"
                  />
                </div>
              </div>
            </CardHeader>

            {designExpanded && (
              <>
                <CardContent className="space-y-4">
                  {billing.platform.status !== 'active' && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                      Design so pode ser ativado apos Platform estar pago (active).
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="design-pack">Pacote</Label>
                    <Select
                      value={designPack}
                      onValueChange={(v) => setDesignPack(v as 'starter' | 'growth' | 'scale')}
                      disabled={
                        billing.design.status === 'active' || billing.design.status === 'pending'
                      }
                    >
                      <SelectTrigger id="design-pack">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter (4 pecas/mes)</SelectItem>
                        <SelectItem value="growth">Growth (8 pecas/mes)</SelectItem>
                        <SelectItem value="scale">Scale (12 pecas/mes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentPricing?.design?.valid && (
                    <div className="rounded-lg border p-4 bg-muted/20 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {currentPricing.design.packName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          + 7 dias de trial apos pagamento
                        </p>
                      </div>
                      <span className="text-xl font-bold">
                        {formatBRL(currentPricing.design.totalCents)}/mes
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button
                    onClick={() => handleActivate('design')}
                    disabled={
                      activatingModule !== null ||
                      billing.design.status === 'active' ||
                      billing.design.status === 'pending' ||
                      billing.platform.status !== 'active' ||
                      !currentPricing?.design?.valid
                    }
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {activatingModule === 'design' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CreditCard className="h-4 w-4 mr-2" />
                    {billing.design.status === 'active'
                      ? 'Ativo'
                      : billing.design.status === 'pending'
                      ? 'Aguardando pagamento'
                      : 'Ativar Design'}
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
