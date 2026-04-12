// src/app/api/migrate-slugs/route.ts
// One-time migration: adds slug to companies and thought leaders that don't have one.
// Call: POST /api/migrate-slugs with Authorization: Bearer <idToken>

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireMaster } from '@/lib/auth-guard';
import { generateSlug } from '@/lib/slugify';

export async function POST(req: NextRequest) {
  try {
    // Auth check: require master role
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) {
      return NextResponse.json({ error: 'Token não fornecido.' }, { status: 401 });
    }

    await requireMaster(idToken);

    const log: string[] = [];

    // ---- Migrate companies ----
    const compSnap = await db.collection('companies').get();
    let compMigrated = 0;
    for (const doc of compSnap.docs) {
      const data = doc.data();
      if (data.slug) continue;

      const name = data.companyName || '';
      const slug = generateSlug(name, doc.id);
      await db.collection('companies').doc(doc.id).update({ slug });
      log.push(`Company: ${name} → ${slug}`);
      compMigrated++;
    }

    // ---- Migrate thought leaders ----
    const tlSnap = await db.collection('users')
      .where('role', '==', 'thoughtleader')
      .get();
    let tlMigrated = 0;
    for (const doc of tlSnap.docs) {
      const data = doc.data();
      if (data.slug) continue;

      const name = data.name || data.profile?.name || '';
      const slug = generateSlug(name, doc.id);
      await db.collection('users').doc(doc.id).update({ slug });
      log.push(`TL: ${name} → ${slug}`);
      tlMigrated++;
    }

    return NextResponse.json({
      success: true,
      companiesMigrated: compMigrated,
      tlMigrated,
      log,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
