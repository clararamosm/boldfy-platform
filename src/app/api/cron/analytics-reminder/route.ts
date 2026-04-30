// src/app/api/cron/analytics-reminder/route.ts
//
// Cron endpoint: envia lembrete mensal de upload do extract do LinkedIn Analytics.
// Deve ser chamado diariamente via Cloud Scheduler (sugestão: todo dia às 09:00 BRT).
// O endpoint verifica se hoje é o 1º dia útil do mês antes de enviar.
//
// Secured via CRON_SECRET Bearer token.
//
// Cloud Scheduler config sugerida:
//   Schedule:  0 9 1-7 * *       (dias 1–7 de cada mês, às 09:00)
//   Time zone: America/Sao_Paulo
//   URL:       https://app.boldfy.com.br/api/cron/analytics-reminder
//   Auth:      Authorization: Bearer <CRON_SECRET>

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { notifyMonthlyAnalyticsReminder } from '@/lib/notifications';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Retorna true se a data fornecida é o 1º dia útil do seu mês.
 * Dias úteis = segunda a sexta (sem considerar feriados nacionais por ora).
 */
function isFirstBusinessDayOfMonth(date: Date): boolean {
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb

  // Só verifica nos 3 primeiros dias do mês (o 1º dia útil cai sempre entre dias 1–3)
  if (day > 3) return false;

  // Dia 1: é dia útil se for Seg–Sex
  if (day === 1 && dayOfWeek >= 1 && dayOfWeek <= 5) return true;

  // Dia 2: é o 1º dia útil se dia 1 foi Sábado (dayOfWeek===1 → hoje é segunda)
  if (day === 2 && dayOfWeek === 1) return true; // dia 1 foi domingo

  // Dia 3: é o 1º dia útil se dias 1 e 2 foram fim de semana (hoje é segunda)
  if (day === 3 && dayOfWeek === 1) return true; // dias 1–2 foram sab+dom

  return false;
}

/**
 * Formata o mês anterior em português.
 * Ex: chamado em 01/05/2026 → "abril de 2026"
 */
function getPreviousMonthLabel(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ── Handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Security: verify cron secret
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Horário atual em BRT
  const now = new Date();
  const brtString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const brt = new Date(brtString);

  // Só envia no 1º dia útil do mês
  if (!isFirstBusinessDayOfMonth(brt)) {
    return NextResponse.json({
      skipped: true,
      reason: `Hoje (${brt.toLocaleDateString('pt-BR')}) não é o 1º dia útil do mês.`,
    });
  }

  const monthLabel = getPreviousMonthLabel(brt);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Buscar todos os TLs e colaboradores ativos
    const usersSnap = await adminDb
      .collection('users')
      .where('role', 'in', ['thoughtleader', 'colaborador'])
      .get();

    const promises = usersSnap.docs.map(async (userDoc) => {
      try {
        const data = userDoc.data();
        const role = data.role as 'thoughtleader' | 'colaborador';

        // Pula usuários sem email
        const email = data?.profile?.email || data?.email;
        if (!email) {
          skipped++;
          return;
        }

        await notifyMonthlyAnalyticsReminder({
          userId: userDoc.id,
          role,
          monthLabel,
        });

        sent++;
      } catch (err) {
        console.error(`[analytics-reminder] Falha ao enviar para ${userDoc.id}:`, err);
        failed++;
      }
    });

    // Processa em paralelo, com limite de 10 concurrent para não sobrecarregar o SMTP
    const BATCH_SIZE = 10;
    for (let i = 0; i < promises.length; i += BATCH_SIZE) {
      await Promise.all(promises.slice(i, i + BATCH_SIZE));
    }

    console.log(`[analytics-reminder] Lembrete de ${monthLabel} enviado. sent=${sent} failed=${failed} skipped=${skipped}`);

    return NextResponse.json({
      ok: true,
      monthLabel,
      sent,
      failed,
      skipped,
      date: brt.toLocaleDateString('pt-BR'),
    });
  } catch (err) {
    console.error('[analytics-reminder] Erro geral:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
