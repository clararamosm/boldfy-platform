// src/app/api/cron/health-check/route.ts
// Weekly health check: verifies platform status and sends report to Slack.
// Call via Cloud Scheduler every Monday at 9am BRT.
// Secured via CRON_SECRET header.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { sendSlackMessage } from '@/lib/slack';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Find channel ID by name
async function findChannelId(channelName: string): Promise<string | null> {
  const { WebClient } = await import('@slack/web-api');
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  const client = new WebClient(token);

  let cursor: string | undefined;
  do {
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    const found = result.channels?.find(ch => ch.name === channelName);
    if (found?.id) return found.id;
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return null;
}

export async function GET(request: NextRequest) {
  // Security: verify cron secret
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: { label: string; status: 'ok' | 'warn' | 'error'; detail: string }[] = [];

  // 1. Check Firestore is accessible + count companies
  try {
    const companiesSnap = await adminDb.collection('companies').get();
    const activeCompanies = companiesSnap.docs.filter(d => {
      const sub = d.data().subscription;
      return sub && ['active', 'trialing'].includes(sub.status);
    });
    checks.push({
      label: 'Firestore',
      status: 'ok',
      detail: `${companiesSnap.size} empresas total, ${activeCompanies.length} ativas`,
    });
  } catch (e) {
    checks.push({ label: 'Firestore', status: 'error', detail: `Erro: ${e instanceof Error ? e.message : 'desconhecido'}` });
  }

  // 2. Check total users
  try {
    const usersSnap = await adminDb.collection('users').count().get();
    const totalUsers = usersSnap.data().count;
    checks.push({ label: 'Usuarios', status: 'ok', detail: `${totalUsers} usuarios registrados` });
  } catch (e) {
    checks.push({ label: 'Usuarios', status: 'error', detail: `Erro: ${e instanceof Error ? e.message : 'desconhecido'}` });
  }

  // 3. Check Stripe events (last 7 days)
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const eventsSnap = await adminDb.collection('stripeEvents')
      .where('processedAt', '>=', weekAgo)
      .get();
    const failed = eventsSnap.docs.filter(d => d.data().status === 'error');
    if (failed.length > 0) {
      checks.push({ label: 'Stripe', status: 'warn', detail: `${eventsSnap.size} eventos, ${failed.length} com erro` });
    } else {
      checks.push({ label: 'Stripe', status: 'ok', detail: `${eventsSnap.size} eventos processados sem erro` });
    }
  } catch (e) {
    checks.push({ label: 'Stripe', status: 'error', detail: `Erro: ${e instanceof Error ? e.message : 'desconhecido'}` });
  }

  // 4. Check cron publish-posts activity (any posts published last 7 days)
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const usersSnap = await adminDb.collection('users')
      .where('role', 'in', ['colaborador', 'thoughtleader'])
      .limit(50)
      .get();

    let publishedCount = 0;
    for (const userDoc of usersSnap.docs) {
      const postsSnap = await adminDb.collection('users').doc(userDoc.id)
        .collection('scheduledPosts')
        .where('status', '==', 'published')
        .where('publishedAt', '>=', weekAgo)
        .limit(10)
        .get();
      publishedCount += postsSnap.size;
    }
    checks.push({ label: 'Cron Posts', status: 'ok', detail: `${publishedCount} posts publicados na semana` });
  } catch (e) {
    checks.push({ label: 'Cron Posts', status: 'warn', detail: `Nao conseguiu checar: ${e instanceof Error ? e.message : 'desconhecido'}` });
  }

  // 5. Check Sentry (via API if token available)
  const sentryToken = process.env.SENTRY_AUTH_TOKEN;
  if (sentryToken) {
    try {
      const res = await fetch(
        'https://sentry.io/api/0/projects/boldfy/javascript-nextjs/issues/?query=is:unresolved&statsPeriod=7d&limit=5',
        { headers: { Authorization: `Bearer ${sentryToken}` } }
      );
      if (res.ok) {
        const issues = await res.json();
        if (issues.length === 0) {
          checks.push({ label: 'Sentry', status: 'ok', detail: '0 erros novos na semana' });
        } else {
          const titles = issues.slice(0, 3).map((i: { title: string }) => i.title).join(', ');
          checks.push({ label: 'Sentry', status: 'warn', detail: `${issues.length} erros: ${titles}` });
        }
      } else {
        checks.push({ label: 'Sentry', status: 'warn', detail: `API retornou ${res.status}` });
      }
    } catch (e) {
      checks.push({ label: 'Sentry', status: 'warn', detail: `Erro na API: ${e instanceof Error ? e.message : 'desconhecido'}` });
    }
  } else {
    checks.push({ label: 'Sentry', status: 'warn', detail: 'SENTRY_AUTH_TOKEN nao configurado — checar manualmente' });
  }

  // Build Slack message
  const statusEmoji = (s: string) => s === 'ok' ? ':white_check_mark:' : s === 'warn' ? ':warning:' : ':x:';
  const hasIssues = checks.some(c => c.status !== 'ok');

  const header = hasIssues
    ? ':rotating_light: *Health Check Semanal — Atenção necessária*'
    : ':large_green_circle: *Health Check Semanal — Tudo OK*';

  const checkLines = checks.map(c => `${statusEmoji(c.status)} *${c.label}:* ${c.detail}`).join('\n');

  const manualChecklist = `
:clipboard: *Checklist manual da semana:*
• [ ] Revisar erros no Sentry (sentry.io)
• [ ] Checar pagamentos falhando no Stripe Dashboard
• [ ] Verificar custo no Firebase Console → Billing
• [ ] Rodar \`npm audit\` no repo local
• [ ] Atualizar dependencias se necessario (\`npm update\`)`;

  const fullMessage = `${header}\n\n${checkLines}\n\n---\n${manualChecklist}`;

  // Send to Slack
  let slackSent = false;
  try {
    const channelId = process.env.HEALTH_CHECK_SLACK_CHANNEL_ID || await findChannelId('atualizações-produto');

    if (channelId) {
      const result = await sendSlackMessage(channelId, fullMessage);
      if (!result.ok) {
        console.error('Health check Slack send failed:', result.error);
      } else {
        slackSent = true;
      }
    }
  } catch (slackError) {
    console.error('Health check Slack error:', slackError);
  }

  return NextResponse.json({ success: true, checks, slackSent });
}
