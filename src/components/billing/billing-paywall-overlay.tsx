// src/components/billing/billing-paywall-overlay.tsx
// Paywall global: overlay com blur + modal de "acesso pausado" que trava toda
// a interacao quando o modulo do usuario esta sem acesso (blocked / pending
// vencido / beta expirado).
//
// UI DUMB: a decisao de bloquear vem 100% do server (getBillingAccess), que
// reusa evaluateModuleAccess — a MESMA funcao que gateia as server actions.
// Assim overlay (client) e bloqueio (server) nunca divergem.
//
// fail-open: enquanto o server nao confirma blocked=true, nao mostra nada.
// Nunca trava por bug/erro de rede — o bloqueio real continua server-side.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Lock, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  getBillingAccess,
  createRegularizationCheckout,
  type BillingAccessResult,
} from '@/app/actions/billing';

/** Revalida o acesso a cada 5 min com a aba ativa (mesmo ritmo do banner). */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function BillingPaywallOverlay() {
  const router = useRouter();
  const [access, setAccess] = useState<BillingAccessResult | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const mountedRef = useRef(true);

  const fetchAccess = useCallback(async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await getBillingAccess(token);
      if (!mountedRef.current) return;
      if (res.success && res.data) setAccess(res.data);
    } catch {
      // fail-open: silencio. Overlay nunca pode quebrar a app.
    }
  }, []);

  // Carga inicial + ao voltar pra aba + polling.
  useEffect(() => {
    mountedRef.current = true;
    void fetchAccess();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchAccess();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAccess();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [fetchAccess]);

  // Trava o scroll do body enquanto o paywall esta ativo.
  useEffect(() => {
    if (!access?.blocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [access?.blocked]);

  const handleRegularize = useCallback(async () => {
    setCheckoutError(false);
    setRedirecting(true);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setRedirecting(false);
        return;
      }
      const token = await user.getIdToken();
      const res = await createRegularizationCheckout(token);
      if (res.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return; // navega pro Stripe; mantem o spinner.
      }
      setCheckoutError(true);
      setRedirecting(false);
    } catch {
      setCheckoutError(true);
      setRedirecting(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(firebaseAuth);
    } catch {
      // ignora — segue pro login de qualquer forma.
    }
    router.push('/login');
  }, [router]);

  if (!access?.blocked) return null;

  const canPay = access.canManageBilling;
  const moduleLabel = access.moduleLabel ?? 'sua conta';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F0A18]/45 backdrop-blur-md"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[#E4D8ED] bg-white p-8 shadow-[0_20px_50px_rgba(93,42,103,0.18)]">
        {/* Glow de atmosfera Boldfy */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full"
          style={{ background: '#CD50F1', filter: 'blur(120px)', opacity: 0.12 }}
        />

        <div className="relative">
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px]"
            style={{
              background: 'linear-gradient(135deg, #CD50F1, #9840AD)',
              boxShadow: '0 8px 24px rgba(205, 80, 241, .28)',
            }}
          >
            <Lock className="h-6 w-6 text-white" strokeWidth={2.2} aria-hidden="true" />
          </div>

          <h2
            id="paywall-title"
            className="font-headline text-2xl font-black tracking-tight text-[#5E2A67]"
          >
            Seu acesso está em pausa
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-[#45336B]">
            {canPay ? (
              <>
                O período da {moduleLabel} chegou ao fim, mas nada se perdeu: seu
                programa, seus dados e todo o histórico continuam aqui, esperando
                você. É só reativar com o cartão pra seguir de onde parou.
              </>
            ) : (
              <>
                O acesso da {moduleLabel} está pausado até a conta ser
                regularizada. Fale com a pessoa responsável pelo financeiro da sua
                empresa: assim que o pagamento for feito, tudo volta exatamente
                como estava.
              </>
            )}
          </p>

          {checkoutError && (
            <p className="mt-4 text-xs leading-relaxed text-[#EE5A52]">
              Não consegui abrir o pagamento agora. Tente de novo em instantes ou
              use &ldquo;Gerenciar pagamento&rdquo;.
            </p>
          )}

          <div className="mt-7 flex flex-col gap-2.5">
            {canPay && (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleRegularize}
                  disabled={redirecting}
                  className="w-full gap-2 bg-[#CD50F1] text-white shadow-[0_8px_24px_rgba(205,80,241,.28)] hover:bg-[#9840AD]"
                  autoFocus
                >
                  {redirecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  )}
                  Inserir cartão e reativar
                </Button>

                <Button
                  asChild
                  type="button"
                  size="lg"
                  variant="outline"
                  className="w-full border-[#E4D8ED] text-[#5E2A67] hover:border-[#CD50F1] hover:text-[#CD50F1]"
                >
                  <Link href="/admin/billing">Gerenciar pagamento</Link>
                </Button>
              </>
            )}

            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={handleLogout}
              className="w-full gap-2 text-[#9D85B3] hover:text-[#5E2A67]"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
