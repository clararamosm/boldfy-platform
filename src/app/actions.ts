
'use server';

import { alignContent } from '@/ai/flows/align-content';
import { z } from 'zod';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

// Mock database call to get company profile
async function getCompanyProfile(companyId: string): Promise<string> {
  // In a real application, this would fetch data from Firestore.
  // For this example, we'll return a mock profile based on the ID.
  console.log(`Fetching profile for company: ${companyId}`);
  const companyDocRef = doc(db, "companies", companyId);
  const companyDocSnap = await getDoc(companyDocRef);

  if (companyDocSnap.exists()) {
      const data = companyDocSnap.data();
      const branding = data.branding;
      if (branding) {
        return `
            Company Name: ${data.companyName || 'N/A'}
            Tagline: ${branding.tagline || 'N/A'}
            Target Audience: ${branding.audience || 'N/A'}
            Tone of Voice: ${branding.tone || 'N/A'}
            Key Messages: ${branding.messages || 'N/A'}
        `;
      }
  }

  // Fallback mock profile
  throw new Error('Perfil da empresa não encontrado ou incompleto.');
}

// Fetches the influencer's personal branding from Firestore.
async function getPersonalBranding(userId: string): Promise<string> {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        const branding = data.personalBranding;
        if (branding) {
            return `
                Tone of Voice: ${branding.voice || 'N/A'}
                Expertise: ${branding.expertise || 'N/A'}
                Value Proposition: ${branding.value || 'N/A'}
                Current Position: ${branding.position || 'N/A'}
            `;
        }
    }
    
    // Fallback profile if no data is found
    return `
        Tone of Voice: Amigável e Inspirador.
        Expertise: Marketing Digital, Vendas, Liderança.
        Value Proposition: Ofereço dicas práticas e insights do mundo real para ajudar outros profissionais a crescerem.
        Current Position: Gerente de Marketing.
    `;
}


const AlignContentActionSchema = z.object({
  content: z.string().min(1, { message: 'O conteúdo não pode estar vazio.' }),
  companyId: z.string(),
  userId: z.string(), // Added userId to the schema
  format: z.enum(['linkedin', 'text-heavy', 'hybrid']),
  length: z.enum(['short', 'medium', 'long']),
});

type AlignContentState = {
  alignedContent?: string | null;
  error?: string | null;
};

export async function handleAlignContent(
  prevState: AlignContentState,
  formData: FormData
): Promise<AlignContentState> {
  try {
    const validatedData = AlignContentActionSchema.safeParse({
      content: formData.get('content'),
      companyId: formData.get('companyId'),
      userId: formData.get('userId'), // Get userId from formData
      format: formData.get('format'),
      length: formData.get('length'),
    });

    if (!validatedData.success) {
      return { error: validatedData.error.errors.map((e) => e.message).join(', ') };
    }

    const { content, companyId, userId, format, length } = validatedData.data;

    const companyProfile = await getCompanyProfile(companyId);
    const personalBranding = await getPersonalBranding(userId); // Pass the dynamic user ID

    const result = await alignContent({ 
        content, 
        companyProfile,
        personalBranding,
        format,
        length
    });

    return { alignedContent: result.alignedContent, error: null };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}

// --- Stripe Checkout Action ---

const CreateCheckoutSessionSchema = z.object({
  companyName: z.string(),
  adminName: z.string(),
  adminEmail: z.string().email(),
  licenses: z.coerce.number().int().positive(),
  priceId: z.string(), // e.g., price_1PJU0dRx1EDs2Xy7nopfo123
});

type CheckoutState = {
    sessionId?: string;
    error?: string;
}

export async function createCheckoutSession(prevState: CheckoutState, formData: FormData): Promise<CheckoutState> {
    const validatedData = CreateCheckoutSessionSchema.safeParse({
        companyName: formData.get('companyName'),
        adminName: formData.get('adminName'),
        adminEmail: formData.get('adminEmail'),
        licenses: formData.get('licenses'),
        priceId: process.env.STRIPE_PRICE_ID, // Using environment variable for price ID
    });

    if(!validatedData.success) {
        return { error: validatedData.error.errors.map(e => e.message).join(', ') };
    }

    const { companyName, adminName, adminEmail, licenses, priceId } = validatedData.data;
    const origin = headers().get('origin');
    
    try {
        // Create a pre-company document in Firestore to hold the data temporarily
        // A webhook handler would later update this to 'active' and create the admin user.
        const pendingCompanyRef = await addDoc(collection(db, "companies"), {
            companyName,
            adminProfile: {
                name: adminName,
                email: adminEmail,
            },
            licenses,
            status: 'pending_payment' as const,
            createdAt: serverTimestamp(),
            stripeCustomerId: null,
            stripeSubscriptionId: null,
        });

        // Create a Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: licenses,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/master/empresas?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/master/empresas?payment_canceled=true`,
            metadata: {
                // Pass the ID of the Firestore document to the webhook handler
                companyId: pendingCompanyRef.id,
            }
        });

        if (!session.id) {
            throw new Error("Could not create Stripe session.");
        }

        return { sessionId: session.id };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { error: `Erro ao criar checkout: ${errorMessage}` };
    }
}
