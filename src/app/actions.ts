// src/app/actions.ts
'use server';

import { z } from 'zod';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// ---- Email Invitation Helper ----

async function sendInvitationEmail({ to, name, companyName, role, resetLink }: {
  to: string;
  name: string;
  companyName: string;
  role: string;
  resetLink: string;
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://boldfy-platform--boldfy-app.us-central1.hosted.app';

  await transporter.sendMail({
    from: `"Boldfy" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `Você foi convidado para a ${companyName} na Boldfy!`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">Boldfy</h1>
        <p style="color: #6B7280; margin-top: 5px;">Plataforma de Gamificação para Colaboradores</p>
      </div>
      <h2 style="color: #1F2937;">Olá, ${name}!</h2>
      <p style="color: #4B5563; line-height: 1.6;">
        Você foi convidado como <strong>${role}</strong> na empresa <strong>${companyName}</strong>
        na plataforma Boldfy.
      </p>
      <p style="color: #4B5563; line-height: 1.6;">
        Para começar, clique no botão abaixo para criar sua senha e acessar sua conta:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Criar Minha Senha e Acessar
        </a>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 20px; padding: 15px; background-color: #f3e8ff; border-radius: 8px;">
        <strong>Depois de criar sua senha:</strong><br/>
        Acesse a plataforma em <a href="${appUrl}/login" style="color: #bd58e7;">${appUrl}/login</a> e faça login com seu e-mail e a senha que acabou de criar.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">
        Se você não esperava este convite, pode ignorar este e-mail com segurança.
      </p>
    </div>
    `,
  });
}

// ---- AI Content Alignment Action ----

async function getCompanyProfile(companyId: string): Promise<Record<string, string>> {
  const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();

  if (companyDocSnap.exists) {
    const data = companyDocSnap.data();
    const bc = data?.brandContext || data?.branding || {};
    const arrToStr = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v as string || '');
    return {
      companyName: data?.companyName || '',
      valueProposition: bc.valueProposition || '',
      tagline: bc.tagline || '',
      businessKeywords: arrToStr(bc.businessKeywords),
      solutions: arrToStr(bc.solutions),
      targetPainPoints: arrToStr(bc.targetPainPoints),
      targetAudience: bc.targetAudience || bc.audience || '',
      approvedTopics: arrToStr(bc.approvedTopics),
      prohibitedPhrases: arrToStr(bc.prohibitedPhrases),
    };
  }
  throw new Error('Perfil da empresa não encontrado.');
}

