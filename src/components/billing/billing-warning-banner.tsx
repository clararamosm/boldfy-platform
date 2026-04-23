// src/components/billing/billing-warning-banner.tsx
// UI DUMB: renderiza warnings que o server mandou, nada mais.
// Toda decisao de severidade, texto e CTA vem do server action getBillingWarnings.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { auth as firebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  getBillingWarnings,
  type GetBillingWarningsResult,
} from '@/app/actions/billing';
import type {
  BillingWarning,
  BillingWarningSeverity,
} from '@/lib/billing/warnings';

/** Refetch a cada 5 min quando a aba esta ativa. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** Chave localStorage para guardar IDs dispensados nesta sessao. */
const DISMISS_KEY = 'boldfy:billing-warnings-dismissed';

interface SeverityVisual {
  container: string;
  icon: typeof AlertCircle;
  iconClass: string;
  buttonClass: string;
}

const SEVERITY_VISUAL: Record<BillingWarningSeverity, SeverityVisual> = {
  critical: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: AlertCircle,
    iconClass: 'text-red-600',
    buttonClass: 'bg-red-600 text-white hover:bg-red-700',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    buttonClass: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-900',
    icon: Info,
    iconClass: 'text-blue-600',
    buttonClass: 'bg-blue-600 text-white hover:bg-blue-700',
  },
};

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((v) => typeof v === 'string'));
  } catch {
    // ignore
  }
  return new Set();
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function BillingWarningBanner() {
  const [warnings, setWarnings] = useState<BillingWarning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const mountedRef = useRef(true);

  const fetchWarnings = useCallback(async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await getBillingWarnings(token);
      if (!mountedRef.current) return;
      if (res.success && res.data) {
        const data = res.data as GetBillingWarningsResult;
        setWarnings(data.warnings);
      }
    } catch {
      // Silencio: banner nao deve quebrar a app.
    }
  }, []);

  // Carga inicial + ao voltar pra aba.
  useEffect(() => {
    mountedRef.current = true;
    void fetchWarnings();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchWarnings();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchWarnings();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [fetchWarnings]);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(id);
        writeDismissed(next);
        return next;
      });
    },
    [],
  );

  // Critical nunca e dispensavel. Warning/info podem ser fechados.
  const visible = warnings.filter((w) => {
    if (w.severity === 'critical') return true;
    return !dismissed.has(w.id);
  });

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.map((w) => {
        const v = SEVERITY_VISUAL[w.severity];
        const Icon = v.icon;
        const canDismiss = w.severity !== 'critical';
        return (
          <div
            key={w.id}
            className={`${v.container} border-b text-sm px-4 py-2.5`}
            role={w.severity === 'critical' ? 'alert' : 'status'}
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-3">
              <Icon className={`h-4 w-4 shrink-0 ${v.iconClass}`} aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-center">
                <span className="font-semibold">{w.title}</span>
                <span className="opacity-90">— {w.message}</span>
              </div>
              {w.cta && (
                <Button
                  size="sm"
                  className={`h-7 ${v.buttonClass}`}
                  asChild
                >
                  <Link href={w.cta.href}>{w.cta.label}</Link>
                </Button>
              )}
              {canDismiss && (
                <button
                  type="button"
                  onClick={() => handleDismiss(w.id)}
                  className="opacity-70 hover:opacity-100 shrink-0"
                  aria-label="Dispensar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
