// src/app/actions/users.ts
'use server';

import { z } from 'zod';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireMaster, requireAdmin, requireAdminOrStrategist } from '@/lib/auth-guard';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { generateSlug } from '@/lib/slugify';

// ---- Email Invitation Helper ----

async function sendInvitationEmail({ to, name, companyName, role, resetLink, locale = 'pt-BR' }: {
  to: string;
  name: string;
  companyName: string;
  role: string;
  resetLink: string;
  locale?: 'pt-BR' | 'en';
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';

  const isEN = locale === 'en';

  const subject = isEN
    ? `You've been invited to ${companyName} on Boldfy!`
    : `Você foi convidado para a ${companyName} na Boldfy!`;

  const subtitle = isEN
    ? 'Employee Gamification Platform'
    : 'Plataforma de Gamificação para Colaboradores';

  const greeting = isEN ? `Hi, ${name}!` : `Olá, ${name}!`;

  const inviteText = isEN
    ? `You've been invited as <strong>${role}</strong> at <strong>${companyName}</strong> on the Boldfy platform.`
    : `Você foi convidado como <strong>${role}</strong> na empresa <strong>${companyName}</strong> na plataforma Boldfy.`;

  const ctaText = isEN
    ? 'To get started, click the button below to set your password and access your account:'
    : 'Para começar, clique no botão abaixo para criar sua senha e acessar sua conta:';

  const buttonText = isEN ? 'Set My Password & Sign In' : 'Criar Minha Senha e Acessar';

  const afterLabel = isEN ? '<strong>After setting your password:</strong>' : '<strong>Depois de criar sua senha:</strong>';
  const afterText = isEN
    ? `Access the platform at <a href="${appUrl}/login" style="color: #bd58e7;">${appUrl}/login</a> and sign in with your email and the password you just created.`
    : `Acesse a plataforma em <a href="${appUrl}/login" style="color: #bd58e7;">${appUrl}/login</a> e faça login com seu e-mail e a senha que acabou de criar.`;

  const footer = isEN
    ? 'If you were not expecting this invitation, you can safely ignore this email.'
    : 'Se você não esperava este convite, pode ignorar este e-mail com segurança.';

  await transporter.sendMail({
    from: `"Boldfy" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">Boldfy</h1>
        <p style="color: #6B7280; margin-top: 5px;">${subtitle}</p>
      </div>
      <h2 style="color: #1F2937;">${greeting}</h2>
      <p style="color: #4B5563; line-height: 1.6;">${inviteText}</p>
      <p style="color: #4B5563; line-height: 1.6;">${ctaText}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          ${buttonText}
        </a>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 20px; padding: 15px; background-color: #f3e8ff; border-radius: 8px;">
        ${afterLabel}<br/>${afterText}
      </p>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">${footer}</p>
    </div>
    `,
  });
}

// ---- Company & Admin Onboarding Action (by Master) ----

const InviteAdminSchema = z.object({
  companyName: z.string().min(1, 'Nome da empresa é obrigatório.'),
  adminName: z.string().optional().default(''),
  adminEmail: z.string().optional().default(''),
  licenses: z.coerce.number().int().min(5, 'O número de licenças deve ser no mínimo 5.').positive('Número de licenças deve ser positivo.'),
  tlLicenses: z.coerce.number().int().min(0).default(0),
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
  skipInvite: z.string().optional(),
});

type InviteAdminState = {
  success?: boolean;
  error?: string;
};

export async function inviteAdmin(prevState: InviteAdminState, formData: FormData): Promise<InviteAdminState> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação do administrador não está disponível. Verifique a configuração do servidor." };
  }

  // Verificar que quem chama e master
  const idToken = formData.get('idToken') as string;
  if (!idToken) return { error: 'Token de autenticacao ausente.' };
  try { await requireMaster(idToken); } catch (e: unknown) { return { error: e instanceof Error ? e.message : 'Erro de autenticação.' }; }

  const validatedData = InviteAdminSchema.safeParse({
    companyName: formData.get('companyName'),
    adminName: formData.get('adminName') || '',
    adminEmail: formData.get('adminEmail') || '',
    licenses: formData.get('licenses'),
    tlLicenses: formData.get('tlLicenses') || 0,
    locale: formData.get('locale') || 'pt-BR',
    skipInvite: formData.get('skipInvite') || undefined,
  });

  if (!validatedData.success) {
    return { error: validatedData.error.errors.map(e => e.message).join(', ') };
  }

  const { companyName, adminName, adminEmail, licenses, tlLicenses, locale, skipInvite: skipInviteVal } = validatedData.data;
  const skipInvite = skipInviteVal === 'true';

  // When NOT skipping invite, admin name and email are required
  if (!skipInvite) {
    if (!adminName) return { error: 'Nome do admin é obrigatório.' };
    if (!adminEmail || !z.string().email().safeParse(adminEmail).success) return { error: 'E-mail do admin inválido.' };
  }

  try {
    const companyRef = await adminDb.collection("companies").add({
      companyName: companyName,
      status: 'Ativa',
      licenses: licenses,
      tlLicenses: tlLicenses,
      locale: locale,
      adminProfile: adminEmail ? { email: adminEmail, name: adminName } : { email: '', name: '' },
      brandContext: { valueProposition: '', tagline: '', businessKeywords: [], solutions: [], targetPainPoints: [], targetAudience: '', approvedTopics: [], prohibitedPhrases: [] },
      subscription: {
        plan: 'trial',
        status: 'trialing',
        totalLicenses: licenses,
        usedLicenses: 0,
        trialEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month free trial (beta)
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    const companyId = companyRef.id;

    // Generate and save slug for clean URLs
    const companySlug = generateSlug(companyName, companyId);
    await companyRef.update({ slug: companySlug });

    // Seed default AI credits reward for the new company
    await adminDb.collection('companies').doc(companyId).collection('rewards').add({
      name: '5 Creditos de IA',
      points: 200,
      type: 'ai_credits',
      creditsAmount: 5,
      stock: 'Ilimitado',
      status: 'Disponível',
      imageUrl: null,
      isDefault: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    // When skipInvite is set, only create the company (no admin user yet)
    if (skipInvite) {
      return { success: true };
    }

    const userRecord = await adminAuth.createUser({
      email: adminEmail,
      displayName: adminName,
      password: crypto.randomBytes(16).toString('base64url') + 'A1!',
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'admin',
      name: adminName,
      companyId: companyId,
      companyName: companyName,
      points: 0,
      profile: { name: adminName, email: adminEmail },
      createdAt: FieldValue.serverTimestamp(),
    });

    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(adminEmail, { url: loginUrl });
    sendInvitationEmail({
      to: adminEmail,
      name: adminName,
      companyName: companyName,
      role: locale === 'en' ? 'Administrator' : 'Administrador',
      resetLink,
      locale,
    }).catch((emailError) => {
      console.error("Error sending admin invitation email:", emailError);
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    if ((error as { code?: string })?.code === 'auth/email-already-exists') {
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

  // Verificar que quem chama e admin da empresa
  const idToken = formData.get('idToken') as string;
  const formCompanyId = formData.get('companyId') as string;
  if (!idToken) return { error: 'Token de autenticacao ausente.' };
  try { await requireAdmin(idToken, formCompanyId); } catch (e: unknown) { return { error: e instanceof Error ? e.message : 'Erro de autenticação.' }; }

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
    const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDocSnap.exists) {
      throw new Error("Empresa não encontrada.");
    }
    const companyData = companyDocSnap.data();
    const companyName = companyData?.companyName || '';
    const companyLocale = (companyData?.locale as 'pt-BR' | 'en') || 'pt-BR';

    const currentLicenses = companyData?.licenses || 0;
    const usersQuery = await adminDb.collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "colaborador")
      .get();

    if (usersQuery.size >= currentLicenses) {
      return { error: `Limite de licenças atingido (${currentLicenses}). Não é possível convidar mais colaboradores.` };
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: email,
        displayName: name,
        password: crypto.randomBytes(16).toString('base64url') + 'A1!',
      });
    } catch (authError: unknown) {
      if ((authError as { code?: string })?.code === 'auth/email-already-exists') {
        return { error: `Um usuário com o e-mail ${email} já existe.` };
      }
      throw authError;
    }

    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'colaborador',
      name: name,
      companyId: companyId,
      companyName: companyName,
      points: 0,
      status: 'Pendente',
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
    });

    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });
    sendInvitationEmail({
      to: email,
      name: name,
      companyName: companyName,
      role: companyLocale === 'en' ? 'Collaborator' : 'Colaborador',
      resetLink,
      locale: companyLocale,
    }).catch((emailError) => {
      console.error("Error sending collaborator invitation email:", emailError);
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("Error in inviteCollaborator:", errorMessage);
    return { error: `Erro ao convidar colaborador: ${errorMessage}` };
  }
}

// ---- Delete Collaborator Action (by Admin) ----

export async function deleteCollaborator(idToken: string, userId: string): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }
  try {
    // Verificar que quem chama e admin da mesma empresa do colaborador
    const targetDoc = await adminDb.collection('users').doc(userId).get();
    if (!targetDoc.exists) return { error: 'Colaborador nao encontrado.' };
    const targetData = targetDoc.data();
    if (!targetData?.companyId) return { error: 'Colaborador sem empresa associada.' };
    await requireAdmin(idToken, targetData.companyId);
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: unknown) {
      const authErr = authError as { code?: string; message?: string };
      if (authErr?.code !== 'auth/user-not-found') {
        console.error(`Error deleting Auth user ${userId}:`, authErr?.message);
      }
    }

    const userRef = adminDb.collection('users').doc(userId);
    const subcollections = await userRef.listCollections();
    for (const subcol of subcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }

    await userRef.delete();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in deleteCollaborator:', errorMessage);
    return { error: `Erro ao remover colaborador: ${errorMessage}` };
  }
}

