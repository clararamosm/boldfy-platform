// src/app/api/migrate-slugs/route.ts
// One-time migration: adds slug to companies and thought leaders that don't have one.
// Call: POST /api/migrate-slugs (requires master role)

import { NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase-admin';
import { generateSlug } from '@/lib/slugify';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Auth check: require master role
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(sessionCookie);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const role = userDoc.data()?.role;
    if (role !== 'master') {
      return NextResponse.json({ error: 'Acesso negado. Apenas master.' }, { status: 403 });
    }

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
