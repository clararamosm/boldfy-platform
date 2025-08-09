// src/app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase-admin'; // Use server-side admin SDK
import { auth } from 'firebase-admin';

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
        // 1. Create Firebase Auth user
        let userRecord;
        try {
            userRecord = await auth().createUser({
                email: adminEmail,
                emailVerified: false, // Or true, if you want to auto-verify
                displayName: adminName,
                // You might want to generate a random password and send a password reset email
                disabled: false,
            });
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                 console.warn(`Auth user with email ${adminEmail} already exists. Attempting to link.`);
                 userRecord = await auth().getUserByEmail(adminEmail);
            } else {
                throw error; // Re-throw other errors
            }
        }
       

        // 2. Create user document in Firestore
        const userRef = db.collection('users').doc(userRecord.uid);
        transaction.set(userRef, {
            role: 'admin',
            companyId: companyId,
            companyName: companyData?.companyName,
            points: 0,
            profile: {
                name: adminName,
                email: adminEmail,
            },
            createdAt: new Date().toISOString(),
        });
        
        // 3. Update company status to 'Ativa'
        transaction.update(companyRef, {
            status: 'Ativa' as const,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            activatedAt: new Date().toISOString()
        });
    });

    console.log(`Successfully activated company ${companyId} for admin ${adminEmail}`);

    // Here you would typically send a welcome email to the admin
    // with a link to set their password.
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
