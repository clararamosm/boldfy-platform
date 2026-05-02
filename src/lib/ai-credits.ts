// src/lib/ai-credits.ts
// Shared AI credit management: init, lazy renewal, check, consume.
// Used by server actions in content.ts.

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_MONTHLY_CREDITS = 40;

/** 1st of next month at 00:00 UTC */
function getNextRenewalDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export type AiCreditsState = {
  remaining: number;
  bonusCredits: number;
  monthlyLimit: number;
  totalUsed: number;
  renewsAt: Date | null;
};

type FirestoreTimestamp = {
  toMillis?: () => number;
  _seconds?: number;
  seconds?: number;
};

/**
 * Ensures the user has an aiCredits field, performs lazy monthly renewal
 * (reset to monthlyLimit — credits do NOT accumulate), and returns
 * the current credit state.
 */
export async function ensureAndRenewCredits(userId: string): Promise<AiCreditsState> {
  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  let aiCredits = userData?.aiCredits as {
    remaining: number;
    bonusCredits: number;
    monthlyLimit: number;
    renewsAt: FirestoreTimestamp | null;
    totalUsed: number;
  } | undefined;

  // Initialize credits if user has none yet
  if (!aiCredits) {
    const nextRenewal = getNextRenewalDate();
    aiCredits = {
      remaining: DEFAULT_MONTHLY_CREDITS,
      bonusCredits: 0,
      monthlyLimit: DEFAULT_MONTHLY_CREDITS,
      renewsAt: null,
      totalUsed: 0,
    };
    await userRef.update({
      aiCredits: {
        remaining: DEFAULT_MONTHLY_CREDITS,
        bonusCredits: 0,
        monthlyLimit: DEFAULT_MONTHLY_CREDITS,
        renewsAt: nextRenewal,
        totalUsed: 0,
      },
    });
    return {
      remaining: DEFAULT_MONTHLY_CREDITS,
      bonusCredits: 0,
      monthlyLimit: DEFAULT_MONTHLY_CREDITS,
      totalUsed: 0,
      renewsAt: nextRenewal,
    };
  }

  // Parse renewsAt timestamp
  const renewsAtMs = aiCredits.renewsAt?.toMillis?.()
    ?? (aiCredits.renewsAt as FirestoreTimestamp)?._seconds
      ? ((aiCredits.renewsAt as FirestoreTimestamp)._seconds as number) * 1000
      : (aiCredits.renewsAt as FirestoreTimestamp)?.seconds
        ? ((aiCredits.renewsAt as FirestoreTimestamp).seconds as number) * 1000
        : null;

  // Lazy renewal: if renewsAt has passed, RESET monthly credits to monthlyLimit
  // Monthly credits DO NOT accumulate — leftover credits are lost.
  if (renewsAtMs && Date.now() >= renewsAtMs) {
    const newRemaining = aiCredits.monthlyLimit || DEFAULT_MONTHLY_CREDITS;
    const nextRenewal = getNextRenewalDate();
    await userRef.update({
      'aiCredits.remaining': newRemaining,
      'aiCredits.renewsAt': nextRenewal,
    });
    return {
      remaining: newRemaining,
      bonusCredits: aiCredits.bonusCredits || 0,
      monthlyLimit: aiCredits.monthlyLimit || DEFAULT_MONTHLY_CREDITS,
      totalUsed: aiCredits.totalUsed || 0,
      renewsAt: nextRenewal,
    };
  }

  return {
    remaining: aiCredits.remaining ?? 0,
    bonusCredits: aiCredits.bonusCredits ?? 0,
    monthlyLimit: aiCredits.monthlyLimit ?? DEFAULT_MONTHLY_CREDITS,
    totalUsed: aiCredits.totalUsed ?? 0,
    renewsAt: renewsAtMs ? new Date(renewsAtMs) : null,
  };
}

/**
 * Check if user has at least 1 credit available (remaining + bonusCredits).
 * Returns `{ ok: true }` or `{ ok: false, error: string }`.
 */
export function checkCreditsAvailable(credits: AiCreditsState): { ok: true } | { ok: false; error: string } {
  const total = credits.remaining + credits.bonusCredits;
  if (total > 0) return { ok: true };

  const daysUntilRenewal = credits.renewsAt
    ? Math.max(1, Math.ceil((credits.renewsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const msg = daysUntilRenewal
    ? `Seus créditos de IA acabaram. Eles renovam em ${daysUntilRenewal} dia${daysUntilRenewal !== 1 ? 's' : ''}. Você também pode trocar pontos por mais créditos na loja de recompensas.`
    : 'Seus créditos de IA acabaram. Você pode trocar pontos por mais créditos na loja de recompensas.';

  return { ok: false, error: msg };
}

/**
 * Consume 1 AI credit. First from monthly `remaining`, then from `bonusCredits`.
 * Also increments `totalUsed`.
 */
export async function consumeCredit(userId: string, credits: AiCreditsState): Promise<void> {
  const userRef = adminDb.collection('users').doc(userId);
  const updateData: Record<string, unknown> = {
    'aiCredits.totalUsed': FieldValue.increment(1),
  };
  if (credits.remaining > 0) {
    updateData['aiCredits.remaining'] = FieldValue.increment(-1);
  } else {
    updateData['aiCredits.bonusCredits'] = FieldValue.increment(-1);
  }
  await userRef.update(updateData);
}
