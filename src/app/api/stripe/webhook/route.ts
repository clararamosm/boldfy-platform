// src/app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase-admin'; // Use server-side admin SDK
import { auth as adminAuth } from 'firebase-admin';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { companyId, adminEmail, adminName, licenses } = session.metadata || {};

    if (!companyId || !adminEmail || !adminName || !licenses) {
        console.error("Webhook Error: Metadata is missing required fields.", session.metadata);
        return;
    }

    const companyRef = db.collection('companies').doc(companyId);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) {
        console.error(`Webhook Error: Company with ID ${companyId} not found.`);
        return;
    }

    const companyData = companySnap.data();
    // Prevent processing the same event twice
    if (companyData?.status === 'Ativa') {
        console.log(`Webhook Info: Company ${companyId} is already active. Ignoring event.`);
        return;
    }
    
    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
       const userRecord = await adminAuth.getUserByEmail(adminEmail);
       if (!userRecord) {
           throw new Error(`User with email ${adminEmail} not found in Firebase Auth.`);
       }

        const userRef = db.collection('users').doc(userRecord.uid);

        // 1. Update User status to 'Ativo'
        transaction.update(userRef, {
            status: 'Ativo' as const,
        });
        
        // 2. Update company status to 'Ativa'
        transaction.update(companyRef, {
            status: 'Ativa' as const,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            activatedAt: new Date().toISOString()
        });
    });

    console.log(`Successfully activated company ${companyId} for admin ${adminEmail}`);

    // Here you would typically send a welcome email to the admin
    // confirming their account is now active.
}


export async function POST(req: NextRequest) {
    const buf = await req.text();
    const sig = headers().get('stripe-signature')!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Error message: ${errorMessage}`);
        return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
    }

    console.log('✅ Stripe Webhook Received:', event.type);

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
        // ... handle other event types
        default:
            console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
}
