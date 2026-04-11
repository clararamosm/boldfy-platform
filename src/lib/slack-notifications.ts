// src/lib/slack-notifications.ts
// Fire-and-forget helper for event-based Slack notifications.
// Called from server actions when a status changes or feedback is received.

import { db as adminDb } from '@/lib/firebase-admin';
import { sendSlackMessage } from '@/lib/slack';
import { renderTemplate, type SlackNotificationConfig, type SlackNotificationType } from '@/lib/slack-templates';

/**
 * Trigger an event-based Slack notification.
 * This is fire-and-forget — errors are logged but never thrown to the caller.
 */
export async function triggerSlackNotification(
  type: 'post_pronto' | 'feedback_recebido',
  context: {
    strategistId?: string;
    tlUserId: string;
    postId: string;
    postTitle: string;
    feedbackText?: string;
  }
): Promise<void> {
  try {
    // 1. Find the strategist(s) assigned to this TL's company
    const tlDoc = await adminDb.collection('users').doc(context.tlUserId).get();
    if (!tlDoc.exists) return;
    const tlData = tlDoc.data()!;
    const companyId = tlData.companyId as string;
    if (!companyId) return;

    // Find strategists assigned to this company
    const strategistsSnap = await adminDb.collection('users')
      .where('role', '==', 'strategist')
      .where('assignedCompanies', 'array-contains', companyId)
      .get();

    if (strategistsSnap.empty) return;

    // 2. For each strategist, check if they have a config for this TL
    for (const stratDoc of strategistsSnap.docs) {
      const configDocId = `${companyId}_${context.tlUserId}`;
      const configDoc = await adminDb
        .collection('users')
        .doc(stratDoc.id)
        .collection('slackConfig')
        .doc(configDocId)
        .get();

      if (!configDoc.exists) continue;

      const config = configDoc.data() as SlackNotificationConfig;
      const notifEntry = config.notifications[type as SlackNotificationType];

      const channelId = config.channelId || notifEntry?.channelId;
      if (!notifEntry?.enabled || !channelId) continue;

      // 3. Get strategist name for template context
      const stratData = stratDoc.data();
      const strategistName = stratData.profile?.name || stratData.name || 'Estrategista';

      // 4. Render template
      const message = await renderTemplate(notifEntry.template, {
        companyId,
        companyName: config.companyName,
        tlId: context.tlUserId,
        tlName: config.tlName,
        strategistName,
        post: {
          id: context.postId,
          title: context.postTitle,
        },
        feedbackText: context.feedbackText,
      });

      // 5. Send to Slack (use config-level channel, fallback to per-notification)
      const result = await sendSlackMessage(channelId, message);
      if (!result.ok) {
        console.error(`Slack notification (${type}) failed for strategist ${stratDoc.id}:`, result.error);
      }
    }
  } catch (error) {
    console.error(`triggerSlackNotification (${type}) error:`, error);
  }
}