// ---- Invite Strategist Action (by Master) ----

const InviteStrategistSchema = z.object({
  name: z.string().min(1, 'Nome do estrategista é obrigatório.'),
  email: z.string().email('E-mail inválido.'),
});

type InviteStrategistState = {
  success?: boolean;
  error?: string;
};

export async function inviteStrategist(prevState: InviteStrategistState, formData: FormData): Promise<InviteStrategistState> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }

  const idToken = formData.get('idToken') as string;
  if (!idToken) return { error: 'Token de autenticacao ausente.' };
  try { await requireMaster(idToken); } catch (e: unknown) { return { error: e instanceof Error ? e.message : 'Erro de autenticação.' }; }

  const validatedData = InviteStrategistSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validatedData.success) {
    return { error: validatedData.error.errors.map(e => e.message).join(', ') };
  }

  const { name, email } = validatedData.data;

  try {
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        displayName: name,
        password: crypto.randomBytes(16).toString('base64url') + 'A1!',
      });
    } catch (authError: unknown) {
      if ((authError as { code?: string })?.code === 'auth/email-already-exists') {
        return { error: `Um usuário com o e-mail ${email} já existe.` };
      }
      throw authError;
    }

    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'strategist',
      name,
      assignedCompanies: [],
      status: 'Ativo',
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
    });

    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });
    sendInvitationEmail({
      to: email,
      name,
      companyName: 'Boldfy',
      role: 'Estrategista',
      resetLink,
      locale: 'pt-BR',
    }).catch((emailError) => {
      console.error("Error sending strategist invitation email:", emailError);
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("Error in inviteStrategist:", errorMessage);
    return { error: `Erro ao convidar estrategista: ${errorMessage}` };
  }
}

