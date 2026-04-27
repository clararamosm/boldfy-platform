// src/app/api/cron/check-trials/route.ts
// Diario: promove Platform free -> pending quando trialEndsAt venceu.
// Protegido por CRON_SECRET. Chame via Cloud Scheduler 1x ao dia (ex: 03:30 BRT).
//
// Toda a logica de negocio vive em lib/billing/cron-jobs.ts — este handler
// apenas valida o token e delega.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { runCheckTrialToPending } from '@/lib/billing/cron-jobs';

export async function GET(request: NextRequest) {
  // Seguranca: Bearer token fixo do Cloud Scheduler.
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runCheckTrialToPending();

    console.log('[cron:check-trials]', {
      scanned: result.scanned,
      promotedCount: result.promoted.length,
      errorsCount: result.errors.length,
      ranAt: result.ranAtISO,
    });

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      promotedCount: result.promoted.length,
      errorsCount: result.errors.length,
      ranAtISO: result.ranAtISO,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('[cron:check-trials] fatal:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
