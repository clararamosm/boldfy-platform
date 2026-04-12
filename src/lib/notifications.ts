// src/lib/notifications.ts
// Email notification system — sends branded transactional emails via nodemailer (Gmail SMTP).
// All emails are sent from FAI (our platform manager persona) at admin@boldfy.com.br.
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

// ── FAI Sender Config ────────────────────────────────────────────────

const FAI_NAME = 'FAI';
const FAI_ROLE = 'Gerente do Aplicativo';
const FAI_EMAIL = 'admin@boldfy.com.br';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';
}

function getFaiPhotoUrl() {
  return `${getBaseUrl()}/images/email/fai-avatar.png`;
}

function getBoldfyLogoUrl() {
  return `${getBaseUrl()}/images/email/boldfy-logo.png`;
}

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

// ── Email Template ──────────────────────────────────────────────────

function wrapInTemplate(body: string): string {
  const faiPhoto = getFaiPhotoUrl();
  const boldfyLogo = getBoldfyLogoUrl();
  const baseUrl = getBaseUrl();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @keyframes subtleGlow {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f0f8;">
  <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px;">

    <!-- Main Content Card -->
    <div style="background-color: #ffffff; border-radius: 16px; padding: 32px 28px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      ${body}
    </div>

    <!-- FAI Signature -->
    <div style="margin-top: 24px; padding: 0 4px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="width: 56px; vertical-align: top; padding-right: 14px;">
            <img src="${faiPhoto}" alt="${FAI_NAME}" width="52" height="52"
              style="border-radius: 50%; border: 2px solid #bd58e7; display: block;" />
          </td>
          <td style="vertical-align: top;">
            <p style="margin: 0 0 2px; font-size: 15px; font-weight: 600; color: #1F2937;">
              ${FAI_NAME}
            </p>
            <p style="margin: 0 0 4px; font-size: 13px; color: #6B7280;">
              ${FAI_ROLE}
            </p>
            <a href="mailto:${FAI_EMAIL}" style="font-size: 12px; color: #bd58e7; text-decoration: none;">
              ${FAI_EMAIL}
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Divider -->
    <div style="margin: 20px 0 16px; border-top: 1px solid #e5e0eb;"></div>

    <!-- Footer with Boldfy Logo -->
    <div style="text-align: center;">
      <a href="${baseUrl}" style="text-decoration: none; display: inline-block;">
        <img src="${boldfyLogo}" alt="Boldfy" width="100" height="auto"
          style="display: block; margin: 0 auto; animation: subtleGlow 3s ease-in-out infinite;" />
      </a>
      <p style="color: #A89BB5; font-size: 11px; margin: 12px 0 0; line-height: 1.5;">
        Você recebeu este e-mail porque tem notificações ativas na Boldfy.<br/>
        Para ajustar suas preferências, acesse
        <a href="${baseUrl}/login" style="color: #bd58e7; text-decoration: underline;">Configurações</a>
        na plataforma.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendNotificationEmail(to: string, subject: string, body: string) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${FAI_NAME} | Boldfy" <${process.env.SMTP_EMAIL}>`,
      replyTo: FAI_EMAIL,
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
  const admins = await adminDb
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'admin')
    .get();

  const baseUrl = getBaseUrl();

  for (const adminDoc of admins.docs) {
    const data = adminDoc.data();
    const prefs = await getUserNotifPrefs(adminDoc.id);
    if (!prefs.mission_submitted) continue;

    const email = data.profile?.email;
    if (!email) continue;

    const adminName = data.profile?.name?.split(' ')[0] || 'Admin';
    await sendNotificationEmail(
      email,
      `Nova comprovação de missão — ${collaboratorName}`,
      `
      <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px;">
        Oi, ${adminName}!
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 6px;">
        <strong>${collaboratorName}</strong> acabou de enviar uma comprovação para a missão <strong>${missionName}</strong>.
      </p>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        Quando puder, dá uma olhada e aprova ou rejeita.
      </p>
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="${baseUrl}/admin/missoes"
           style="background-color: #bd58e7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">
          Revisar comprovação
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

  const name = data?.profile?.name?.split(' ')[0] || 'Colaborador';
  const approved = action === 'approve';
  const baseUrl = getBaseUrl();

  const statusText = approved ? 'aprovada' : 'rejeitada';
  const statusColor = approved ? '#059669' : '#DC2626';
  const statusBg = approved ? '#ecfdf5' : '#fef2f2';
  const emoji = approved ? '✅' : '❌';

  let extraInfo = '';
  if (approved && pointsAwarded) {
    extraInfo = `
    <div style="margin: 16px 0; padding: 14px 16px; background-color: #ecfdf5; border-radius: 10px; text-align: center;">
      <p style="color: #059669; font-weight: 700; font-size: 16px; margin: 0;">+${pointsAwarded} pontos</p>
      <p style="color: #6B7280; font-size: 12px; margin: 4px 0 0;">adicionados ao seu saldo</p>
    </div>`;
  }
  if (!approved && feedback) {
    extraInfo = `
    <div style="margin: 16px 0; padding: 14px 16px; background-color: #fef2f2; border-radius: 10px; border-left: 3px solid #DC2626;">
      <p style="color: #374151; font-size: 13px; margin: 0 0 4px; font-weight: 600;">Feedback:</p>
      <p style="color: #4B5563; font-size: 14px; margin: 0; line-height: 1.5;">${feedback}</p>
    </div>`;
  }

  await sendNotificationEmail(
    email,
    `${emoji} Missão ${statusText}: ${missionName}`,
    `
    <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px;">
      Oi, ${name}!
    </p>
    <div style="background-color: ${statusBg}; border-radius: 10px; padding: 16px; margin: 0 0 8px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0;">
        Sua comprovação da missão <strong>${missionName}</strong> foi
        <span style="color: ${statusColor}; font-weight: 700;">${statusText}</span>.
      </p>
    </div>
    ${extraInfo}
    <div style="text-align: center; margin: 24px 0 8px;">
      <a href="${baseUrl}/colaborador/missoes"
         style="background-color: #bd58e7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">
        Ver minhas missões
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

  const baseUrl = getBaseUrl();

  for (const adminDoc of admins.docs) {
    const data = adminDoc.data();
    const prefs = await getUserNotifPrefs(adminDoc.id);
    if (!prefs.reward_redeemed) continue;

    const email = data.profile?.email;
    if (!email) continue;

    const adminName = data.profile?.name?.split(' ')[0] || 'Admin';
    await sendNotificationEmail(
      email,
      `Resgate de recompensa — ${collaboratorName}`,
      `
      <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px;">
        Oi, ${adminName}!
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 6px;">
        <strong>${collaboratorName}</strong> resgatou a recompensa <strong>${rewardName}</strong>
        por <strong>${pointsSpent} pontos</strong>.
      </p>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        Acesse a plataforma para marcar como entregue quando for o caso.
      </p>
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="${baseUrl}/admin/recompensas"
           style="background-color: #bd58e7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">
          Ver resgates
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

  const name = data?.profile?.name?.split(' ')[0] || 'Thought Leader';
  const baseUrl = getBaseUrl();

  await sendNotificationEmail(
    email,
    `Post pronto para revisão: ${postTitle || 'Sem título'}`,
    `
    <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px;">
      Oi, ${name}!
    </p>
    <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 6px;">
      O post <strong>"${postTitle || 'Sem título'}"</strong> está pronto para sua revisão.
    </p>
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      Quando puder, confira e aprove na plataforma.
    </p>
    <div style="text-align: center; margin: 24px 0 8px;">
      <a href="${baseUrl}/login"
         style="background-color: #bd58e7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">
        Ver na plataforma
      </a>
    </div>`,
  );
}
