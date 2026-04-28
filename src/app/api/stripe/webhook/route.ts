// src/app/api/stripe/webhook/route.ts
// Stripe webhook handler — updates company subscription status in Firestore.
// Handles beta→full price transition via Subscription Schedules.
// IMPORTANT: This route must NOT use bodyParser. We need the raw body for signature verification.
// Force Node.js runtime — Edge doesn't support Stripe's constructEvent (needs Buffer)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import {
  extractModuleFromSubscriptionMetadata,
  markModuleAsActive,
  markModuleAsBlocked,
  type BillingModule,
} from '@/lib/billing/stripe-modules';
import {
  computeBetaEndDate,
  DEFAULT_BETA_DURATION_MONTHS,
} from '@/lib/billing/master-rules';
import type { CompanyBillingBlock } from '@/lib/billing/types';

// ────────────────────────────────────────────────────────────
// HANDLERS MODULARES (billing.* em vez de subscription.*)
// Toda subscription nova carrega metadata.module no Stripe;
// fluxo legado (subscription.*) foi removido junto com o
// endpoint /api/stripe/checkout.
// ────────────────────────────────────────────────────────────

async function handleModuleCheckoutCompleted(args: {
  companyId: string;
  moduleKey: BillingModule;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const { companyId, moduleKey, subscription } = args;

  // Dados especificos por modulo a persistir no Firestore
  const extra: Record<string, unknown> = {};
  const subAny = subscription as unknown as { current_period_end?: number };

  if (moduleKey === 'platform') {
    const seats = parseInt(subscription.metadata.seats || '0', 10);
    const tier = subscription.metadata.tier || '';
    const isBeta = subscription.metadata.isBeta === 'true';
    extra.seats = seats;
    extra.tier = tier;
    extra.isBeta = isBeta;
  } else if (moduleKey === 'tl') {
    extra.executives = parseInt(subscription.metadata.executives || '0', 10);
    extra.frequency = parseInt(subscription.metadata.frequency || '2', 10);
  } else if (moduleKey === 'design') {
    extra.pack = subscription.metadata.pack;
  }

  if (subAny.current_period_end) {
    extra.currentPeriodEnd = toFirestoreDate(subAny.current_period_end);
  }

  await markModuleAsActive({
    companyId,
    module: moduleKey,
    stripeSubscriptionId: subscription.id,
    extra,
  });
}

async function handleModuleSubscriptionUpdated(args: {
  companyId: string;
  moduleKey: BillingModule;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const { companyId, moduleKey, subscription } = args;
  const subAny = subscription as unknown as {
    status: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
  };

  const statusMap: Record<string, 'active' | 'pending' | 'blocked' | 'disabled'> = {
    active: 'active',
    trialing: 'active',
    past_due: 'blocked',
    unpaid: 'blocked',
    canceled: 'blocked',
    incomplete: 'pending',
    incomplete_expired: 'blocked',
    paused: 'blocked',
  };

  const mappedStatus = statusMap[subAny.status] ?? 'blocked';

  await adminDb.collection('companies').doc(companyId).update({
    [`billing.${moduleKey}.status`]: mappedStatus,
    [`billing.${moduleKey}.currentPeriodEnd`]: subAny.current_period_end
      ? toFirestoreDate(subAny.current_period_end)
      : FieldValue.delete(),
    [`billing.${moduleKey}.cancelAtPeriodEnd`]: subAny.cancel_at_period_end === true,
    'billing.updatedAt': FieldValue.serverTimestamp(),
  });
}

async function handleModuleSubscriptionDeleted(args: {
  companyId: string;
  moduleKey: BillingModule;
}): Promise<void> {
  await markModuleAsBlocked({
    companyId: args.companyId,
    module: args.moduleKey,
    reason: 'canceled',
  });
}

async function handleModulePaymentFailed(args: {
  companyId: string;
  moduleKey: BillingModule;
}): Promise<void> {
  await adminDb.collection('companies').doc(args.companyId).update({
    [`billing.${args.moduleKey}.status`]: 'blocked',
    [`billing.${args.moduleKey}.blockedReason`]: 'payment_failed',
    'billing.updatedAt': FieldValue.serverTimestamp(),
  });
}

/** Safely convert a Stripe timestamp (unix seconds, Date, or undefined) to a JS Date */
function toFirestoreDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Stripe timestamps are in seconds; if value < 1e12 it's seconds, otherwise ms
    return value < 1e12 ? new Date(value * 1000) : new Date(value);
  }
  // Fallback: return current date to avoid Firestore crash
  console.warn('toFirestoreDate received invalid value:', value);
  return new Date();
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', msg);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // Idempotency: atomic check-and-set via Firestore transaction
    const eventRef = adminDb.collection('stripeEvents').doc(event.id);
    const alreadyProcessed = await adminDb.runTransaction(async (tx) => {
      const eventDoc = await tx.get(eventRef);
      if (eventDoc.exists) return true;
      tx.set(eventRef, { type: event.type, processedAt: new Date(), status: 'processing' });
      return false;
    });
    if (alreadyProcessed) {
      console.log(`Webhook event ${event.type} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        if (!companyId) {
          console.error('checkout.session.completed missing companyId in metadata');
          break;
        }

        // Update company with Stripe subscription info
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id: string })?.id;
          const sub = await stripe.subscriptions.retrieve(subId as string);

          // Toda subscription nova carrega metadata.module. Sem ele, ignoramos.
          const modInfo = extractModuleFromSubscriptionMetadata(sub.metadata);
          if (!modInfo) {
            console.warn('checkout.session.completed sem metadata.module — ignorando');
            break;
          }

          await handleModuleCheckoutCompleted({
            companyId: modInfo.companyId,
            moduleKey: modInfo.module,
            subscription: sub,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subUpdated = event.data.object as Stripe.Subscription;
        const modInfoUpd = extractModuleFromSubscriptionMetadata(subUpdated.metadata);
        if (!modInfoUpd) {
          console.warn('customer.subscription.updated sem metadata.module — ignorando');
          break;
        }
        await handleModuleSubscriptionUpdated({
          companyId: modInfoUpd.companyId,
          moduleKey: modInfoUpd.module,
          subscription: subUpdated,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subDeleted = event.data.object as Stripe.Subscription;
        const modInfoDel = extractModuleFromSubscriptionMetadata(subDeleted.metadata);
        if (!modInfoDel) {
          console.warn('customer.subscription.deleted sem metadata.module — ignorando');
          break;
        }
        await handleModuleSubscriptionDeleted({
          companyId: modInfoDel.companyId,
          moduleKey: modInfoDel.module,
        });
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const failedSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!failedSubId) break;

        const failedSub = await stripe.subscriptions.retrieve(failedSubId);
        const modInfoFailed = extractModuleFromSubscriptionMetadata(failedSub.metadata);
        if (!modInfoFailed) {
          console.warn('invoice.payment_failed sem metadata.module — ignorando');
          break;
        }
        await handleModulePaymentFailed({
          companyId: modInfoFailed.companyId,
          moduleKey: modInfoFailed.module,
        });
        break;
      }

      case 'invoice.paid': {
        // Quando a 1a fatura do Platform e paga e a empresa esta marcada como
        // beta tester pelo master, setamos betaStartsAt = invoice.created e
        // calculamos betaEndsAt. Idempotente: guard `if (betaStartsAt) break`
        // garante que faturas subsequentes nao reiniciam o beta.
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string };
          created: number;
        };
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const modInfo = extractModuleFromSubscriptionMetadata(sub.metadata);
        // Apenas o modulo Platform aciona o ciclo do beta tester.
        if (!modInfo || modInfo.module !== 'platform') break;

        const companyRef = adminDb.collection('companies').doc(modInfo.companyId);
        const snap = await companyRef.get();
        const billing = snap.data()?.billing as CompanyBillingBlock | undefined;
        if (!billing) break;
        if (billing.isBetaTester !== true) break;
        // Guard de idempotencia: se beta ja comecou, nao toca.
        if (billing.betaStartsAt) break;

        const durationMonths = billing.betaDurationMonths ?? DEFAULT_BETA_DURATION_MONTHS;
        const startsAt = new Date(invoice.created * 1000);
        const endsAt = computeBetaEndDate(startsAt, durationMonths);

        await companyRef.update({
          'billing.betaStartsAt': Timestamp.fromDate(startsAt),
          'billing.betaEndsAt': Timestamp.fromDate(endsAt),
          'billing.updatedAt': FieldValue.serverTimestamp(),
        });
        console.log(`Beta tester iniciado (${durationMonths} meses)`);
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    // Mark event as successfully processed
    await eventRef.update({ status: 'completed', completedAt: new Date() });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Mark event as failed so it can be retried
    try {
      const eventRef = adminDb.collection('stripeEvents').doc(event.id);
      await eventRef.update({ status: 'failed', error: String(error), failedAt: new Date() });
    } catch { /* ignore cleanup errors */ }
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

