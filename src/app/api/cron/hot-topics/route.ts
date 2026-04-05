// src/app/api/cron/hot-topics/route.ts
// Cron endpoint: generates hot topics for all active companies.
// Call once per week via Cloud Scheduler.
// Secured via CRON_SECRET header.

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { generateHotTopicsForCompany } from '@/app/actions/hot-topics';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 min — multiple AI calls

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let generated = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Get all companies that have brandContext configured
    const companiesSnap = await adminDb.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const data = companyDoc.data();
      const bc = data?.brandContext || data?.branding || {};

      // Skip companies without brand context
      const hasKeywords = Array.isArray(bc.businessKeywords)
        ? bc.businessKeywords.length > 0
        : !!bc.businessKeywords;
      const hasTopics = Array.isArray(bc.approvedTopics)
        ? bc.approvedTopics.length > 0
        : !!bc.approvedTopics;

      if (!hasKeywords && !hasTopics) {
        skipped++;
        continue;
      }

      try {
        const result = await generateHotTopicsForCompany(companyDoc.id);
        if (result.error) {
          console.error(`Hot topics failed for ${companyDoc.id}: ${result.error}`);
          failed++;
        } else {
          generated++;
        }
      } catch (err) {
        console.error(`Hot topics error for ${companyDoc.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      message: `Hot topics cron complete. Generated: ${generated}, Failed: ${failed}, Skipped: ${skipped}.`,
      generated,
      failed,
      skipped,
    });
  } catch (error) {
    console.error('Hot topics cron error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
