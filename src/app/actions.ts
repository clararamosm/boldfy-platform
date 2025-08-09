// src/app/actions.ts
'use server';

import { alignContent } from '@/ai/flows/align-content';
import { z } from 'zod';
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { auth as adminAuth } from '@/lib/firebase-admin';

// --- AI Content Alignment Action ---

async function getCompanyProfile(companyId: string): Promise<string> {
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
  throw new Error('Perfil da empresa não encontrado ou incompleto.');
}

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
  userId: z.string(),
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
      userId: formData.get('userId'),
      format: formData.get('format'),
      length: formData.get('length'),
    });

    if (!validatedData.success) {
      return { error: validatedData.error.errors.map((e) => e.message).join(', ') };
    }

    const { content, companyId, userId, format, length } = validatedData.data;
    const companyProfile = await getCompanyProfile(companyId);
    const personalBranding = await getPersonalBranding(userId);

    const result = await alignContent({ 
        content, 
        companyProfile,
        personalBranding,
        format,
        length
    });

    return { alignedContent: result.alignedContent, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}

// --- Company & Admin Onboarding Action (by Master) ---

const InviteAdminSchema = z.object({
  companyName: z.string().min(1, 'Nome da empresa é obrigatório.'),
  adminName: z.string().min(1, 'Nome do admin é obrigatório.'),
  adminEmail: z.string().email('E-mail inválido.'),
  licenses: z.coerce.number().int().positive('Número de licenças deve ser positivo.'),
});

type InviteAdminState = {
    success?: boolean;
    error?: string;
};

export async function inviteAdmin(prevState: InviteAdminState, formData: FormData): Promise<InviteAdminState> {
    if (!adminAuth) {
        return { error: "O serviço de autenticação do administrador não está disponível. Verifique a configuração do servidor." };
    }

    const validatedData = InviteAdminSchema.safeParse({
        companyName: formData.get('companyName'),
        adminName: formData.get('adminName'),
        adminEmail: formData.get('adminEmail'),
        licenses: formData.get('licenses'),
    });

    if (!validatedData.success) {
        return { error: validatedData.error.errors.map(e => e.message).join(', ') };
    }
    
    const { companyName, adminName, adminEmail, licenses } = validatedData.data;

    try {
        const companyRef = doc(collection(db, "companies"));
        const companyId = companyRef.id;

        // 1. Create Auth user (will be passwordless initially, admin will set password)
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({
                email: adminEmail,
                emailVerified: false,
                displayName: adminName,
                disabled: false,
            });
            // TODO: In a real app, send a password reset email here.
            // await adminAuth.generatePasswordResetLink(adminEmail);
        } catch (error: any) {
             if (error.code === 'auth/email-already-exists') {
                return { error: `Um usuário com o e-mail ${adminEmail} já existe.` };
            }
            throw error;
        }

        // 2. Create Company document with 'Inativa' status
        await setDoc(companyRef, {
            companyName,
            adminProfile: { name: adminName, email: adminEmail },
            licenses,
            status: 'Inativa' as const,
            createdAt: serverTimestamp(),
            stripeCustomerId: null,
            stripeSubscriptionId: null,
        });

        // 3. Create User document
        const userDocRef = doc(db, "users", userRecord.uid);
        await setDoc(userDocRef, {
            role: 'admin',
            companyId: companyId,
            companyName: companyName,
            points: 0,
            status: 'Pendente' as const,
            profile: { name: adminName, email: adminEmail },
            createdAt: serverTimestamp(),
        });

        console.log(`Empresa "${companyName}" e Admin "${adminEmail}" criados com status inativo.`);
        return { success: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { error: `Erro ao criar empresa: ${errorMessage}` };
    }
}


// --- Stripe Checkout Action (by Company Admin) ---

const CreateCheckoutSessionSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  adminEmail: z.string().email(),
  licenses: z.coerce.number().int().positive(),
  adminName: z.string()
});

type CheckoutState = {
    sessionId?: string;
    error?: string;
}

export async function createCheckoutSession(prevState: CheckoutState, formData: FormData): Promise<CheckoutState> {
    const validatedData = CreateCheckoutSessionSchema.safeParse({
        companyId: formData.get('companyId'),
        companyName: formData.get('companyName'),
        adminEmail: formData.get('adminEmail'),
        licenses: formData.get('licenses'),
        adminName: formData.get('adminName')
    });

    if(!validatedData.success) {
        return { error: validatedData.error.errors.map(e => e.message).join(', ') };
    }
    
    if (!process.env.STRIPE_PRICE_ID) {
        return { error: 'A variável de ambiente STRIPE_PRICE_ID não está configurada.' };
    }

    const { companyId, companyName, adminEmail, licenses, adminName } = validatedData.data;
    const origin = headers().get('origin');
    
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: licenses,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/admin/configuracoes?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/admin/configuracoes?payment_canceled=true`,
            metadata: {
                companyId: companyId,
                companyName,
                adminEmail,
                adminName,
                licenses: licenses.toString()
            },
            customer_email: adminEmail
        });

        if (!session.id) {
            throw new Error("Could not create Stripe session.");
        }

        return { sessionId: session.id };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { error: `Erro ao criar checkout: ${errorMessage}` };
    }
}
