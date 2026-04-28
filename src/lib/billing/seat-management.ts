// src/lib/billing/seat-management.ts
// Per-seat dinamico estilo Notion para o modulo Platform.
//
// Hook a ser chamado por qualquer server action que adiciona/remove
// colaboradores. Atualiza:
//   1. billing.platform.seats no Firestore (fonte de verdade)
//   2. quantity do item da Subscription no Stripe (proration automatico)
//
// Regras:
// - Minimo SEMPRE 5 seats (PLATFORM_MIN_SEATS). Nao deixa cair abaixo.
// - Maximo 70 (enterprise precisa contrato separado).
// - So atualiza Stripe se status === 'active' (sub existente).
// - Se status === 'disabled' ou 'pending': apenas atualiza Firestore.
//
// server-only.

import 'server-only';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe } from '@/lib/stripe';
import {
  PLATFORM_MIN_SEATS,
  PLATFORM_ENTERPRISE_THRESHOLD,
} from './pricing';
import type { CompanyBillingBlock } from './types';

export interface SeatSyncResult {
  /** Seats que a empresa tem DEPOIS do ajuste. */
  newSeats: number;
  /** True se Stripe foi atualizado, false se apenas Firestore. */
  stripeUpdated: boolean;
}

/**
 * Recalcula seats do Platform baseado em quantos colaboradores ATIVOS existem.
 * Fonte de verdade: count de `users` com `role = 'colaborador'` e `companyId`.
 * Nao depende de delta enviado pela action, evitando drift.
 *
 * Use apos QUALQUER mudanca no conjunto de colaboradores.
 */
export async function resyncPlatformSeats(companyId: string): Promise<SeatSyncResult> {
  const companyRef = adminDb.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    throw new Error(`Empresa ${companyId} nao encontrada.`);
  }

  // Contar colaboradores ativos. Usamos count() da Admin SDK para eficiencia.
  const countSnap = await adminDb
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'colaborador')
    .count()
    .get();

  const activeCollaborators = countSnap.data().count;

  // Seats contratados seguem regra de negocio: max(collabs atuais, minimo 5).
  // Se admin tem 3 colabs, continuamos pagando por 5 (minimo de tier).
  // Se admin tem 12 colabs, pagamos por 12.
  const desiredSeats = Math.max(activeCollaborators, PLATFORM_MIN_SEATS);

  if (desiredSeats > PLATFORM_ENTERPRISE_THRESHOLD) {
    // Nao bloqueamos o add do colaborador, mas registramos flag para time comercial
    await companyRef.update({
      'billing.platform.enterpriseReviewNeeded': true,
      'billing.updatedAt': FieldValue.serverTimestamp(),
    });
  }

  const billing = companySnap.data()?.billing as CompanyBillingBlock | undefined;
  const platform = billing?.platform;

  // Sempre grava o seat count atual (fonte de verdade).
  await companyRef.update({
    'billing.platform.seats': desiredSeats,
    'billing.updatedAt': FieldValue.serverTimestamp(),
  });

  // So atualiza Stripe se ha subscription ativa do modulo Platform.
  if (
    !platform ||
    platform.status !== 'active' ||
    !platform.stripeSubscriptionId
  ) {
    return { newSeats: desiredSeats, stripeUpdated: false };
  }

  // Se esta dentro do range suportado, ajusta quantity no Stripe.
  // Acima de 70 (enterprise), nao tentamos mexer — deixamos para revisao manual.
  if (desiredSeats > PLATFORM_ENTERPRISE_THRESHOLD) {
    return { newSeats: desiredSeats, stripeUpdated: false };
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(platform.stripeSubscriptionId);
    const item = sub.items?.data?.[0];
    if (!item) {
      console.warn('[seat-management] Subscription sem items.');
      return { newSeats: desiredSeats, stripeUpdated: false };
    }

    // Se ja esta no valor correto, skip.
    if (item.quantity === desiredSeats) {
      return { newSeats: desiredSeats, stripeUpdated: false };
    }

    await stripe.subscriptions.update(platform.stripeSubscriptionId, {
      items: [{ id: item.id, quantity: desiredSeats }],
      proration_behavior: 'create_prorations',
    });

    return { newSeats: desiredSeats, stripeUpdated: true };
  } catch (err) {
    console.error('[seat-management] Falha ao sincronizar Stripe:', err);
    // Nao propaga o erro — Firestore ja foi atualizado. Reconciliacao futura
    // pode ser feita via cron.
    return { newSeats: desiredSeats, stripeUpdated: false };
  }
}
