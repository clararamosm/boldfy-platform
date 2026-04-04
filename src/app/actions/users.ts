// src/app/actions/users.ts
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

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';

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

    const userRecord = await adminAuth.createUser({
      email: adminEmail,
      displayName: adminName,
      password: Math.random().toString(36).slice(-12) + 'A1!',
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
    const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDocSnap.exists) {
      throw new Error("Empresa não encontrada.");
    }
    const companyData = companyDocSnap.data();
    const companyName = companyData?.companyName || '';

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
        password: Math.random().toString(36).slice(-12) + 'A1!',
      });
    } catch (authError: any) {
      if (authError?.code === 'auth/email-already-exists') {
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
      status: 'Ativo',
      profile: { name, email },
      createdAt: FieldValue.serverTimestamp(),
    });

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

// ---- Delete Collaborator Action (by Admin) ----

export async function deleteCollaborator(userId: string): Promise<{ success?: boolean; error?: string }> {
  if (!adminAuth) {
    return { error: "O serviço de autenticação não está disponível." };
  }
  try {
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        console.error(`Error deleting Auth user ${userId}:`, authError?.message);
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
