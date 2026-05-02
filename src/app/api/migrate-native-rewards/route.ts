// src/app/api/migrate-native-rewards/route.ts
// One-time migration: seeds native AI-credit rewards for all existing companies.
// Call: POST /api/migrate-native-rewards with Authorization: Bearer <idToken>
// Requires master role.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireMaster } from '@/lib/auth-guard';
import { NATIVE_REWARDS } from '@/lib/native-rewards';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) {
      return NextResponse.json({ error: 'Token não fornecido.' }, { status: 401 });
    }

    await requireMaster(idToken);

    const companiesSnap = await db.collection('companies').get();
    const result = { total: companiesSnap.size, created: 0, skipped: 0, errors: 0 };

    for (const companyDoc of companiesSnap.docs) {
      try {
        const rewardsRef = db.collection('companies').doc(companyDoc.id).collection('rewards');

        // Check if native rewards already exist
        const existingNative = await rewardsRef.where('isNative', '==', true).limit(1).get();
        if (!existingNative.empty) {
          result.skipped++;
          continue;
        }

        // Get company locale for reward names
        const locale = companyDoc.data()?.locale || 'pt-BR';

        const batch = db.batch();

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
        result.created += NATIVE_REWARDS.length;
      } catch (error) {
        console.error(`[Migration] Failed to seed native rewards for company ${companyDoc.id}:`, error);
        result.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
