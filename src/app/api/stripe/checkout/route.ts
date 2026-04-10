// src/app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout Session for company subscription.
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
    const { seats, isBeta } = body as { seats: number; isBeta?: boolean };

    if (!seats || seats < 5 || seats > 70) {
      return NextResponse.json({ error: 'Seats must be between 5 and 70' }, { status: 400 });
    }

    const tier = getTierForSeats(seats);
    if (!tier) {
      return NextResponse.json({ error: 'No pricing tier found for this seat count' }, { status: 400 });
    }

    const pricePerSeat = isBeta ? tier.betaPricePerSeatCents : tier.pricePerSeatCents;
    const totalCents = pricePerSeat * seats;

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Get or create Stripe customer for this company
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data();
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
              description: `Assinatura mensal: ${seats} colaboradores${isBeta ? ' (Beta 30% off)' : ''}`,
            },
            unit_amount: pricePerSeat,
            recurring: { interval: 'month' },
          },
          quantity: seats,
        },
      ],
      subscription_data: {
        metadata: { companyId, seats: String(seats), tier: tier.name, isBeta: String(!!isBeta) },
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
