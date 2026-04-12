/**
 * Migration script: Add slugs to existing companies and thought leaders.
 *
 * Run with:
 *   npx tsx scripts/migrate-slugs.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set to service account key, OR
 *   - Running in an environment with default credentials
 *
 * What it does:
 *   1. Iterates all companies without a `slug` field → generates and saves one
 *   2. Iterates all thought leaders without a `slug` field → generates and saves one
 *   3. Checks for duplicate slugs and logs warnings
 */

import * as admin from 'firebase-admin';

// ---- Initialize Firebase Admin ----
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// ---- Slug generation (mirrors src/lib/slugify.ts) ----

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateSlug(name: string, firestoreId: string): string {
  const base = slugify(name);
  const suffix = firestoreId.slice(0, 5).toLowerCase();
  return base ? `${base}-${suffix}` : suffix;
}

// ---- Migration logic ----

async function migrateCompanies() {
  console.log('\n🏢 Migrating companies...');
  const snapshot = await db.collection('companies').get();
  let migrated = 0;
  let skipped = 0;
  const slugSet = new Set<string>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.slug) {
      slugSet.add(data.slug);
      skipped++;
      continue;
    }

    const companyName = data.companyName || '';
    const slug = generateSlug(companyName, doc.id);

    if (slugSet.has(slug)) {
      console.warn(`  ⚠️  Duplicate slug "${slug}" for company ${doc.id} (${companyName})`);
    }

    slugSet.add(slug);
    await db.collection('companies').doc(doc.id).update({ slug });
    console.log(`  ✅ ${companyName} → ${slug}`);
    migrated++;
  }

  console.log(`  Companies: ${migrated} migrated, ${skipped} already had slugs`);
}

async function migrateThoughtLeaders() {
  console.log('\n👤 Migrating thought leaders...');
  const snapshot = await db.collection('users')
    .where('role', '==', 'thoughtleader')
    .get();

  let migrated = 0;
  let skipped = 0;
  const slugSet = new Set<string>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.slug) {
      slugSet.add(data.slug);
      skipped++;
      continue;
    }

    const name = data.name || data.profile?.name || '';
    const slug = generateSlug(name, doc.id);

    if (slugSet.has(slug)) {
      console.warn(`  ⚠️  Duplicate slug "${slug}" for TL ${doc.id} (${name})`);
    }

    slugSet.add(slug);
    await db.collection('users').doc(doc.id).update({ slug });
    console.log(`  ✅ ${name} → ${slug}`);
    migrated++;
  }

  console.log(`  Thought Leaders: ${migrated} migrated, ${skipped} already had slugs`);
}

async function main() {
  console.log('🚀 Starting slug migration...');

  await migrateCompanies();
  await migrateThoughtLeaders();

  console.log('\n✨ Migration complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
