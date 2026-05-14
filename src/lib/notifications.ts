// src/lib/notifications.ts
// Email notification system — sends personal-style emails from Fai (platform manager)
// via nodemailer (Gmail SMTP). Each notification checks recipient's prefs before sending.

import nodemailer from 'nodemailer';
import { db as adminDb } from '@/lib/firebase-admin';

// ── Types ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'mission_submitted'        // admin ← collaborator submitted proof
  | 'mission_reviewed'         // collaborator ← admin approved/rejected
  | 'reward_redeemed'          // admin ← collaborator redeemed a reward
  | 'post_ready_for_review'    // TL ← strategist moved post to review
  | 'monthly_analytics_reminder'; // TL/colaborador ← lembrete mensal de upload do XLSX

export type NotificationPrefs = {
  mission_submitted?: boolean;
  mission_reviewed?: boolean;
  reward_redeemed?: boolean;
  post_ready_for_review?: boolean;
  monthly_analytics_reminder?: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  mission_submitted: true,
  monthly_analytics_reminder: true,
  mission_reviewed: true,
  reward_redeemed: true,
  post_ready_for_review: true,
};

// ── Fai Sender Config ───────────────────────────────────────────────

const FAI_NAME = 'Fai da Boldfy';
const FAI_ROLE = 'Gerente de Educação e Sucesso do Cliente';
const FAI_EMAIL = 'admin@boldfy.com.br';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';
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

// ── Email Template — clean, personal style ──────────────────────────

function wrapInTemplate(body: string): string {
  const baseUrl = getBaseUrl();
  const faiPhoto = `${baseUrl}/images/email/fai-avatar.png`;
  const boldfyLogo = `${baseUrl}/images/email/boldfy-logo.svg`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px 32px; color: #374151;">

    <!-- Body -->
    ${body}

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
      <a href="${baseUrl}" style="text-decoration: none;">
        <img src="${boldfyLogo}" alt="Boldfy" width="90" height="auto" style="display: inline-block;" />
      </a>
    </div>

    <!-- Opt-out -->
    <p style="margin-top: 20px; font-size: 11px; color: #9CA3AF; text-align: center; line-height: 1.5;">
      Você recebeu este e-mail porque tem notificações ativas na
      <a href="${baseUrl}" style="color: #9CA3AF;">Boldfy</a>.<br/>
      Acesse <a href="${baseUrl}/login" style="color: #9333ea;">Configurações</a> para ajustar suas preferências.
    </p>
  </div>
</body>
</html>`;
}

async function sendNotificationEmail(to: string, subject: string, body: string) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${FAI_NAME}" <${process.env.SMTP_EMAIL}>`,
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
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${adminName}! 👋
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        O <strong>${collaboratorName}</strong> acabou de enviar uma comprovação
        pra missão <strong>"${missionName}"</strong>.
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Dá uma olhada quando puder?
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}/admin/missoes"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Revisar comprovação
        </a>
      </p>`,
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

  if (approved) {
    let pointsLine = '';
    if (pointsAwarded) {
      pointsLine = `Você ganhou <strong>+${pointsAwarded} pontos</strong>! 🎉`;
    }

    await sendNotificationEmail(
      email,
      `✅ Missão aprovada: ${missionName}`,
      `
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${name}! 🎊
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Boa notícia! Sua comprovação da missão <strong>"${missionName}"</strong>
        foi <strong style="color: #059669;">aprovada</strong>.
      </p>
      ${pointsLine ? `<p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">${pointsLine}</p>` : ''}
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Continue assim! 💪
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}/colaborador/missoes"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Ver minhas missões
        </a>
      </p>`,
    );
  } else {
    let feedbackBlock = '';
    if (feedback) {
      feedbackBlock = `
      <div style="margin: 16px 0 20px; padding: 12px 16px; background-color: #f9fafb; border-left: 3px solid #d1d5db; border-radius: 4px;">
        <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px; font-weight: 600;">Feedback:</p>
        <p style="font-size: 14px; color: #374151; margin: 0; line-height: 1.5;">${feedback}</p>
      </div>`;
    }

    await sendNotificationEmail(
      email,
      `Missão não aprovada: ${missionName}`,
      `
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${name}!
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 4px;">
        Sua comprovação da missão <strong>"${missionName}"</strong> não foi aprovada dessa vez.
      </p>
      ${feedbackBlock}
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Sem stress — dá pra enviar de novo! 😊
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}/colaborador/missoes"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Ver minhas missões
        </a>
      </p>`,
    );
  }
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
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${adminName}! 👋
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        O <strong>${collaboratorName}</strong> resgatou a recompensa
        <strong>"${rewardName}"</strong> por <strong>${pointsSpent} pontos</strong>.
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        Quando rolar a entrega, é só marcar como entregue na plataforma.
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}/admin/recompensas"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Ver resgates
        </a>
      </p>`,
    );
  }
}

