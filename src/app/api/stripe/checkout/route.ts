// src/app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout Session for company subscription.
// Beta flow: 5 months at beta price (30% off), then auto-switch to full price.
// The transition is handled by creating a Subscription Schedule after checkout.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { getStripe, getTierForSeats } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    // Authenticate: only admins/masters can start checkout
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }
    const userData = userDoc.data();
    if (!userData?.role || !['admin', 'master'].includes(userData.role)) {
      return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });
    }

    const companyId = userData.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const body = await req.json();
    const { seats } = body as { seats: number };

    if (!seats || seats < 5 || seats > 70) {
      return NextResponse.json({ error: 'Seats must be between 5 and 70' }, { status: 400 });
    }

    const tier = getTierForSeats(seats);
    if (!tier) {
      return NextResponse.json({ error: 'No pricing tier found for this seat count' }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Get or create Stripe customer for this company
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data();

    // GUARD: prevent duplicate subscriptions
    const existingSub = companyData?.subscription;
    if (existingSub?.stripeSubscriptionId && existingSub?.status === 'active') {
      return NextResponse.json(
        { error: 'Company already has an active subscription. Use the portal to manage it.' },
        { status: 409 }
      );
    }

    // SERVER decides if beta — not the client. Beta period is defined by env var or hardcoded cutoff.
    const BETA_CUTOFF = process.env.BETA_CUTOFF_DATE
      ? new Date(process.env.BETA_CUTOFF_DATE)
      : new Date('2026-12-31'); // Default: beta available until end of 2026
    const isBeta = new Date() < BETA_CUTOFF;

    const pricePerSeat = isBeta ? tier.betaPricePerSeatCents : tier.pricePerSeatCents;

    let customerId = companyData?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: companyData?.companyName || 'Boldfy Company',
        email: userData.profile?.email || userData.email,
        metadata: { companyId, firebaseUid: uid },
      });
      customerId = customer.id;
      await adminDb.collection('companies').doc(companyId).update({ stripeCustomerId: customerId });
    }

    // Create Checkout Session (subscription mode)
    // Beta subscribers start at the discounted beta price.
    // The webhook handler will create a Subscription Schedule to
    // transition to the full price after 5 billing cycles.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Boldfy Platform — ${seats} licenças (${tier.name})`,
              description: isBeta
                ? `Beta: ${seats} colaboradores (30% off por 5 meses, depois preço normal)`
                : `Assinatura mensal: ${seats} colaboradores`,
            },
            unit_amount: pricePerSeat,
            recurring: { interval: 'month' },
          },
          quantity: seats,
        },
      ],
      subscription_data: {
        metadata: {
          companyId,
          seats: String(seats),
          tier: tier.name,
          isBeta: String(!!isBeta),
          // Store full price info so webhook can schedule the transition
          fullPricePerSeatCents: String(tier.pricePerSeatCents),
          betaPricePerSeatCents: String(tier.betaPricePerSeatCents),
        },
      },
      success_url: `${baseUrl}/admin/configuracoes?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/admin/configuracoes?checkout=cancelled`,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      metadata: { companyId, firebaseUid: uid },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
