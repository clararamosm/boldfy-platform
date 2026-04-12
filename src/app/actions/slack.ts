// src/app/actions/slack.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireStrategist } from '@/lib/auth-guard';
import { listSlackChannels, sendSlackMessage } from '@/lib/slack';
import {
  type SlackNotificationConfig,
  type SlackNotificationType,
  type NotificationEntry,
  DEFAULT_TEMPLATES,
  NOTIFICATION_META,
} from '@/lib/slack-templates';

// ---- Get Slack Channels (bot's channels) ----

export async function getSlackChannels(idToken: string): Promise<{
  channels?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    await requireStrategist(idToken);
    const channels = await listSlackChannels();
    return { channels };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao buscar canais.';
    console.error('Error in getSlackChannels:', msg);
    return { error: msg };
  }
}

// ---- Get Slack Config for a Company+TL ----

export async function getSlackConfig(
  idToken: string,
  companyId: string,
  tlId: string
): Promise<{ config?: SlackNotificationConfig | null; error?: string }> {
  try {
    const user = await requireStrategist(idToken);

    const configDocId = `${companyId}_${tlId}`;
    const configDoc = await adminDb
      .collection('users')
      .doc(user.uid)
      .collection('slackConfig')
      .doc(configDocId)
      .get();

    if (!configDoc.exists) {
      return { config: null };
    }

    return { config: configDoc.data() as SlackNotificationConfig };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao buscar configuracao.';
    console.error('Error in getSlackConfig:', msg);
    return { error: msg };
  }
}

// ---- Save Slack Config ----

export async function saveSlackConfig(
  idToken: string,
  companyId: string,
  tlId: string,
  data: {
    companyName: string;
    tlName: string;
    channelId: string | null;
    channelName: string | null;
    notifications: Record<SlackNotificationType, Partial<NotificationEntry>>;
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireStrategist(idToken);

    const configDocId = `${companyId}_${tlId}`;
    const docRef = adminDb
      .collection('users')
      .doc(user.uid)
      .collection('slackConfig')
      .doc(configDocId);

    // Build full notification config, merging defaults for missing fields
    // Channel is set at config level; propagate to each notification for backward compat
    const notifications: Record<string, NotificationEntry> = {};
    const notifTypes: SlackNotificationType[] = [
      'resumo_semanal',
      'lembrete_aprovacao',
      'dropin_semanal',
      'post_pronto',
      'feedback_recebido',
    ];

    for (const type of notifTypes) {
      const input = data.notifications[type] || {};
      notifications[type] = {
        enabled: input.enabled ?? false,
        channelId: data.channelId,
        channelName: data.channelName,
        template: input.template || DEFAULT_TEMPLATES[type],
        tag: NOTIFICATION_META[type].tag,
        ...(type === 'dropin_semanal' ? {
          dayOfWeek: input.dayOfWeek ?? 2,
          timeOfDay: input.timeOfDay ?? '10:00',
        } : {}),
      };
    }

    const configData: SlackNotificationConfig = {
      companyId,
      tlId,
      companyName: data.companyName,
      tlName: data.tlName,
      channelId: data.channelId,
      channelName: data.channelName,
      notifications: notifications as Record<SlackNotificationType, NotificationEntry>,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(configData, { merge: false });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao salvar configuracao.';
    console.error('Error in saveSlackConfig:', msg);
    return { error: msg };
  }
}

// ---- Test Slack Notification ----

export async function testSlackNotification(
  idToken: string,
  channelId: string,
  notificationLabel: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    // Allow strategist and master to test
    if (user.role !== 'strategist' && user.role !== 'master') {
      return { error: 'Acesso negado: permissão de estrategista necessária.' };
    }

    if (!channelId) {
      return { error: 'Canal não especificado.' };
    }

    const message = `*Teste Boldfy* — ${notificationLabel}\n\nEsta é uma mensagem de teste. Se você está vendo isso, o canal está configurado corretamente! ✅`;
    const result = await sendSlackMessage(channelId, message);

    if (!result.ok) {
      return { error: result.error || 'Falha ao enviar mensagem de teste.' };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar teste.';
    console.error('Error in testSlackNotification:', msg);
    return { error: msg };
  }
}