/**
 * Notify admin(s) that a reward is running low on voucher codes.
 * Triggered after a redemption when ≤2 codes remain.
 */
export async function notifyLowStock({
  companyId,
  rewardName,
  remainingCodes,
}: {
  companyId: string;
  rewardName: string;
  remainingCodes: number;
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
    if (!prefs.reward_redeemed) continue; // reuse same pref

    const email = data.profile?.email;
    if (!email) continue;

    const adminName = data.profile?.name?.split(' ')[0] || 'Admin';
    const codesWord = remainingCodes === 0 ? 'nenhum código' : `apenas ${remainingCodes} código(s)`;

    await sendNotificationEmail(
      email,
      `⚠️ Recompensa "${rewardName}" com poucos códigos`,
      `
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Oi, ${adminName}! 👋
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        A recompensa <strong>"${rewardName}"</strong> tem ${codesWord} disponível(is).
      </p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        ${remainingCodes === 0
          ? 'A recompensa foi <strong>desativada automaticamente</strong>. Adicione mais códigos para reativá-la.'
          : 'Quando acabarem, ela ficará indisponível automaticamente. É hora de comprar mais gift cards e cadastrar os códigos na plataforma.'}
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}/admin/recompensas"
           style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
          → Gerenciar códigos
        </a>
      </p>`,
    );
  }
}

/**
 * Notify collaborator with the voucher code they just redeemed.
 */
export async function notifyCodeRedeemed({
  userId,
  rewardName,
  code,
}: {
  userId: string;
  rewardName: string;
  code: string;
}) {
  const prefs = await getUserNotifPrefs(userId);
  if (!prefs.reward_redeemed) return;

  const userDoc = await adminDb.collection('users').doc(userId).get();
  const data = userDoc.data();
  const email = data?.profile?.email;
  if (!email) return;

  const name = data?.profile?.name?.split(' ')[0] || 'Colaborador';
  const baseUrl = getBaseUrl();

  await sendNotificationEmail(
    email,
    `🎁 Seu código de resgate: ${rewardName}`,
    `
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Oi, ${name}! 🎉
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Sua recompensa <strong>"${rewardName}"</strong> foi resgatada com sucesso!
      Aqui está o seu código:
    </p>
    <div style="margin: 20px 0; padding: 16px 24px; background-color: #f3f0ff; border: 2px solid #9333ea; border-radius: 10px; text-align: center;">
      <p style="margin: 0; font-size: 22px; font-weight: 700; font-family: 'Courier New', monospace; color: #1F2937; letter-spacing: 2px;">
        ${code}
      </p>
    </div>
    <p style="font-size: 14px; line-height: 1.7; margin: 0 0 16px; color: #6B7280;">
      ⚠️ Guarde este código com carinho — ele é único e não aparecerá
      novamente na plataforma. Você também pode acessá-lo nos seus resgates.
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Aproveite! 💜
    </p>
    <p style="margin: 0;">
      <a href="${baseUrl}/colaborador/recompensas"
         style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
        → Ver meus resgates
      </a>
    </p>`,
  );
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
    `Post pronto pra revisão: ${postTitle || 'Sem título'}`,
    `
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Oi, ${name}! 👋
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Tem um post novo prontinho pra você revisar:
      <strong>"${postTitle || 'Sem título'}"</strong>.
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
      Confere lá quando der?
    </p>
    <p style="margin: 0;">
      <a href="${baseUrl}/thoughtleader/backlog"
         style="color: #9333ea; font-weight: 600; text-decoration: none; font-size: 15px;">
        → Ver na plataforma
      </a>
    </p>`,
  );
}

/**
 * Lembrete mensal de upload do extract do LinkedIn Analytics.
 * Enviado no 1º dia útil do mês para todos os TLs e colaboradores ativos.
 *
 * @param userId  — uid do destinatário
 * @param role    — 'thoughtleader' | 'colaborador' (define URL de destino)
 * @param monthLabel — ex: "maio de 2026" (mês que deve ser exportado)
 */
