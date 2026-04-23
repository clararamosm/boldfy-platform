// src/app/actions/users.ts
'use server';

import { z } from 'zod';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireMaster, requireAdmin, requireAdminOrStrategist } from '@/lib/auth-guard';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { generateSlug } from '@/lib/slugify';
import { getDefaultBillingBlock } from '@/lib/billing/types';

// ---- Email Invitation Helper ----

// Fai sender configuration — shared with notifications.ts
const FAI_NAME = 'Fai da Boldfy';
const FAI_ROLE = 'Gerente de Educação e Sucesso do Cliente';
const FAI_EMAIL = 'admin@boldfy.com.br';

function getInviteBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';
}

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

  const appUrl = getInviteBaseUrl();
  const faiPhoto = `${appUrl}/images/email/fai-avatar.png`;
  const boldfyLogo = `${appUrl}/images/email/boldfy-logo.svg`;

  const isEN = locale === 'en';
  const firstName = name?.split(' ')[0] || name;

  const subject = isEN
    ? `You've been invited to ${companyName} on Boldfy!`
    : `Você foi convidado pra ${companyName} na Boldfy!`;

  const footer = isEN
    ? 'If you were not expecting this invitation, you can safely ignore this email.'
    : 'Se você não esperava este convite, pode ignorar este e-mail.';

  const afterNote = isEN
    ? `After that, you can always sign in at <a href="${appUrl}/login" style="color: #9333ea; text-decoration: none;">${appUrl}/login</a>.`
    : `Depois disso, é só acessar <a href="${appUrl}/login" style="color: #9333ea; text-decoration: none;">${appUrl}/login</a> sempre que quiser.`;

  const bodyContent = isEN
    ? `
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Hi, ${firstName}! 👋
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You've been invited as <strong>${role}</strong> at <strong>${companyName}</strong>
        on the Boldfy platform.
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Click below to set your password and get started:
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${resetLink}"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Set my password &amp; sign in
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6B7280; margin: 0; padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
        ${afterNote}
      </p>`
    : `
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${firstName}! 👋
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Você foi convidado como <strong>${role}</strong> na empresa
        <strong>${companyName}</strong> na plataforma Boldfy.
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Clica aqui embaixo pra criar sua senha e acessar:
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${resetLink}"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Criar minha senha e acessar
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6B7280; margin: 0; padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
        ${afterNote}
      </p>`;

  await transporter.sendMail({
    from: `"${FAI_NAME}" <${process.env.SMTP_EMAIL}>`,
    replyTo: FAI_EMAIL,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'pt-BR'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px 32px; color: #374151;">

    <!-- Body -->
    ${bodyContent}

    <!-- Signature -->
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top; padding-right: 14px;">
            <img src="${faiPhoto}" alt="Fai" width="48" height="48"
              style="border-radius: 50%; display: block;" />
          </td>
          <td style="vertical-align: top;">
            <p style="margin: 0 0 1px; font-size: 14px; font-weight: 600; color: #1F2937;">
              ${FAI_NAME}
            </p>
            <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.4;">
              ${FAI_ROLE}
            </p>
            <a href="mailto:${FAI_EMAIL}" style="font-size: 12px; color: #9333ea; text-decoration: none;">
              ${FAI_EMAIL}
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Logo -->
    <div style="margin-top: 28px; text-align: center;">
      <a href="${appUrl}" style="text-decoration: none;">
        <img src="${boldfyLogo}" alt="Boldfy" width="90" height="auto" style="display: inline-block;" />
      </a>
    </div>

    <!-- Footer -->
    <p style="margin-top: 20px; font-size: 11px; color: #9CA3AF; text-align: center; line-height: 1.5;">
      ${footer}
    </p>
  </div>
</body>
</html>
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
    // Empresa criada SEM trial automatico. Master liga billing manualmente
    // via /master/empresas/[id]/billing. Ate la, empresa esta em periodo
    // gratuito (billing.enabled = false).
    //
    // `subscription.plan = 'free'` mantem compatibilidade com o hook
    // useSubscription e auth-guard.requireActiveSubscription que serao
    // refatorados na Fase 2 para consumir `billing.*`. Ate la, 'free' nao
    // bloqueia o app (status nao esta em BLOCKED_STATUSES do hook).
    const companyRef = await adminDb.collection("companies").add({
      companyName: companyName,
      status: 'Ativa',
      licenses: licenses,
      tlLicenses: tlLicenses,
      locale: locale,
      adminProfile: adminEmail ? { email: adminEmail, name: adminName } : { email: '', name: '' },
      brandContext: { valueProposition: '', tagline: '', businessKeywords: [], solutions: [], targetPainPoints: [], targetAudience: '', approvedTopics: [], prohibitedPhrases: [] },
      subscription: {
        plan: 'free',
        status: 'active',
        totalLicenses: licenses,
        usedLicenses: 0,
        trialEnd: null,
      },
      billing: {
        ...getDefaultBillingBlock(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
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

// ---- Invite Admin to Existing Company (by Master) ----

export async function inviteAdminToCompany(
  idToken: string,
  companyId: string,
  adminName: string,
  adminEmail: string,
): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) return { error: "Serviço de autenticação indisponível." };

  try {
    await requireMaster(idToken);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro de autenticação.' };
  }

  if (!adminName || !adminEmail) return { error: 'Nome e e-mail do admin são obrigatórios.' };
  if (!z.string().email().safeParse(adminEmail).success) return { error: 'E-mail inválido.' };

  try {
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) return { error: 'Empresa não encontrada.' };
    const companyData = companyDoc.data()!;
    const companyName = companyData.companyName || '';
    const locale = (companyData.locale as 'pt-BR' | 'en') || 'pt-BR';

    // Check if admin already exists for this company
    const existingAdmin = await adminDb.collection('users')
      .where('companyId', '==', companyId)
      .where('role', '==', 'admin')
      .get();
    if (!existingAdmin.empty) return { error: 'Esta empresa já possui um admin.' };

    const userRecord = await adminAuth.createUser({
      email: adminEmail,
      displayName: adminName,
      password: crypto.randomBytes(16).toString('base64url') + 'A1!',
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      role: 'admin',
      name: adminName,
      companyId,
      companyName,
      points: 0,
      profile: { name: adminName, email: adminEmail },
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update company adminProfile
    await adminDb.collection('companies').doc(companyId).update({
      adminProfile: { email: adminEmail, name: adminName },
    });

    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(adminEmail, { url: loginUrl });
    sendInvitationEmail({
      to: adminEmail,
      name: adminName,
      companyName,
      role: locale === 'en' ? 'Administrator' : 'Administrador',
      resetLink,
      locale,
    }).catch((err) => console.error("Error sending admin invite:", err));

    return { success: true };
  } catch (error) {
    if ((error as { code?: string })?.code === 'auth/email-already-exists') {
      return { error: `Usuário com e-mail ${adminEmail} já existe.` };
    }
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in inviteAdminToCompany:', msg);
    return { error: `Erro ao convidar admin: ${msg}` };
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
  email: z.string().optional().default(''),
  companyId: z.string().min(1, 'ID da empresa é obrigatório.'),
  skipInvite: z.string().optional(),
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
    email: formData.get('email') || '',
    companyId: formData.get('companyId'),
    skipInvite: formData.get('skipInvite') || undefined,
  });

  if (!validatedData.success) {
    return { error: validatedData.error.errors.map(e => e.message).join(', ') };
  }

  const { name, email, companyId, skipInvite: skipInviteVal } = validatedData.data;
  const skipInvite = skipInviteVal === 'true';

  // When NOT skipping invite, email is required
  if (!skipInvite) {
    if (!email || !z.string().email().safeParse(email).success) return { error: 'E-mail do Thought Leader inválido.' };
  }

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

    // When skipInvite, create a placeholder doc without Firebase Auth user
    if (skipInvite) {
      const placeholderId = crypto.randomBytes(16).toString('hex');
      const tlSlug = generateSlug(name, placeholderId);
      await adminDb.collection("users").doc(placeholderId).set({
        role: 'thoughtleader',
        name,
        slug: tlSlug,
        companyId,
        companyName,
        status: 'Pendente',
        profile: { name, email: '' },
        pendingSetup: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
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

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("Error in inviteThoughtLeader:", errorMessage);
    return { error: `Erro ao convidar Thought Leader: ${errorMessage}` };
  }
}

// ---- Invite Pending Thought Leader (convert placeholder to real user) ----

export async function invitePendingThoughtLeader(
  idToken: string,
  placeholderId: string,
  email: string,
): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }

  if (!email || !z.string().email().safeParse(email).success) {
    return { error: 'E-mail inválido.' };
  }

  try {
    // 1. Fetch placeholder doc and validate
    const placeholderDoc = await adminDb.collection('users').doc(placeholderId).get();
    if (!placeholderDoc.exists) return { error: 'Thought Leader não encontrado.' };
    const placeholderData = placeholderDoc.data()!;

    if (!placeholderData.pendingSetup) {
      return { error: 'Este Thought Leader já foi convidado.' };
    }

    const companyId = placeholderData.companyId;
    if (!companyId) return { error: 'Thought Leader sem empresa associada.' };

    // Auth check
    await requireAdminOrStrategist(idToken, companyId);

    // Get company data for locale
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data();
    const companyName = placeholderData.companyName || companyData?.companyName || '';
    const companyLocale = (companyData?.locale as 'pt-BR' | 'en') || 'pt-BR';

    // 2. Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        displayName: placeholderData.name,
        password: crypto.randomBytes(16).toString('base64url') + 'A1!',
      });
    } catch (authError: unknown) {
      if ((authError as { code?: string })?.code === 'auth/email-already-exists') {
        return { error: `Um usuário com o e-mail ${email} já existe.` };
      }
      throw authError;
    }

    const realUID = userRecord.uid;
    const tlSlug = generateSlug(placeholderData.name, realUID);

    // 3. Create new user doc with real UID
    await adminDb.collection('users').doc(realUID).set({
      role: 'thoughtleader',
      name: placeholderData.name,
      slug: tlSlug,
      companyId,
      companyName,
      status: 'Pendente',
      profile: { name: placeholderData.name, email },
      createdAt: placeholderData.createdAt || FieldValue.serverTimestamp(),
    });

    // 4. Migrate subcollections from placeholder to real UID
    // 4a. users/{placeholderId}/contentPipeline/* → users/{realUID}/contentPipeline/*
    const pipelineDocs = await adminDb.collection(`users/${placeholderId}/contentPipeline`).listDocuments();
    for (const docRef of pipelineDocs) {
      const snap = await docRef.get();
      if (snap.exists) {
        await adminDb.collection(`users/${realUID}/contentPipeline`).doc(docRef.id).set(snap.data()!);
        await docRef.delete();
      }
    }

    // 4b. users/{placeholderId}/scheduledPosts/* → users/{realUID}/scheduledPosts/*
    const scheduledDocs = await adminDb.collection(`users/${placeholderId}/scheduledPosts`).listDocuments();
    for (const docRef of scheduledDocs) {
      const snap = await docRef.get();
      if (snap.exists) {
        await adminDb.collection(`users/${realUID}/scheduledPosts`).doc(docRef.id).set(snap.data()!);
        await docRef.delete();
      }
    }

    // 4c. companies/{companyId}/thoughtLeaders/{placeholderId}/* → thoughtLeaders/{realUID}/*
    const tlSubcollections = await adminDb.doc(`companies/${companyId}/thoughtLeaders/${placeholderId}`).listCollections();
    for (const subcol of tlSubcollections) {
      const subDocs = await subcol.listDocuments();
      for (const docRef of subDocs) {
        const snap = await docRef.get();
        if (snap.exists) {
          await adminDb.doc(`companies/${companyId}/thoughtLeaders/${realUID}/${subcol.id}/${docRef.id}`).set(snap.data()!);
          await docRef.delete();
        }
      }
    }

    // 5. Delete old placeholder doc and its remaining subcollections
    const oldUserRef = adminDb.collection('users').doc(placeholderId);
    const oldSubcollections = await oldUserRef.listCollections();
    for (const subcol of oldSubcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }
    await oldUserRef.delete();

    // 6. Send invitation email
    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });
    sendInvitationEmail({
      to: email,
      name: placeholderData.name,
      companyName,
      role: 'Thought Leader',
      resetLink,
      locale: companyLocale,
    }).catch((emailError) => {
      console.error("Error sending pending TL invitation email:", emailError);
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error("Error in invitePendingThoughtLeader:", errorMessage);
    return { error: `Erro ao convidar Thought Leader: ${errorMessage}` };
  }
}

// ---- Delete Thought Leader Action (by Admin or Strategist) ----

export async function deleteThoughtLeader(idToken: string, userId: string): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }
  try {
    const targetDoc = await adminDb.collection('users').doc(userId).get();
    if (!targetDoc.exists) return { error: 'Thought Leader não encontrado.' };
    const targetData = targetDoc.data();
    if (!targetData?.companyId) return { error: 'Thought Leader sem empresa associada.' };
    if (targetData?.role !== 'thoughtleader') return { error: 'Este usuário não é um Thought Leader.' };

    // Admin or Strategist of the company can delete TLs
    await requireAdminOrStrategist(idToken, targetData.companyId);

    // Delete from Firebase Auth (may not exist for placeholder TLs)
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: unknown) {
      const authErr = authError as { code?: string; message?: string };
      if (authErr?.code !== 'auth/user-not-found') {
        console.error(`Error deleting Auth user ${userId}:`, authErr?.message);
      }
    }

    // Delete user subcollections (contentPipeline, scheduledPosts, etc.)
    const userRef = adminDb.collection('users').doc(userId);
    const subcollections = await userRef.listCollections();
    for (const subcol of subcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }

    // Delete company-level TL subcollections (contentStrategy, brandManual)
    const companyTLRef = adminDb.doc(`companies/${targetData.companyId}/thoughtLeaders/${userId}`);
    const companyTLSubcols = await companyTLRef.listCollections();
    for (const subcol of companyTLSubcols) {
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
    console.error('Error in deleteThoughtLeader:', errorMessage);
    return { error: `Erro ao remover Thought Leader: ${errorMessage}` };
  }
}

