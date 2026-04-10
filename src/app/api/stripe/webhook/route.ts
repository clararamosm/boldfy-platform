// src/app/api/stripe/webhook/route.ts
// Stripe webhook handler — updates company subscription status in Firestore.
// IMPORTANT: This route must NOT use bodyParser. We need the raw body for signature verification.
import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

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
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        if (!companyId) break;

        // Update company with Stripe subscription info
        if (session.subscription) {
          const subResponse = await stripe.subscriptions.retrieve(session.subscription as string);
          // Stripe SDK v2+ wraps in Response — extract the actual object
          const sub = ('data' in subResponse ? subResponse.data : subResponse) as Stripe.Subscription;
          const seats = parseInt(sub.metadata.seats || '0', 10);
          const tier = sub.metadata.tier || '';
          const isBeta = sub.metadata.isBeta === 'true';

          await adminDb.collection('companies').doc(companyId).update({
            'subscription.plan': isBeta ? 'beta' : 'paid',
            'subscription.status': 'active',
            'subscription.stripeSubscriptionId': sub.id,
            'subscription.totalLicenses': seats,
            'subscription.tier': tier,
            'subscription.currentPeriodEnd': new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
            'subscription.cancelAtPeriodEnd': (sub as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subUpdated = event.data.object as any;
        const companyIdUpd = subUpdated.metadata?.companyId;
        if (!companyIdUpd) break;

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
          'subscription.status': statusMap[subUpdated.status] || subUpdated.status,
          'subscription.currentPeriodEnd': new Date(subUpdated.current_period_end * 1000),
          'subscription.cancelAtPeriodEnd': subUpdated.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subDeleted = event.data.object as any;
        const companyIdDel = subDeleted.metadata?.companyId;
        if (!companyIdDel) break;

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
          const subResponse = await stripe.subscriptions.retrieve(failedSubId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const failedSub = ('data' in subResponse ? subResponse.data : subResponse) as any;
          const companyIdFailed = failedSub.metadata?.companyId;
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

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
