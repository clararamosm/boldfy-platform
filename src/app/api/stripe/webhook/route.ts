// src/app/api/stripe/webhook/route.ts
// Stripe webhook handler — updates company subscription status in Firestore.
// Handles beta→full price transition via Subscription Schedules.
// IMPORTANT: This route must NOT use bodyParser. We need the raw body for signature verification.
// Force Node.js runtime — Edge doesn't support Stripe's constructEvent (needs Buffer)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import {
  extractModuleFromSubscriptionMetadata,
  markModuleAsActive,
  markModuleAsBlocked,
  type BillingModule,
} from '@/lib/billing/stripe-modules';

const BETA_MONTHS = 5; // 5 months at beta price, then full price

// ────────────────────────────────────────────────────────────
// HANDLERS MODULARES (billing.* em vez de subscription.*)
// Executados quando a subscription tem metadata.module.
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
      console.log(`Webhook event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        if (!companyId) {
          console.error(`checkout.session.completed missing companyId in metadata. Session: ${session.id}`);
          break;
        }

        // Update company with Stripe subscription info
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id: string })?.id;
          const sub = await stripe.subscriptions.retrieve(subId as string);

          // ── Fluxo MODULAR (Fase 2): subscription tem metadata.module ──
          const modInfo = extractModuleFromSubscriptionMetadata(sub.metadata);
          if (modInfo) {
            await handleModuleCheckoutCompleted({
              companyId: modInfo.companyId,
              moduleKey: modInfo.module,
              subscription: sub,
            });
            break;
          }

          // ── Fluxo LEGADO (Fase 1-): atualiza subscription.* monolitico ──
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subLegacy = sub as any;
          const seats = parseInt(subLegacy.metadata.seats || '0', 10);
          const tier = subLegacy.metadata.tier || '';
          const isBeta = subLegacy.metadata.isBeta === 'true';
          const fullPriceCents = parseInt(subLegacy.metadata.fullPricePerSeatCents || '0', 10);

          // Calculate beta end date (5 months from now)
          const betaEndsAt = isBeta
            ? new Date(Date.now() + BETA_MONTHS * 30 * 24 * 60 * 60 * 1000)
            : null;

          const updateData: Record<string, unknown> = {
            'subscription.plan': isBeta ? 'beta' : 'paid',
            'subscription.status': 'active',
            'subscription.stripeSubscriptionId': sub.id,
            'subscription.totalLicenses': seats,
            'subscription.tier': tier,
            'subscription.isBeta': isBeta,
            'subscription.currentPeriodEnd': toFirestoreDate(subLegacy.current_period_end),
            'subscription.cancelAtPeriodEnd': subLegacy.cancel_at_period_end || false,
          };

          if (betaEndsAt) {
            updateData['subscription.betaEndsAt'] = betaEndsAt;
            updateData['subscription.fullPricePerSeatCents'] = fullPriceCents;
          }

          await adminDb.collection('companies').doc(companyId).update(updateData);

          // For beta subscriptions, create a Subscription Schedule to
          // auto-transition from beta price to full price after 5 months.
          if (isBeta && fullPriceCents > 0) {
            try {
              await createBetaToFullSchedule(stripe, sub.id, sub, seats, fullPriceCents);
              console.log(`Created beta→full schedule for company ${companyId}`);
            } catch (scheduleErr) {
              // Non-fatal: log the error. The master can manually transition.
              console.error('Failed to create beta→full schedule:', scheduleErr);
              // Still save betaEndsAt so master knows when to transition
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subUpdated = event.data.object as Stripe.Subscription;

        // ── Fluxo MODULAR (Fase 2) ──
        const modInfoUpd = extractModuleFromSubscriptionMetadata(subUpdated.metadata);
        if (modInfoUpd) {
          await handleModuleSubscriptionUpdated({
            companyId: modInfoUpd.companyId,
            moduleKey: modInfoUpd.module,
            subscription: subUpdated,
          });
          break;
        }

        // ── Fluxo LEGADO ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subUpdAny = subUpdated as any;
        const companyIdUpd = subUpdAny.metadata?.companyId;
        if (!companyIdUpd) {
          console.error(`customer.subscription.updated missing companyId in metadata. Sub: ${subUpdAny.id}`);
          break;
        }

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          unpaid: 'unpaid',
          trialing: 'trialing',
          incomplete: 'incomplete',
          incomplete_expired: 'expired',
          paused: 'paused',
        };

        await adminDb.collection('companies').doc(companyIdUpd).update({
          'subscription.status': statusMap[subUpdAny.status] || subUpdAny.status,
          'subscription.currentPeriodEnd': toFirestoreDate(subUpdAny.current_period_end),
          'subscription.cancelAtPeriodEnd': subUpdAny.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subDeleted = event.data.object as Stripe.Subscription;

        // ── Fluxo MODULAR (Fase 2) ──
        const modInfoDel = extractModuleFromSubscriptionMetadata(subDeleted.metadata);
        if (modInfoDel) {
          await handleModuleSubscriptionDeleted({
            companyId: modInfoDel.companyId,
            moduleKey: modInfoDel.module,
          });
          break;
        }

        // ── Fluxo LEGADO ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subDelAny = subDeleted as any;
        const companyIdDel = subDelAny.metadata?.companyId;
        if (!companyIdDel) {
          console.error(`customer.subscription.deleted missing companyId in metadata. Sub: ${subDelAny.id}`);
          break;
        }

        await adminDb.collection('companies').doc(companyIdDel).update({
          'subscription.status': 'canceled',
          'subscription.plan': 'canceled',
          'subscription.cancelAtPeriodEnd': false,
        });
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const failedSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        if (failedSubId) {
          const failedSub = await stripe.subscriptions.retrieve(failedSubId);

          // ── Fluxo MODULAR (Fase 2) ──
          const modInfoFailed = extractModuleFromSubscriptionMetadata(failedSub.metadata);
          if (modInfoFailed) {
            await handleModulePaymentFailed({
              companyId: modInfoFailed.companyId,
              moduleKey: modInfoFailed.module,
            });
            break;
          }

          // ── Fluxo LEGADO ──
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const failedSubAny = failedSub as any;
          const companyIdFailed = failedSubAny.metadata?.companyId;
          if (companyIdFailed) {
            await adminDb.collection('companies').doc(companyIdFailed).update({
              'subscription.status': 'past_due',
            });
          }
        }
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

// ── Beta → Full Price Schedule ─────────────────────────────────
// Creates a Stripe Subscription Schedule that keeps the current beta price
// for 5 billing periods, then transitions to the full price automatically.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createBetaToFullSchedule(
  stripe: ReturnType<typeof getStripe>,
  subscriptionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: any,
  seats: number,
  fullPriceCents: number,
) {
  // Get the current price ID from the subscription items
  const currentItem = sub.items?.data?.[0];
  if (!currentItem?.price?.id) {
    console.warn('No price found on subscription item, skipping schedule creation');
    return;
  }

  const currentPriceId = currentItem.price.id;

  // Create a recurring price for the full (non-beta) amount
  const fullPrice = await stripe.prices.create({
    currency: 'brl',
    unit_amount: fullPriceCents,
    recurring: { interval: 'month' },
    product: currentItem.price.product as string,
  });

  // Create subscription schedule from the existing subscription.
  // This wraps the subscription in a schedule with 2 phases:
  // Phase 1: Current (beta) price for 5 months
  // Phase 2: Full price ongoing
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscriptionId,
  });

  // Calculate the transition timestamp (5 months from now)
  const betaEndTimestamp = Math.floor(Date.now() / 1000) + (BETA_MONTHS * 30 * 24 * 60 * 60);

  // Update the schedule with 2 phases
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release', // After schedule ends, subscription continues normally
    phases: [
      {
        // Phase 1: Beta price (current) — lasts 5 months
        items: [{ price: currentPriceId, quantity: seats }],
        end_date: betaEndTimestamp,
        metadata: sub.metadata,
      },
      {
        // Phase 2: Full price — ongoing
        items: [{ price: fullPrice.id, quantity: seats }],
        metadata: { ...sub.metadata, isBeta: 'false' },
      },
    ],
  });
}
