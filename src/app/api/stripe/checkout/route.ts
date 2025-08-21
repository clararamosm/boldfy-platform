// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

const CheckoutPayloadSchema = z.object({
  companyData: z.object({
    id: z.string(),
    companyName: z.string(),
    email: z.string().email(),
    licenses: z.coerce.number().int().positive(),
    adminName: z.string(),
  }),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validatedPayload = CheckoutPayloadSchema.safeParse(body);

        if(!validatedPayload.success) {
            return NextResponse.json({ error: validatedPayload.error.errors.map(e => e.message).join(', ') }, { status: 400 });
        }
        
        if (!process.env.STRIPE_PRICE_ID) {
            return NextResponse.json({ error: 'A variável de ambiente STRIPE_PRICE_ID não está configurada.' }, { status: 500 });
        }

        const { id, companyName, email, licenses, adminName } = validatedPayload.data.companyData;
        const origin = req.headers.get('origin') || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: licenses,
                },
            ],
            mode: 'subscription',
            subscription_data: {
                trial_period_days: 30,
            },
            success_url: `${origin}/admin/configuracoes?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/admin/configuracoes?payment_canceled=true`,
            metadata: {
                companyId: id,
                companyName,
                adminEmail: email,
                adminName,
                licenses: licenses.toString()
            },
            customer_email: email
        });

        if (!session.id) {
            throw new Error("Could not create Stripe session.");
        }

        return NextResponse.json({ sessionId: session.id });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        console.error("Stripe Checkout Error:", errorMessage);
        return NextResponse.json({ error: `Erro ao criar checkout: ${errorMessage}` }, { status: 500 });
    }
}
