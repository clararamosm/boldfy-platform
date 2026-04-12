// src/lib/notifications.ts
// Email notification system — sends branded transactional emails via nodemailer (Gmail SMTP).
// Each notification type checks the recipient's `notificationPrefs` before sending.

import nodemailer from 'nodemailer';
import { db as adminDb } from '@/lib/firebase-admin';

// ── Types ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'mission_submitted'      // admin ← collaborator submitted proof
  | 'mission_reviewed'       // collaborator ← admin approved/rejected
  | 'reward_redeemed'        // admin ← collaborator redeemed a reward
  | 'post_ready_for_review'; // TL ← strategist moved post to review

export type NotificationPrefs = {
  mission_submitted?: boolean;
  mission_reviewed?: boolean;
  reward_redeemed?: boolean;
  post_ready_for_review?: boolean;
};

// Default: all enabled
const DEFAULT_PREFS: NotificationPrefs = {
  mission_submitted: true,
  mission_reviewed: true,
  reward_redeemed: true,
  post_ready_for_review: true,
};

// ── Transport ────────────────────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

// ── Preference Check ─────────────────────────────────────────────────

async function getUserNotifPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const doc = await adminDb.collection('users').doc(userId).get();
    const prefs = doc.data()?.notificationPrefs as NotificationPrefs | undefined;
    return { ...DEFAULT_PREFS, ...prefs };
  } catch {
    return DEFAULT_PREFS;
  }
}

// ── Email Wrapper ────────────────────────────────────────────────────

function wrapInTemplate(body: string): string {
  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <h1 style="color: #7C3AED; margin: 0; font-size: 24px;">Boldfy</h1>
    </div>
    ${body}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
        Você recebeu este e-mail porque tem notificações ativas na Boldfy.<br/>
        Para ajustar suas preferências, acesse Configurações na plataforma.
      </p>
    </div>
  </div>`;
}

async function sendNotificationEmail(to: string, subject: string, body: string) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Boldfy" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html: wrapInTemplate(body),
    });
  } catch (error) {
    console.error('[Notification] Failed to send email:', error);
  }
}

// ── Notification Functions ───────────────────────────────────────────

/**
 * Notify admin(s) that a collaborator submitted mission proof.
 */
export async function notifyMissionSubmitted({
  companyId,
  collaboratorName,
  missionName,
}: {
  companyId: string;
  collaboratorName: string;
  missionName: string;
}) {
  // Find admin(s) for this company
  const admins = await adminDb
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'admin')
    .get();

  for (const adminDoc of admins.docs) {
    const data = adminDoc.data();
    const prefs = await getUserNotifPrefs(adminDoc.id);
    if (!prefs.mission_submitted) continue;

    const email = data.profile?.email;
    if (!email) continue;

    const adminName = data.profile?.name || 'Admin';
    await sendNotificationEmail(
      email,
      `Nova comprovação de missão — ${collaboratorName}`,
      `
      <h2 style="color: #1F2937; font-size: 18px;">Olá, ${adminName}!</h2>
      <p style="color: #4B5563; line-height: 1.6;">
        <strong>${collaboratorName}</strong> enviou uma comprovação para a missão <strong>${missionName}</strong>.
      </p>
      <p style="color: #4B5563; line-height: 1.6;">
        Acesse a plataforma para revisar e aprovar ou rejeitar.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br'}/admin/missoes"
           style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Revisar Comprovação
        </a>
      </div>`,
    );
  }
}

/**
 * Notify collaborator that their mission was approved or rejected.
 */
export async function notifyMissionReviewed({
  collaboratorId,
  missionName,
  action,
  feedback,
  pointsAwarded,
}: {
  collaboratorId: string;
  missionName: string;
  action: 'approve' | 'reject';
  feedback?: string;
  pointsAwarded?: number;
}) {
  const prefs = await getUserNotifPrefs(collaboratorId);
  if (!prefs.mission_reviewed) return;

  const userDoc = await adminDb.collection('users').doc(collaboratorId).get();
  const data = userDoc.data();
  const email = data?.profile?.email;
  if (!email) return;

  const name = data?.profile?.name || 'Colaborador';
  const approved = action === 'approve';

  const statusText = approved ? 'aprovada' : 'rejeitada';
  const statusColor = approved ? '#059669' : '#DC2626';
  const emoji = approved ? '✅' : '❌';

  let extraInfo = '';
  if (approved && pointsAwarded) {
    extraInfo = `<p style="color: #059669; font-weight: 600; margin-top: 12px;">+${pointsAwarded} pontos adicionados ao seu saldo!</p>`;
  }
  if (!approved && feedback) {
    extraInfo = `
    <div style="margin-top: 12px; padding: 12px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #DC2626;">
      <p style="color: #4B5563; margin: 0; font-size: 14px;"><strong>Feedback:</strong> ${feedback}</p>
    </div>`;
  }

  await sendNotificationEmail(
    email,
    `${emoji} Missão ${statusText}: ${missionName}`,
    `
    <h2 style="color: #1F2937; font-size: 18px;">Olá, ${name}!</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Sua comprovação da missão <strong>${missionName}</strong> foi
      <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>.
    </p>
    ${extraInfo}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br'}/colaborador/missoes"
         style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Ver Minhas Missões
      </a>
    </div>`,
  );
}

/**
 * Notify admin(s) that a collaborator redeemed a reward.
 */
export async function notifyRewardRedeemed({
  companyId,
  collaboratorName,
  rewardName,
  pointsSpent,
}: {
  companyId: string;
  collaboratorName: string;
  rewardName: string;
  pointsSpent: number;
}) {
  const admins = await adminDb
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'admin')
    .get();

  for (const adminDoc of admins.docs) {
    const data = adminDoc.data();
    const prefs = await getUserNotifPrefs(adminDoc.id);
    if (!prefs.reward_redeemed) continue;

    const email = data.profile?.email;
    if (!email) continue;

    const adminName = data.profile?.name || 'Admin';
    await sendNotificationEmail(
      email,
      `Resgate de recompensa — ${collaboratorName}`,
      `
      <h2 style="color: #1F2937; font-size: 18px;">Olá, ${adminName}!</h2>
      <p style="color: #4B5563; line-height: 1.6;">
        <strong>${collaboratorName}</strong> resgatou a recompensa <strong>${rewardName}</strong>
        por <strong>${pointsSpent} pontos</strong>.
      </p>
      <p style="color: #4B5563; line-height: 1.6;">
        Acesse a plataforma para marcar como entregue.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br'}/admin/recompensas"
           style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Ver Resgates
        </a>
      </div>`,
    );
  }
}

/**
 * Notify a TL that their post is ready for review.
 */
export async function notifyPostReadyForReview({
  tlUserId,
  postTitle,
}: {
  tlUserId: string;
  postTitle: string;
}) {
  const prefs = await getUserNotifPrefs(tlUserId);
  if (!prefs.post_ready_for_review) return;

  const userDoc = await adminDb.collection('users').doc(tlUserId).get();
  const data = userDoc.data();
  const email = data?.profile?.email;
  if (!email) return;

  const name = data?.profile?.name || 'Thought Leader';
  await sendNotificationEmail(
    email,
    `Post pronto para revisão: ${postTitle || 'Sem título'}`,
    `
    <h2 style="color: #1F2937; font-size: 18px;">Olá, ${name}!</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      O post <strong>"${postTitle || 'Sem título'}"</strong> está pronto para sua revisão.
    </p>
    <p style="color: #4B5563; line-height: 1.6;">
      Acesse a plataforma para conferir e aprovar.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br'}/login"
         style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Ver na Plataforma
      </a>
    </div>`,
  );
}
