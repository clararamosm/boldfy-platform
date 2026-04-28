// src/app/admin/billing/page.tsx
// Simulador e ativacao dos modulos de billing para o Admin da empresa.
// - Zero regra de negocio no client: tudo passa por server actions.
// - Precos sao calculados via simulatePricing() no servidor.
// - Ativacao real via activateBillingModule() (cria Checkout e redireciona).

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
import { Slider } from '@/components/ui/slider';
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
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Info,
  Loader2,
  MessagesSquare,
  Palette,
  Users,
} from 'lucide-react';
import {
  activateBillingModule,
  getMyCompanyBilling,
  simulatePricing,
  type SerializableBillingBlock,
  type SimulatePricingResult,
} from '@/app/actions/billing';

// ─── Format helpers (client-safe, sem regra de negocio) ─────────

function formatBRL(cents: number | null | undefined): string {
  const value = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

// ─── Token helper ───────────────────────────────────────────────

async function getIdToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('Nao autenticado.');
  return currentUser.getIdToken();
}

// ─── Status badge helper ────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
    active: { label: 'Ativo', cls: 'bg-green-100 text-green-800 hover:bg-green-100', Icon: CheckCircle },
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

// ─── Page ───────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const { toast } = useToast();

  // Estado do billing vindo do servidor
  const [billing, setBilling] = useState<SerializableBillingBlock | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);

  // Configuracao do simulador (local state)
  const [platformSeats, setPlatformSeats] = useState<number>(5);
  const [tlExecutives, setTlExecutives] = useState<number>(1);
  const [tlFrequency, setTlFrequency] = useState<2 | 3 | 4>(2);
  const [designPack, setDesignPack] = useState<'starter' | 'growth' | 'scale'>('starter');

  // Resultado calculado pelo servidor
  const [simulation, setSimulation] = useState<SimulatePricingResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Transicoes de acao
  const [activatingModule, setActivatingModule] = useState<
    'platform' | 'tl' | 'design' | null
  >(null);
  const [, startTransition] = useTransition();

  // ─── Fetch billing ────────────────────────────────────────────
  const loadBilling = useCallback(async () => {
    setLoadingBilling(true);
    try {
      const idToken = await getIdToken();
      const res = await getMyCompanyBilling(idToken);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Falha ao carregar billing.');
      }
      setBilling(res.data);
      // Inicializar slider com seats reais (fallback = 5)
      if (res.data.platform.seats > 0) {
        setPlatformSeats(res.data.platform.seats);
      }
      // Inicializar TL com valores atuais, se houver
      if (res.data.tl.executives > 0) setTlExecutives(res.data.tl.executives);
      if ([2, 3, 4].includes(res.data.tl.frequency)) {
        setTlFrequency(res.data.tl.frequency as 2 | 3 | 4);
      }
      if (res.data.design.pack) setDesignPack(res.data.design.pack);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Nao foi possivel carregar o billing.',
      });
    } finally {
      setLoadingBilling(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // ─── Recalcular precos ao mudar inputs ───────────────────────
  const runSimulation = useCallback(async () => {
    setSimulating(true);
    try {
      const idToken = await getIdToken();
      const res = await simulatePricing({
        idToken,
        platform: { seats: platformSeats },
        tl: { executives: tlExecutives, frequency: tlFrequency },
        design: { pack: designPack },
      });
      if (!res.success || !res.data) {
        console.warn('[simulatePricing] erro:', res.error);
        return;
      }
      setSimulation(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  }, [platformSeats, tlExecutives, tlFrequency, designPack]);

  useEffect(() => {
    if (loadingBilling) return;
    const handle = setTimeout(runSimulation, 250); // debounce leve
    return () => clearTimeout(handle);
  }, [runSimulation, loadingBilling]);

  // ─── Ativar modulo ────────────────────────────────────────────
  const handleActivate = (module: 'platform' | 'tl' | 'design') => {
    setActivatingModule(module);
    startTransition(async () => {
      try {
        const idToken = await getIdToken();
        const res = await activateBillingModule({
          idToken,
          module,
          platformSeats: module === 'platform' ? platformSeats : undefined,
          tlExecutives: module === 'tl' ? tlExecutives : undefined,
          tlFrequency: module === 'tl' ? tlFrequency : undefined,
          designPack: module === 'design' ? designPack : undefined,
        });
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Falha ao ativar modulo.');
        }
        toast({
          title: 'Redirecionando para pagamento',
          description: `Prazo de 7 dias para pagar. Deadline: ${formatDateBR(res.data.deadlineISO)}`,
        });
        window.location.href = res.data.checkoutUrl;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro ao ativar',
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
      } finally {
        setActivatingModule(null);
      }
    });
  };

  const canActivate = (module: 'platform' | 'tl' | 'design') => {
    if (!billing) return false;
    if (activatingModule) return false;
    const m = billing[module];
    // Permite ativar se desligado, bloqueado ou sem sub
    if (m.status === 'active' || m.status === 'pending') return false;
    // Design exige Platform ativo
    if (module === 'design' && billing.platform.status !== 'active') return false;
    if (module === 'tl' && billing.tl.billedOutsidePlatform) return false;
    return simulation?.[module]?.valid === true;
  };

  const betaLimits = useMemo(() => {
    if (!billing?.isBetaTester) return null;
    return billing.betaExpiresAtISO;
  }, [billing]);

  // ─── Render ───────────────────────────────────────────────────

  if (loadingBilling) {
    return (
      <>
        <Header title="Planos e Cobranca" subtitle="Simule e ative modulos" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-6 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <Skeleton className="h-7 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  if (!billing) {
    return (
      <>
        <Header title="Planos e Cobranca" subtitle="Simule e ative modulos" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Nao foi possivel carregar</CardTitle>
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

  const betaActive = billing.isBetaTester;

  return (
    <>
      <Header
        title="Planos e Cobranca"
        subtitle="Configure os modulos, simule o valor e ative pagando via Stripe."
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-5xl mx-auto">
          {/* ─── Aviso global de estado ─────────────────────────── */}
          {(
            <Card className="border-amber-300 bg-amber-50/40">
              <CardContent className="pt-6 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    Billing desligado pelo time Boldfy
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Voce pode simular precos, mas a ativacao esta temporariamente bloqueada.
                    Entre em contato com o suporte para liberar.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {betaActive && betaLimits && (
            <Card className="border-purple-300 bg-purple-50/40">
              <CardContent className="pt-6 flex items-start gap-3">
                <Info className="h-5 w-5 text-purple-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    Sua empresa e beta tester
                  </p>
                  <p className="text-sm text-purple-800 mt-1">
                    Desconto de 30% no modulo Platform valido ate{' '}
                    <strong>{formatDateBR(betaLimits)}</strong>. Ative antes dessa data pra
                    travar o preco beta por 5 meses.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── PLATFORM ────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Platform
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Gamificacao, trilhas, recompensas e gestao de colaboradores. Cobrado por
                    licenca/mes, com minimo de 5.
                  </CardDescription>
                </div>
                <StatusBadge status={billing.platform.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Slider de seats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="platform-seats">Licencas</Label>
                  <Input
                    id="platform-seats"
                    type="number"
                    min={simulation?.platformLimits.min ?? 5}
                    max={simulation?.platformLimits.max ?? 70}
                    value={platformSeats}
                    onChange={(e) => setPlatformSeats(Number(e.target.value) || 0)}
                    className="w-24 h-9 text-right"
                  />
                </div>
                <Slider
                  value={[platformSeats]}
                  onValueChange={(v) => setPlatformSeats(v[0] ?? 5)}
                  min={simulation?.platformLimits.min ?? 5}
                  max={simulation?.platformLimits.max ?? 70}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Min {simulation?.platformLimits.min ?? 5} - Max{' '}
                  {simulation?.platformLimits.max ?? 70}. Acima disso e enterprise.
                </p>
              </div>

              {/* Resumo Platform */}
              <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                {simulation?.platform?.valid ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tier</span>
                      <Badge variant="outline">{simulation.platform.tierName}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Por licenca</span>
                      <span className="text-sm">
                        {formatBRL(simulation.platform.perSeatCents)}/mes
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total mensal</span>
                      <span className="text-xl font-bold">
                        {formatBRL(simulation.platform.totalCents)}
                      </span>
                    </div>
                    {betaActive && (
                      <p className="text-xs text-purple-700">
                        Inclui desconto beta de 30% valido por 5 meses apos ativacao.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-red-700">
                    {simulation?.platform?.error ?? 'Ajuste o numero de licencas.'}
                  </p>
                )}
              </div>

              {billing.platform.firstPaymentDeadlineISO &&
                billing.platform.status === 'pending' && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                    Pagamento pendente ate{' '}
                    <strong>{formatDateBR(billing.platform.firstPaymentDeadlineISO)}</strong>.
                  </div>
                )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button
                onClick={() => handleActivate('platform')}
                disabled={!canActivate('platform')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {activatingModule === 'platform' && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <CreditCard className="h-4 w-4 mr-2" />
                {billing.platform.status === 'active'
                  ? 'Ativo'
                  : billing.platform.status === 'pending'
                  ? 'Aguardando pagamento'
                  : 'Ativar Platform'}
              </Button>
            </CardFooter>
          </Card>

          {/* ─── TL ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessagesSquare className="h-5 w-5" />
                    Thought Leaders
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Content Full-Service para executivos. Cobrado por pacote mensal (executivos ×
                    frequencia).
                  </CardDescription>
                </div>
                <StatusBadge status={billing.tl.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {billing.tl.billedOutsidePlatform && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                  Este modulo esta sendo cobrado fora da plataforma (contrato direto). Ativacao
                  via Stripe desabilitada aqui.
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
                    onChange={(e) => setTlExecutives(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Entre 1 e 5 (acima = enterprise).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tl-freq">Posts por semana</Label>
                  <Select
                    value={String(tlFrequency)}
                    onValueChange={(v) => setTlFrequency(Number(v) as 2 | 3 | 4)}
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

              <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                {simulation?.tl?.valid ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tlExecutives} executivo(s) × {tlFrequency} posts/semana
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total mensal</span>
                      <span className="text-xl font-bold">
                        {formatBRL(simulation.tl.totalCents)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-700">
                    {simulation?.tl?.error ?? 'Ajuste a configuracao.'}
                  </p>
                )}
              </div>

              {billing.tl.firstPaymentDeadlineISO && billing.tl.status === 'pending' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  Pagamento pendente ate{' '}
                  <strong>{formatDateBR(billing.tl.firstPaymentDeadlineISO)}</strong>.
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button
                onClick={() => handleActivate('tl')}
                disabled={!canActivate('tl')}
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
          </Card>

          {/* ─── DESIGN ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Design
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Pacotes de peças de design mensais. Requer Platform ativo.
                  </CardDescription>
                </div>
                <StatusBadge status={billing.design.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {billing.platform.status !== 'active' && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                  Design so pode ser ativado apos Platform estar ativo.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="design-pack">Pack</Label>
                <Select
                  value={designPack}
                  onValueChange={(v) => setDesignPack(v as 'starter' | 'growth' | 'scale')}
                >
                  <SelectTrigger id="design-pack">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (4 peças/mes)</SelectItem>
                    <SelectItem value="growth">Growth (8 peças/mes)</SelectItem>
                    <SelectItem value="scale">Scale (12 peças/mes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                {simulation?.design?.valid ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pack</span>
                      <Badge variant="outline">{simulation.design.packName}</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total mensal</span>
                      <span className="text-xl font-bold">
                        {formatBRL(simulation.design.totalCents)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-700">
                    {simulation?.design?.error ?? 'Selecione um pack.'}
                  </p>
                )}
              </div>

              {billing.design.firstPaymentDeadlineISO && billing.design.status === 'pending' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  Pagamento pendente ate{' '}
                  <strong>{formatDateBR(billing.design.firstPaymentDeadlineISO)}</strong>.
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button
                onClick={() => handleActivate('design')}
                disabled={!canActivate('design')}
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
          </Card>

          {/* ─── TOTAL GERAL ─────────────────────────────────────── */}
          <Card className="border-purple-200">
            <CardHeader>
              <CardTitle>Total mensal simulado</CardTitle>
              <CardDescription>
                Soma de todos os modulos configurados acima. Cada modulo tem seu proprio ciclo de
                cobranca.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {simulating ? 'Recalculando...' : 'Soma estimada'}
                </span>
                <span className="text-3xl font-bold text-purple-700">
                  {formatBRL(simulation?.grandTotalCents)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Valores em BRL. NFS-e sera emitida separadamente (via integracao fiscal ainda em
                implantacao).
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