// ---- Assign Companies to Strategist (by Master) ----

export async function assignCompaniesToStrategist(
  idToken: string,
  strategistId: string,
  companyIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireMaster(idToken);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro de autenticação.' };
  }

  try {
    // Update strategist's assignedCompanies
    await adminDb.collection('users').doc(strategistId).update({
      assignedCompanies: companyIds,
    });

    // Get previously assigned companies (check both old singular and new array fields)
    const prevByArray = await adminDb.collection('companies')
      .where('strategistIds', 'array-contains', strategistId).get();
    const prevBySingular = await adminDb.collection('companies')
      .where('strategistId', '==', strategistId).get();

    const prevCompanyIds = new Set<string>();
    prevByArray.docs.forEach(d => prevCompanyIds.add(d.id));
    prevBySingular.docs.forEach(d => prevCompanyIds.add(d.id));

    const batch = adminDb.batch();

    // Remove strategist from companies no longer assigned
    for (const prevId of prevCompanyIds) {
      if (!companyIds.includes(prevId)) {
        const compRef = adminDb.collection('companies').doc(prevId);
        batch.update(compRef, {
          strategistIds: FieldValue.arrayRemove(strategistId),
          strategistId: null, // clean up legacy field
        });
      }
    }

    // Add strategist to newly assigned companies
    for (const companyId of companyIds) {
      const compRef = adminDb.collection('companies').doc(companyId);
      // Migrate legacy singular field if present
      const compSnap = await compRef.get();
      const compData = compSnap.data();
      const legacySingular = compData?.strategistId;
      if (legacySingular && !compData?.strategistIds?.includes(legacySingular)) {
        // Ensure the old strategist is also in the array before adding the new one
        batch.update(compRef, {
          strategistIds: FieldValue.arrayUnion(legacySingular, strategistId),
          strategistId: null, // migrate away from singular field
        });
      } else {
        batch.update(compRef, {
          strategistIds: FieldValue.arrayUnion(strategistId),
          strategistId: null, // clean legacy field
        });
      }
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in assignCompaniesToStrategist:', errorMessage);
    return { error: `Erro ao atribuir empresas: ${errorMessage}` };
  }
}

// ---- Delete Strategist Action (by Master) ----