// ---- Update Collaborator Profile (server-side) ----

export async function updateCollaboratorProfile(
  idToken: string,
  companyId: string,
  collaboratorId: string,
  name: string,
  email: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdminOrStrategist(idToken, companyId);

    const schema = z.object({
      collaboratorId: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email(),
    });
    const parsed = schema.parse({ collaboratorId, name, email });

    await adminDb.collection('users').doc(parsed.collaboratorId).update({
      'profile.name': parsed.name,
      'profile.email': parsed.email,
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in updateCollaboratorProfile:', msg);
    return { error: msg };
  }
}

// ---- Toggle Collaborator Status (server-side) ----

export async function toggleCollaboratorStatus(
  idToken: string,
  companyId: string,
  collaboratorId: string,
  newStatus: 'Ativo' | 'Inativo',
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdminOrStrategist(idToken, companyId);

    const schema = z.object({
      collaboratorId: z.string().min(1),
      newStatus: z.enum(['Ativo', 'Inativo']),
    });
    const parsed = schema.parse({ collaboratorId, newStatus });

    await adminDb.collection('users').doc(parsed.collaboratorId).update({
      status: parsed.newStatus,
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in toggleCollaboratorStatus:', msg);
    return { error: msg };
  }
}

// ---- Save Notification Preferences ----

export async function saveNotificationPrefs(
  idToken: string,
  prefs: Record<string, boolean>,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    await adminDb.collection('users').doc(user.uid).update({
      notificationPrefs: prefs,
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in saveNotificationPrefs:', msg);
    return { error: msg };
  }
}

// ---- Resend Invite ----

/**
 * Resend invitation email to a user with status 'Pendente'.
 * Generates a fresh Firebase password reset link and sends the invite email again.
 */
export async function resendInvite(
  idToken: string,
  userId: string,
): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: 'O servico de autenticacao nao esta disponivel.' };
  }
  try {
    const caller = await requireAuth(idToken);

    // Only admin, strategist, or master can resend invites
    if (!caller.role || !['admin', 'strategist', 'master'].includes(caller.role)) {
      return { error: 'Acesso negado.' };
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return { error: 'Usuario nao encontrado.' };

    const userData = userDoc.data()!;
    const email = userData.profile?.email || userData.email;
    const name = userData.profile?.name || userData.name || '';
    const role = userData.role as string;
    const companyId = userData.companyId as string;

    if (!email) return { error: 'Usuario sem e-mail cadastrado.' };

    // Verify admin belongs to same company (unless master)
    if (caller.role === 'admin') {
      if (caller.companyId !== companyId) {
        return { error: 'Acesso negado: usuario de outra empresa.' };
      }
    }

    // Get company info for email
    let companyName = userData.companyName || '';
    let companyLocale: 'pt-BR' | 'en' = 'pt-BR';
    if (companyId) {
      const companyDoc = await adminDb.collection('companies').doc(companyId).get();
      if (companyDoc.exists) {
        const companyData = companyDoc.data()!;
        companyName = companyData.companyName || companyName;
        companyLocale = (companyData.locale === 'en' ? 'en' : 'pt-BR');
      }
    }

    // Map role to display label
    const roleLabels: Record<string, Record<string, string>> = {
      'pt-BR': { colaborador: 'Colaborador', thoughtleader: 'Thought Leader', strategist: 'Estrategista', admin: 'Administrador' },
      en: { colaborador: 'Collaborator', thoughtleader: 'Thought Leader', strategist: 'Strategist', admin: 'Administrator' },
    };
    const roleLabel = roleLabels[companyLocale]?.[role] || roleLabels['pt-BR']?.[role] || role;

    // Generate fresh password reset link and send email
    const loginUrl = getInviteBaseUrl() + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });

    await sendInvitationEmail({
      to: email,
      name,
      companyName,
      role: roleLabel,
      resetLink,
      locale: companyLocale,
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in resendInvite:', msg);
    return { error: `Erro ao reenviar convite: ${msg}` };
  }
}

// ---- Get Notification Preferences ----

export async function getNotificationPrefs(
  idToken: string,
): Promise<{ prefs?: Record<string, boolean>; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    const doc = await adminDb.collection('users').doc(user.uid).get();
    const data = doc.data();
    return { prefs: data?.notificationPrefs || {} };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getNotificationPrefs:', msg);
    return { error: msg };
  }
}
