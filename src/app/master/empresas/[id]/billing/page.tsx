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
import { Loader2, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getCompanyBilling,
  updateCompanyBillingToggles,
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
    case 'pending':
      return 'Aguardando pagamento';
    case 'blocked':
      return 'Bloqueado';
    case 'disabled':
    default:
      return 'Desativado';
  }
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
