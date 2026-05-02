// src/app/actions/company-setup.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireMaster } from '@/lib/auth-guard';

// ─── Native Rewards Definitions ──────────────────────────────────────
// These rewards are automatically available in every company's store.
// Admins can toggle them off but cannot delete them.

export const NATIVE_REWARDS = [
  {
    name: '+10 créditos de IA',
    nameEn: '+10 AI credits',
    points: 100,
    type: 'ai_credits' as const,
    creditsAmount: 10,
  },
  {
    name: '+25 créditos de IA',
    nameEn: '+25 AI credits',
    points: 200,
    type: 'ai_credits' as const,
    creditsAmount: 25,
  },
  {
    name: '+50 créditos de IA',
    nameEn: '+50 AI credits',
    points: 350,
    type: 'ai_credits' as const,
    creditsAmount: 50,
  },
] as const;

// ─── Seed native rewards for a single company ───────────────────────
// Idempotent: skips if isNative rewards already exist.
// Called by inviteAdmin (new companies) and migration endpoint (existing ones).

export async function seedNativeRewards(companyId: string): Promise<{ created: number; skipped: boolean }> {
  const rewardsRef = adminDb.collection('companies').doc(companyId).collection('rewards');

  // Check if native rewards already exist
  const existingNative = await rewardsRef.where('isNative', '==', true).limit(1).get();
  if (!existingNative.empty) {
    return { created: 0, skipped: true };
  }

  // Also remove old isDefault reward (legacy single seed) if present
  const legacyDefault = await rewardsRef.where('isDefault', '==', true).get();

  const batch = adminDb.batch();

  // Remove legacy default rewards
  for (const doc of legacyDefault.docs) {
    batch.delete(doc.ref);
  }

  // Get company locale for reward names
  const companyDoc = await adminDb.collection('companies').doc(companyId).get();
  const locale = companyDoc.data()?.locale || 'pt-BR';

  // Create native rewards
  for (const reward of NATIVE_REWARDS) {
    const docRef = rewardsRef.doc();
    batch.set(docRef, {
      name: locale === 'en' ? reward.nameEn : reward.name,
      points: reward.points,
      type: reward.type,
      creditsAmount: reward.creditsAmount,
      stock: 'Ilimitado',
      status: 'Disponível',
      isNative: true,
      imageUrl: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return { created: NATIVE_REWARDS.length, skipped: false };
}

// ─── Migration endpoint: seed all existing companies ─────────────────
// Requires master auth. Run once via admin panel or script.

export async function migrateAllCompaniesNativeRewards(
  idToken: string
): Promise<{ total: number; created: number; skipped: number; errors: number }> {
  await requireMaster(idToken);

  const companiesSnap = await adminDb.collection('companies').get();
  const result = { total: companiesSnap.size, created: 0, skipped: 0, errors: 0 };

  for (const companyDoc of companiesSnap.docs) {
    try {
      const { created, skipped } = await seedNativeRewards(companyDoc.id);
      if (skipped) {
        result.skipped++;
      } else {
        result.created += created;
      }
    } catch (error) {
      console.error(`[Migration] Failed to seed native rewards for company ${companyDoc.id}:`, error);
      result.errors++;
    }
  }

  return result;
}
