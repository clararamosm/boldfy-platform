// src/app/actions.ts
'use server';

import { alignContent } from '@/ai/flows/align-content';
import { z } from 'zod';
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  licenses: z.coerce.number().int().min(1, 'O número de licenças deve ser no mínimo 1.').positive('Número de licenças deve ser positivo.'),
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

        // 1. Create Auth user (will be passwordless initially, admin will set password via link)
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({
                email: adminEmail,
                emailVerified: false,
                displayName: adminName,
                disabled: false,
            });
        } catch (error: any) {
             if (error.code === 'auth/email-already-exists') {
                return { error: `Um usuário com o e-mail ${adminEmail} já existe.` };
            }
            throw error;
        }

        // 2. Create Company document with 'Trial' status and trial end date
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);

        await setDoc(companyRef, {
            companyName,
            adminProfile: { name: adminName, email: adminEmail },
            licenses,
            status: 'Trial' as const,
            createdAt: serverTimestamp(),
            trialEndsAt: trialEndDate.toISOString(),
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
            status: 'Pendente' as const, // Admin starts as pending until they login/set password
            profile: { name: adminName, email: adminEmail },
            createdAt: serverTimestamp(),
        });
        
        // Optional: Send a password reset email to the admin so they can set their password.
        // await adminAuth.generatePasswordResetLink(adminEmail);
        
        console.log(`Empresa "${companyName}" criada em modo Trial. Admin: "${adminEmail}".`);
        return { success: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        console.error("Error in inviteAdmin:", errorMessage);
        return { error: `Erro ao criar empresa: ${errorMessage}` };
    }
}

// --- Invite Collaborator Action (by Company Admin) ---

const InviteCollaboratorSchema = z.object({
  name: z.string().min(1, 'Nome do colaborador é obrigatório.'),
  email: z.string().email('E-mail inválido.'),
  companyId: z.string().min(1, 'ID da empresa é obrigatório.')
});

type InviteCollaboratorState = {
    success?: boolean;
    error?: string;
};

export async function inviteCollaborator(prevState: InviteCollaboratorState, formData: FormData): Promise<InviteCollaboratorState> {
    if (!adminAuth) {
        return { error: "O serviço de autenticação do administrador não está disponível." };
    }

    const validatedData = InviteCollaboratorSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        companyId: formData.get('companyId'),
    });

    if (!validatedData.success) {
        return { error: validatedData.error.errors.map(e => e.message).join(', ') };
    }
    
    const { name, email, companyId } = validatedData.data;

    try {
        // 1. Create Auth user
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({
                email,
                emailVerified: false,
                displayName: name,
                disabled: false,
            });
        } catch (error: any) {
             if (error.code === 'auth/email-already-exists') {
                return { error: `Um usuário com o e-mail ${email} já existe.` };
            }
            throw error;
        }

        // 2. Create User document in Firestore
        const companyDocSnap = await getDoc(doc(db, "companies", companyId));
        if (!companyDocSnap.exists()) {
            throw new Error("Empresa não encontrada.");
        }

        const userDocRef = doc(db, "users", userRecord.uid);
        await setDoc(userDocRef, {
            role: 'influencer',
            companyId: companyId,
            companyName: companyDocSnap.data()?.companyName || '',
            points: 0,
            status: 'Pendente' as const, // User is pending until they set a password
            profile: { name, email },
            createdAt: serverTimestamp(),
        });
        
        // You would typically send a password reset/invitation email here
        // await adminAuth.generatePasswordResetLink(email);

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        console.error("Error in inviteCollaborator:", errorMessage);
        return { error: `Erro ao convidar colaborador: ${errorMessage}` };
    }
}