async function getPersonalBranding(userId: string): Promise<Record<string, string>> {
  const userDocSnap = await adminDb.collection("users").doc(userId).get();

  if (userDocSnap.exists) {
    const data = userDocSnap.data();
    const arrToStr = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v as string || '');
    return {
      authorName: data?.profile?.name || data?.name || '',
      position: data?.position || '',
      voice: data?.voice || '',
      expertise: data?.expertise || '',
      value: data?.value || '',
      languageStyle: data?.languageStyle || '',
      contentPillars: arrToStr(data?.contentPillars),
    };
  }
  return {
    authorName: '',
    position: '',
    voice: '',
    expertise: '',
    value: '',
    languageStyle: '',
    contentPillars: '',
  };
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

    // Save generated content to user's generatedContent subcollection (non-blocking)
    if (data.alignedContent && userId) {
      adminDb.collection('users').doc(userId).collection('generatedContent').add({
        input: content,
        output: data.alignedContent,
        format,
        length,
        starred: false,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(err => console.error('Error saving generated content:', err));
    }

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
  licenses: z.coerce.number().int().min(5, 'O número de licenças deve ser no mínimo 5.').positive('Número de licenças deve ser positivo.'),
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
      status: 'Ativa',
      licenses: licenses,
      adminProfile: { email: adminEmail, name: adminName },
      brandContext: { valueProposition: '', tagline: '', businessKeywords: [], solutions: [], targetPainPoints: [], targetAudience: '', approvedTopics: [], prohibitedPhrases: [] },
      subscription: {
        plan: 'trial',
        status: 'trialing',
        totalLicenses: licenses,
        usedLicenses: 0,
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
      name: adminName,
      companyId: companyId,
      companyName: companyName,
      points: 0,
      profile: { name: adminName, email: adminEmail },
      createdAt: FieldValue.serverTimestamp(),
    });

    // 4. Generate password reset link and send invitation email (non-blocking)
    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(adminEmail, { url: loginUrl });
    sendInvitationEmail({
      to: adminEmail,
      name: adminName,
      companyName: companyName,
      role: 'Administrador',
      resetLink,
    }).catch((emailError) => {
      console.error("Error sending admin invitation email:", emailError);
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
    // 1. Get company data first (to validate and get companyName)
    const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDocSnap.exists) {
      throw new Error("Empresa não encontrada.");
    }
    const companyData = companyDocSnap.data();
    const companyName = companyData?.companyName || '';

    // 2. Check license availability
    const currentLicenses = companyData?.licenses || 0;
    const usersQuery = await adminDb.collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "colaborador")
      .get();

    if (usersQuery.size >= currentLicenses) {
      return { error: `Limite de licenças atingido (${currentLicenses}). Não é possível convidar mais colaboradores.` };
    }

    // 3. Create Auth user
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: email,
        displayName: name,
        password: Math.random().toString(36).slice(-12) + 'A1!',
      });
    } catch (authError: any) {
      if (authError?.code === 'auth/email-already-exists') {
        return { error: `Um usuário com o e-mail ${email} já existe.` };
      }
      throw authError;
    }

    // 4. Create User document in Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      role: 'colaborador',
      name: name,
      companyId: companyId,
      companyName: companyName,
      points: 0,
      status: 'Ativo',
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
    });

    // 5. Generate password reset link and send invitation email (non-blocking)
    const loginUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br') + '/login';
    const resetLink = await adminAuth.generatePasswordResetLink(email, { url: loginUrl });
    sendInvitationEmail({
      to: email,
      name: name,
      companyName: companyName,
      role: 'Colaborador',
      resetLink,
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

// ---- Toggle Star on Generated Content ----

export async function toggleStarContent(userId: string, contentId: string, starred: boolean): Promise<{ success?: boolean; error?: string }> {
  try {
    await adminDb.collection('users').doc(userId).collection('generatedContent').doc(contentId).update({ starred });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: errorMessage };
  }
}

// ---- Delete Collaborator Action (by Admin) ----

export async function deleteCollaborator(userId: string): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }
  try {
    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        console.error(`Error deleting Auth user ${userId}:`, authError?.message);
      }
    }

    // 2. Delete user subcollections (trailProgress, rescues, pointsHistory)
    const userRef = adminDb.collection('users').doc(userId);
    const subcollections = await userRef.listCollections();
    for (const subcol of subcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }

    // 3. Delete Firestore user doc
    await userRef.delete();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in deleteCollaborator:', errorMessage);
    return { error: `Erro ao remover colaborador: ${errorMessage}` };
  }
}

// ---- Server-Side Reward Redemption ----

