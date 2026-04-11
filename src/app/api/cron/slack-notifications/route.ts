// src/app/api/cron/slack-notifications/route.ts
// Cron endpoint: sends scheduled Slack notifications (resumo semanal, lembrete aprovacao, drop-in).
// Call this hourly via Cloud Scheduler. Secured via CRON_SECRET header.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { sendSlackMessage } from '@/lib/slack';
import { renderTemplate, type SlackNotificationConfig, type SlackNotificationType } from '@/lib/slack-templates';

export async function GET(request: NextRequest) {
  // Security: verify cron secret
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current BRT time
  const now = new Date();
  const brtString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const brt = new Date(brtString);
  const dayOfWeek = brt.getDay(); // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
  const hour = brt.getHours();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Query all strategists
    const strategistsSnap = await adminDb.collection('users')
      .where('role', '==', 'strategist')
      .get();

    for (const strategistDoc of strategistsSnap.docs) {
      const stratData = strategistDoc.data();
      const strategistName = stratData.profile?.name || stratData.name || 'Estrategista';

      // Get all slackConfig subcollection docs for this strategist
      const configsSnap = await adminDb
        .collection('users')
        .doc(strategistDoc.id)
        .collection('slackConfig')
        .get();

      if (configsSnap.empty) continue;

      for (const configDoc of configsSnap.docs) {
        const config = configDoc.data() as SlackNotificationConfig;

        // --- Resumo Semanal: Friday at 9h ---
        if (dayOfWeek === 5 && hour === 9) {
          const result = await processNotification(
            config,
            'resumo_semanal',
            strategistName,
            configDoc.ref
          );
          if (result === 'sent') sent++;
          else if (result === 'failed') failed++;
          else skipped++;
        }

        // --- Lembrete de Aprovacao: Mon-Fri at 9h ---
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour === 9) {
          // Only send if there are pending posts
          const hasPending = await checkHasPendingPosts(config.tlId);
          if (hasPending) {
            const result = await processNotification(
              config,
              'lembrete_aprovacao',
              strategistName,
              configDoc.ref
            );
            if (result === 'sent') sent++;
            else if (result === 'failed') failed++;
            else skipped++;
          } else {
            skipped++;
          }
        }

        // --- Drop-in Semanal: configurable day/time ---
        const dropin = config.notifications.dropin_semanal;
        const dropinChannel = config.channelId || dropin?.channelId;
        if (dropin?.enabled && dropinChannel && dropin.dayOfWeek === dayOfWeek) {
          const configHour = parseInt(dropin.timeOfDay?.split(':')[0] || '10');
          if (hour === configHour) {
            const result = await processNotification(
              config,
              'dropin_semanal',
              strategistName,
              configDoc.ref
            );
            if (result === 'sent') sent++;
            else if (result === 'failed') failed++;
            else skipped++;
          }
        }
      }
    }

    return NextResponse.json({
      message: `Slack notifications cron done.`,
      sent,
      failed,
      skipped,
      time: brt.toISOString(),
    });
  } catch (error) {
    console.error('Slack notifications cron error:', error);
    return NextResponse.json(
      { error: 'Internal error processing notifications.' },
      { status: 500 }
    );
  }
}

// ---- Helpers ----

async function processNotification(
  config: SlackNotificationConfig,
  type: SlackNotificationType,
  strategistName: string,
  configDocRef: FirebaseFirestore.DocumentReference
): Promise<'sent' | 'failed' | 'skipped'> {
  const notif = config.notifications[type];
  const channelId = config.channelId || notif?.channelId;
  if (!notif?.enabled || !channelId) return 'skipped';

  // Idempotency: check if already sent this hour
  if (notif.lastSentAt) {
    const lastSent = new Date(notif.lastSentAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSent.getTime();
    if (diffMs < 55 * 60 * 1000) { // Less than 55 min ago = already sent this window
      return 'skipped';
    }
  }

  try {
    // Render the template
    const message = await renderTemplate(notif.template, {
      companyId: config.companyId,
      companyName: config.companyName,
      tlId: config.tlId,
      tlName: config.tlName,
      strategistName,
    });

    // Send to Slack (use config-level channel, fallback to per-notification)
    const result = await sendSlackMessage(channelId, message);

    if (result.ok) {
      // Update lastSentAt for idempotency
      await configDocRef.update({
        [`notifications.${type}.lastSentAt`]: new Date().toISOString(),
      });
      return 'sent';
    } else {
      console.error(`Slack notification (${type}) failed:`, result.error);
      return 'failed';
    }
  } catch (error) {
    console.error(`Error processing ${type}:`, error);
    return 'failed';
  }
}

async function checkHasPendingPosts(tlId: string): Promise<boolean> {
  const snap = await adminDb
    .collection(`users/${tlId}/contentPipeline`)
    .where('status', 'in', ['aprovar_ideia', 'aprovar_post'])
    .limit(1)
    .get();
  return !snap.empty;
}
