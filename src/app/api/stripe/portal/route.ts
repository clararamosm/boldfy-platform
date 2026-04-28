// src/app/api/stripe/portal/route.ts
// Creates a Stripe Customer Portal session for subscription management.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
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
    const userData = userDoc.data();
    if (!userData?.role || !['admin', 'master'].includes(userData.role)) {
      return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });
    }

    const companyId = userData.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    const stripeCustomerId = companyDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found. Start a subscription first.' }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/admin/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