export async function deleteStrategist(idToken: string, strategistId: string): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }
  try {
    await requireMaster(idToken);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro de autenticação.' };
  }

  try {
    // Verify user exists and is actually a strategist
    const targetDoc = await adminDb.collection('users').doc(strategistId).get();
    if (!targetDoc.exists) return { error: 'Estrategista não encontrado.' };
    const targetData = targetDoc.data();
    if (targetData?.role !== 'strategist') return { error: 'Este usuário não é um estrategista.' };

    // Remove strategist from all companies' strategistIds arrays
    const assignedCompanies: string[] = targetData?.assignedCompanies || [];
    if (assignedCompanies.length > 0) {
      const batch = adminDb.batch();
      for (const companyId of assignedCompanies) {
        const compRef = adminDb.collection('companies').doc(companyId);
        batch.update(compRef, {
          strategistIds: FieldValue.arrayRemove(strategistId),
        });
      }
      await batch.commit();
    }

    // Also clean up any companies referencing this strategist via legacy singular field
    const legacyCompanies = await adminDb.collection('companies')
      .where('strategistId', '==', strategistId).get();
    if (!legacyCompanies.empty) {
      const batch2 = adminDb.batch();
      for (const d of legacyCompanies.docs) {
        batch2.update(d.ref, { strategistId: null });
      }
      await batch2.commit();
    }

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(strategistId);
    } catch (authError: unknown) {
      const authErr = authError as { code?: string; message?: string };
      if (authErr?.code !== 'auth/user-not-found') {
        console.error(`Error deleting Auth user ${strategistId}:`, authErr?.message);
      }
    }

    // Delete subcollections
    const userRef = adminDb.collection('users').doc(strategistId);
    const subcollections = await userRef.listCollections();
    for (const subcol of subcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }

    // Delete user document
    await userRef.delete();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in deleteStrategist:', errorMessage);
    return { error: `Erro ao remover estrategista: ${errorMessage}` };
  }
}

// ---- Invite Thought Leader Action (by Admin or Master) ----

const InviteThoughtLeaderSchema = z.object({
  name: z.string().min(1, 'Nome do Thought Leader é obrigatório.'),
  email: z.string().email('E-mail inválido.'),
  companyId: z.string().min(1, 'ID da empresa é obrigatório.')
});

type InviteThoughtLeaderState = {
  success?: boolean;
  error?: string;
};

export async function inviteThoughtLeader(prevState: InviteThoughtLeaderState, formData: FormData): Promise<InviteThoughtLeaderState> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }

  const idToken = formData.get('idToken') as string;
  const formCompanyId = formData.get('companyId') as string;
  if (!idToken) return { error: 'Token de autenticacao ausente.' };
  // Admin or Strategist of the company can invite TLs
  try { await requireAdminOrStrategist(idToken, formCompanyId); } catch (e: unknown) { return { error: e instanceof Error ? e.message : 'Erro de autenticação.' }; }

  const validatedData = InviteThoughtLeaderSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    companyId: formData.get('companyId'),
  });

  if (!validatedData.success) {
    return { error: validatedData.error.errors.map(e => e.message).join(', ') };
  }

  const { name, email, companyId } = validatedData.data;

  try {
    const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDocSnap.exists) {
      throw new Error("Empresa não encontrada.");
    }
    const companyData = companyDocSnap.data();
    const companyName = companyData?.companyName || '';
    const companyLocale = (companyData?.locale as 'pt-BR' | 'en') || 'pt-BR';

    // Check TL license limits
    const tlLicenses = companyData?.tlLicenses || 0;
    const tlUsersQuery = await adminDb.collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "thoughtleader")
      .get();

    if (tlUsersQuery.size >= tlLicenses) {
      return { error: `Limite de licenças TL atingido (${tlLicenses}). Não é possível convidar mais Thought Leaders.` };
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        displayName: name,
        password: crypto.randomBytes(16).toString('base64url') + 'A1!',
      });
    } catch (authError: unknown) {
      if ((authError as { code?: string })?.code === 'auth/email-already-exists') {
        return { error: `Um usuário com o e-mail ${email} já existe.` };
      }
      throw authError;
    }

    const tlSlug = generateSlug(name, userRecord.uid);

    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'thoughtleader',
      name,
      slug: tlSlug,
      companyId,
      companyName,
      status: 'Pendente',
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
    });

    // Skip invitation email if skipInvite flag is set (for pre-populating accounts)
    const skipInvite = formData.get('skipInvite') === 'true';
    if (!skipInvite) {
      const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
      const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });
      sendInvitationEmail({
        to: email,
        name,
        companyName,
        role: companyLocale === 'en' ? 'Thought Leader' : 'Thought Leader',
        resetLink,
        locale: companyLocale,
      }).catch((emailError) => {
        console.error("Error sending thought leader invitation email:", emailError);
      });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("Error in inviteThoughtLeader:", errorMessage);
    return { error: `Erro ao convidar Thought Leader: ${errorMessage}` };
  }
}
