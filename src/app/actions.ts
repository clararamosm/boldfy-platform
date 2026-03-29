// src/app/actions.ts
'use server';

import { z } from 'zod';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ---- AI Content Alignment Action ----

async function getCompanyProfile(companyId: string): Promise<string> {
  const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();

  if (companyDocSnap.exists) {
    const data = companyDocSnap.data();
    const branding = data?.branding;
    if (branding) {
      return `
        Company Name: ${data?.companyName || 'N/A'}
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
  const userDocSnap = await adminDb.collection("users").doc(userId).get();

  if (userDocSnap.exists) {
    const data = userDocSnap.data();
    const personalBranding = data?.personalBranding;
    if (personalBranding) {
      return `
        Voice Style: ${personalBranding.voice || 'N/A'}
        Areas of Expertise: ${personalBranding.expertise || 'N/A'}
        Value Proposition: ${personalBranding.valueProposition || 'N/A'}
        Current Position: ${personalBranding.position || 'N/A'}
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
      return { error: validatedData.error.errors.map(e => e.message).join(', '), alignedContent: null };
    }

    const { content, companyId, userId, format, length } = validatedData.data;

    const companyProfile = await getCompanyProfile(companyId);
    const personalBranding = await getPersonalBranding(userId);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        companyProfile,
        personalBranding,
        format,
        length,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao gerar conteúdo alinhado.');
    }

    const data = await response.json();
    return { alignedContent: data.alignedContent, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}

// ---- Company & Admin Onboarding Action (by Master) ----

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
    // 1. Create Company document in Firestore
    const companyRef = await adminDb.collection("companies").add({
      companyName: companyName,
      branding: { tagline: '', audience: '', tone: '', messages: '' },
      subscription: {
        plan: 'trial',
        status: 'trialing',
        totalLicenses: licenses,
        usedLicenses: 1,
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    const companyId = companyRef.id;

    // 2. Create Admin user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: adminEmail,
      displayName: adminName,
      password: Math.random().toString(36).slice(-12) + 'A1!',
    });

    // 3. Create User document in Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'admin',
      companyId: companyId,
      companyName: companyName,
      points: 0,
      profile: { name: adminName, email: adminEmail },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    if ((error as any)?.code === 'auth/email-already-exists') {
      return { error: `Um usuário com o e-mail ${adminEmail} já existe.` };
    }
    console.error("Error in inviteAdmin:", errorMessage);
    return { error: `Erro ao criar empresa e admin: ${errorMessage}` };
  }
}

// ---- Invite Collaborator Action (by Admin) ----

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
    const userRecord = await adminAuth.createUser({
      email: email,
      displayName: name,
      password: Math.random().toString(36).slice(-12) + 'A1!',
    });

    // Handle email already exists
    if ((userRecord as any)?.code === 'auth/email-already-exists') {
      return { error: `Um usuário com o e-mail ${email} já existe.` };
    }

    // 2. Create User document in Firestore
    const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDocSnap.exists) {
      throw new Error("Empresa não encontrada.");
    }

    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'colaborador',
      companyId: companyId,
      companyName: companyDocSnap.data()?.companyName || '',
      points: 0,
      status: 'Pendente' as const,
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
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
