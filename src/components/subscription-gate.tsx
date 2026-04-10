// src/components/subscription-gate.tsx
// Blocks app access when subscription is expired/canceled.
// Shows an overlay with a CTA to subscribe.
// SECURITY: Does NOT render children — blocked content is not in the DOM.

'use client';

import { Lock, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type SubscriptionGateProps = {
  role: 'admin' | 'colaborador';
  plan: string;
  children?: React.ReactNode; // kept for API compat but NOT rendered
};

export function SubscriptionGate({ role, plan }: SubscriptionGateProps) {
  const isTrialExpired = plan === 'trial';

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50/80">
      <div className="mx-4 w-full max-w-md rounded-2xl border bg-white p-8 shadow-2xl text-center">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
          <Lock className="h-8 w-8 text-purple-600" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isTrialExpired ? 'Seu período de teste expirou' : 'Assinatura inativa'}
        </h2>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {role === 'admin' ? (
            isTrialExpired
              ? 'Seu mês gratuito de teste chegou ao fim. Para continuar usando a Boldfy, ative sua assinatura.'
              : 'Sua assinatura está inativa. Reative para continuar usando a plataforma.'
          ) : (
            isTrialExpired
              ? 'O período de teste da sua empresa expirou. Entre em contato com o administrador para ativar a assinatura.'
              : 'A assinatura da sua empresa está inativa. Entre em contato com o administrador para resolver.'
          )}
        </p>

        {/* CTA */}
        {role === 'admin' ? (
          <div className="space-y-3">
            <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              <Link href="/admin/configuracoes">
                <CreditCard className="h-4 w-4 mr-2" />
                Ativar Assinatura
              </Link>
            </Button>
            <p className="text-xs text-gray-500">
              Escolha seu plano e adicione um cartão para reativar o acesso de toda a equipe.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800">
                Fale com o administrador da sua empresa
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