export async function redeemReward(
  userId: string,
  rewardId: string,
  companyId: string,
  userName: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    // 1. Read reward to validate it exists, is available, and has stock
    const rewardDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rewards')
      .doc(rewardId)
      .get();

    if (!rewardDoc.exists) {
      return { error: 'Recompensa não encontrada.' };
    }

    const reward = rewardDoc.data()!;

    if (reward.status !== 'Disponível') {
      return { error: 'Esta recompensa não está mais disponível.' };
    }

    // Check stock
    if (typeof reward.stock === 'number' && reward.stock <= 0) {
      return { error: 'Estoque esgotado para esta recompensa.' };
    }

    // 2. Recalculate current points to get authoritative balance
    const progressSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('trailProgress')
      .get();

    let earnedPoints = 0;
    progressSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pontosGanhos && typeof data.pontosGanhos === 'number') {
        earnedPoints += data.pontosGanhos;
      }
    });

    const rescuesSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .get();

    let spentPoints = 0;
    rescuesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        spentPoints += data.points;
      }
    });

    const currentPoints = Math.max(0, earnedPoints - spentPoints);

    if (currentPoints < reward.points) {
      return { error: `Pontos insuficientes. Você tem ${currentPoints} pontos, mas precisa de ${reward.points}.` };
    }

    // 3. Write everything in a batch via Admin SDK
    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();

    // 3a. User-level rescue doc
    const userRescueRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .doc();

    batch.set(userRescueRef, {
      rewardName: reward.name,
      rewardId,
      date: now,
      status: 'Pendente',
      points: reward.points,
    });

    // 3b. Company-level rescue doc (for admin visibility)
    const companyRescueRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rescues')
      .doc(userRescueRef.id); // Same ID for cross-reference

    batch.set(companyRescueRef, {
      userId,
      userName,
      rewardName: reward.name,
      rewardId,
      date: now,
      status: 'Pendente',
      points: reward.points,
    });

    // 3c. Points history entry
    const historyRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('pointsHistory')
      .doc();

    batch.set(historyRef, {
      description: `Resgate: ${reward.name}`,
      date: now,
      points: reward.points,
      type: 'spend',
      source: 'resgate',
    });

    // 3d. Decrement stock (if not unlimited)
    if (typeof reward.stock === 'number') {
      batch.update(rewardDoc.ref, {
        stock: reward.stock - 1,
        ...(reward.stock - 1 === 0 && { status: 'Desativada' }),
      });
    }

    // 3e. Update user points directly
    const newPoints = currentPoints - reward.points;
    batch.update(adminDb.collection('users').doc(userId), {
      points: Math.max(0, newPoints),
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in redeemReward:', errorMessage);
    return { error: `Erro ao resgatar recompensa: ${errorMessage}` };
  }
}

// ---- Mark Rescue as Paid (dual-write) ----

export async function markRescueAsPaid(
  rescueId: string,
  companyId: string,
  userId?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const batch = adminDb.batch();

    // Update company-level rescue
    const companyRescueRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rescues')
      .doc(rescueId);

    const companyRescueDoc = await companyRescueRef.get();
    if (!companyRescueDoc.exists) {
      return { error: 'Resgate não encontrado.' };
    }

    batch.update(companyRescueRef, { status: 'Pago' });

    // Update user-level rescue (same ID)
    const rescueData = companyRescueDoc.data()!;
    const rescueUserId = userId || rescueData.userId;

    if (rescueUserId) {
      const userRescueRef = adminDb
        .collection('users')
        .doc(rescueUserId)
        .collection('rescues')
        .doc(rescueId);

      batch.update(userRescueRef, { status: 'Pago' });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in markRescueAsPaid:', errorMessage);
    return { error: `Erro ao marcar como pago: ${errorMessage}` };
  }
}

// ---- Server-Side Points Recalculation ----

export async function recalculatePoints(userId: string): Promise<{ points: number; error?: string }> {
  try {
    // 1. Read all trailProgress subcollection docs for this user
    const progressSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('trailProgress')
      .get();

    // 2. Sum pontosGanhos from completed trails only
    let earnedPoints = 0;
    progressSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pontosGanhos && typeof data.pontosGanhos === 'number') {
        earnedPoints += data.pontosGanhos;
      }
    });

    // 3. Read rescue history to subtract spent points
    let spentPoints = 0;
    const rescuesSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .get();

    rescuesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        spentPoints += data.points;
      }
    });

    // 4. Final points = earned - spent
    const finalPoints = Math.max(0, earnedPoints - spentPoints);

    // 5. Update user document with calculated points (server-side only)
    await adminDb.collection('users').doc(userId).update({
      points: finalPoints,
    });

    return { points: finalPoints };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in recalculatePoints:', errorMessage);
    return { points: 0, error: errorMessage };
  }
}