export async function notifyMonthlyAnalyticsReminder({
  userId,
  role,
  monthLabel,
}: {
  userId: string;
  role: 'thoughtleader' | 'colaborador';
  monthLabel: string;
}) {
  const prefs = await getUserNotifPrefs(userId);
  if (!prefs.monthly_analytics_reminder) return;

  const userDoc = await adminDb.collection('users').doc(userId).get();
  const data = userDoc.data();
  const email = data?.profile?.email || data?.email;
  if (!email) return;

  const name = (data?.profile?.name || data?.name || '').split(' ')[0] || 'Olá';
  const baseUrl = getBaseUrl();
  const analyticsUrl = `${baseUrl}/${role}/analytics`;

  await sendNotificationEmail(
    email,
    `Hora de atualizar seu Analytics do LinkedIn — ${monthLabel}`,
    `
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Oi, ${name}! 👋
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
      Começou um novo mês — e isso significa que já dá pra exportar o relatório
      do LinkedIn Analytics referente a <strong>${monthLabel}</strong> e fazer o
      upload aqui na plataforma.
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      Com esses dados a gente consegue ver como foi a performance do seu conteúdo
      e manter tudo atualizado no seu painel. 📊
    </p>
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      E você ainda ganha <strong>🪙 50 pontos</strong> quando faz o upload.
    </p>

    <!-- CTA principal -->
    <div style="margin: 28px 0;">
      <a href="${analyticsUrl}"
         style="display: inline-block; background-color: #9333ea; color: #ffffff;
                font-size: 15px; font-weight: 600; text-decoration: none;
                padding: 12px 24px; border-radius: 8px;">
        → Fazer upload agora
      </a>
    </div>

    <!-- Mini tutorial -->
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 24px; margin-bottom: 8px;">
      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
        Como exportar o relatório
      </p>
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: top; padding-bottom: 12px;">
            <span style="display: inline-flex; align-items: center; justify-content: center;
                         width: 22px; height: 22px; background-color: #9333ea; color: #fff;
                         border-radius: 50%; font-size: 11px; font-weight: 700;
                         margin-right: 10px; flex-shrink: 0;">1</span>
            <span style="font-size: 14px; color: #374151; line-height: 1.5;">
              Acesse o
              <a href="https://www.linkedin.com/analytics/creator/content/"
                 style="color: #9333ea; font-weight: 600; text-decoration: none;">
                LinkedIn Analytics
              </a>
              e vá em <strong>Desempenho do conteúdo</strong>
            </span>
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top; padding-bottom: 12px;">
            <span style="display: inline-flex; align-items: center; justify-content: center;
                         width: 22px; height: 22px; background-color: #9333ea; color: #fff;
                         border-radius: 50%; font-size: 11px; font-weight: 700;
                         margin-right: 10px; flex-shrink: 0;">2</span>
            <span style="font-size: 14px; color: #374151; line-height: 1.5;">
              Filtre o período para o mês de <strong>${monthLabel}</strong>
              (do dia 1 ao último dia do mês)
            </span>
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top; padding-bottom: 12px;">
            <span style="display: inline-flex; align-items: center; justify-content: center;
                         width: 22px; height: 22px; background-color: #9333ea; color: #fff;
                         border-radius: 50%; font-size: 11px; font-weight: 700;
                         margin-right: 10px; flex-shrink: 0;">3</span>
            <span style="font-size: 14px; color: #374151; line-height: 1.5;">
              Clique em <strong>Exportar</strong> e salve o arquivo <code>.xlsx</code>
            </span>
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top;">
            <span style="display: inline-flex; align-items: center; justify-content: center;
                         width: 22px; height: 22px; background-color: #9333ea; color: #fff;
                         border-radius: 50%; font-size: 11px; font-weight: 700;
                         margin-right: 10px; flex-shrink: 0;">4</span>
            <span style="font-size: 14px; color: #374151; line-height: 1.5;">
              Volte pra plataforma, clique em
              <strong>"Upload do Relatório"</strong> e suba o arquivo
            </span>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #6B7280; line-height: 1.6; margin: 16px 0 0;">
      Qualquer dúvida, é só responder este e-mail. 💜
    </p>`,
  );
}
