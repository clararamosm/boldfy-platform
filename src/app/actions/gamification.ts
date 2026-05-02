// src/app/actions/gamification.ts
// Gamification engine — Sprint 1: Publication points, Sprint 2: Conquests, Sprint 3: Streak + Levels
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf } from '@/lib/auth-guard';
import { getISOWeekId, getPreviousWeekId } from '@/lib/iso-week';
import { getLevelFromCycles, CONQUEST_LADDERS } from '@/lib/gamification-constants';

// ─── Constants ────────────────────────────────────────────────────
const PUBLICATION_POINTS = 30;
const CONQUEST_POINTS = 50;
const STREAK_WEEKS_PER_CYCLE = 7;
const STREAK_POSTS_REQUIRED = 3;

type ConquestCategory = 'pub' | 'trail' | 'mission' | 'seq';

// ─── Helper: find next uncompleted conquest ───────────────────────

function getNextConquest(category: string, completed: string[]): number | null {
  const ladder = CONQUEST_LADDERS[category];
  if (!ladder) return null;
  for (const target of ladder) {
    if (!completed.includes(`${category}_${target}`)) return target;
  }
  return null; // all completed in this category
}

// ─── Count totals per category (via pointsHistory / submissions) ──

async function countCategoryTotal(userId: string, category: ConquestCategory): Promise<number> {
  const userRef = adminDb.collection('users').doc(userId);

  switch (category) {
    case 'pub': {
      // Count publication entries in pointsHistory
      const snap = await userRef
        .collection('pointsHistory')
        .where('source', '==', 'publicacao')
        .get();
      return snap.size;
    }
    case 'trail': {
      // Count trail completion entries in pointsHistory
      const snap = await userRef
        .collection('pointsHistory')
        .where('source', '==', 'trilha')
        .get();
      return snap.size;
    }
    case 'mission': {
      // Count approved mission submissions across company
      const userDoc = await userRef.get();
      const companyId = userDoc.data()?.companyId;
      if (!companyId) return 0;

      const snap = await adminDb
        .collection('companies')
        .doc(companyId)
        .collection('missionSubmissions')
        .where('userId', '==', userId)
        .where('status', '==', 'approved')
        .get();
      return snap.size;
    }
    case 'seq': {
      // Streak-based: consecutive cycles × 7 gives consecutive weeks
      const uDoc = await userRef.get();
      const consecutiveCycles = (uDoc.data()?.streak?.consecutiveCyclesCompleted as number) || 0;
      return consecutiveCycles * 7;
    }
    default:
      return 0;
  }
}

// ─── Core: check and award conquests for a category ───────────────
// Called after points are awarded for publications, trails, missions.
// Fire-and-forget — never blocks the main flow.

export async function checkAndAwardConquests(
  userId: string,
  category: ConquestCategory
): Promise<void> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    if (userData?.role !== 'collaborator') return;

    // Get current conquests state
    const completed: string[] = userData?.conquests?.completed || [];
    const nextTarget = getNextConquest(category, completed);
    if (nextTarget === null) return; // all conquered

    // Count current total
    const total = await countCategoryTotal(userId, category);
    if (total < nextTarget) return; // not yet reached

    // Award conquest!
    const conquestId = `${category}_${nextTarget}`;
    const batch = adminDb.batch();

    // 1. Add to completed array
    batch.update(userRef, {
      'conquests.completed': FieldValue.arrayUnion(conquestId),
    });

    // 2. Record in pointsHistory
    const historyRef = userRef.collection('pointsHistory').doc();
    batch.set(historyRef, {
      description: `Conquista: ${conquestId}`,
      date: FieldValue.serverTimestamp(),
      points: CONQUEST_POINTS,
      type: 'gain',
      source: 'conquest',
    });

    // 3. Increment points
    batch.update(userRef, {
      points: FieldValue.increment(CONQUEST_POINTS),
    });

    // 4. Add pending notification (modal-type for conquests)
    const notification: Record<string, unknown> = {
      type: 'conquest',
      source: 'conquest',
      points: CONQUEST_POINTS,
      conquestId,
      category,
      target: nextTarget,
      description: `Conquista: ${conquestId}`,
      createdAt: Date.now(),
    };

    // If it's the first publication, flag for onboarding auto-complete
    if (conquestId === 'pub_1') {
      notification.onboardingItemId = 'first-publication';
    }

    batch.update(userRef, {
      pendingNotifications: FieldValue.arrayUnion(notification),
    });

    await batch.commit();

    console.log(`[Gamification] Conquest ${conquestId} awarded to user ${userId}`);
  } catch (error) {
    console.error(`[Gamification] checkAndAwardConquests failed for user ${userId}, category ${category}:`, error);
  }
}

// ─── Client-callable wrapper (requires auth) ─────────────────────
// Used by trail completion (runs client-side in use-trail-player.ts)

export async function checkConquestsFromClient(
  idToken: string,
  userId: string,
  category: ConquestCategory
): Promise<void> {
  await requireSelf(idToken, userId);
  await checkAndAwardConquests(userId, category);
}

// ─── Streak Engine ────────────────────────────────────────────────
// Processes streak logic each time a collaborator publishes a post.
// Fire-and-forget — called after awardPublicationPoints, never blocks publish flow.

type StreakData = {
  currentWeeks: number;
  lastCompletedWeek: string;
  postsThisWeek: number;
  currentWeekId: string;
  cyclesCompleted: number;
  consecutiveCyclesCompleted: number;
};

const DEFAULT_STREAK: StreakData = {
  currentWeeks: 0,
  lastCompletedWeek: '',
  postsThisWeek: 0,
  currentWeekId: '',
  cyclesCompleted: 0,
  consecutiveCyclesCompleted: 0,
};

async function processStreakOnPublication(userId: string): Promise<void> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    if (userData?.role !== 'collaborator') return;

    // Initialize streak from user doc (or defaults)
    const rawStreak = userData?.streak || {};
    const streak: StreakData = {
      currentWeeks: (rawStreak.currentWeeks as number) || 0,
      lastCompletedWeek: (rawStreak.lastCompletedWeek as string) || '',
      postsThisWeek: (rawStreak.postsThisWeek as number) || 0,
      currentWeekId: (rawStreak.currentWeekId as string) || '',
      cyclesCompleted: (rawStreak.cyclesCompleted as number) || 0,
      consecutiveCyclesCompleted: (rawStreak.consecutiveCyclesCompleted as number) || 0,
    };

    const nowWeekId = getISOWeekId(new Date());
    let weekJustCompleted = false;
    let cycleJustCompleted = false;

    // ── Step 1: Detect week transition ──
    if (streak.currentWeekId !== nowWeekId) {
      // New week detected — check continuity
      const previousWeek = getPreviousWeekId(nowWeekId);

      if (streak.lastCompletedWeek === previousWeek) {
        // Previous week was completed, streak continues
        streak.currentWeeks = streak.currentWeeks + 1;
      } else {
        // Streak broken — STRICT RESET
        streak.currentWeeks = 0;
        streak.consecutiveCyclesCompleted = 0;
      }

      streak.postsThisWeek = 1; // This publication is the first of the new week
      streak.currentWeekId = nowWeekId;
    } else {
      // Same week — just increment posts count
      streak.postsThisWeek = streak.postsThisWeek + 1;
    }

    // ── Step 2: Check if week is completed (3 posts threshold) ──
    if (
      streak.postsThisWeek >= STREAK_POSTS_REQUIRED &&
      streak.lastCompletedWeek !== nowWeekId
    ) {
      // Week completed!
      streak.lastCompletedWeek = nowWeekId;
      streak.currentWeeks = Math.max(streak.currentWeeks, 1); // At least week 1

      weekJustCompleted = true;

      // Calculate exponential bonus: 10 * 2^(week-1) → 10, 20, 40, 80, 160, 320, 640
      const bonus = 10 * Math.pow(2, streak.currentWeeks - 1);

      // ── Step 3: Build atomic batch ──
      const batch = adminDb.batch();

      // Record streak points in history
      const historyRef = userRef.collection('pointsHistory').doc();
      batch.set(historyRef, {
        description: `Streak semanal: semana ${streak.currentWeeks}`,
        date: FieldValue.serverTimestamp(),
        points: bonus,
        type: 'gain',
        source: 'streak',
      });

      // Increment user points + add notification
      batch.update(userRef, {
        points: FieldValue.increment(bonus),
        pendingNotifications: FieldValue.arrayUnion({
          type: 'points',
          source: 'streak',
          points: bonus,
          description: `Streak semanal: semana ${streak.currentWeeks}`,
          createdAt: Date.now(),
        }),
      });

      // ── Step 4: Check cycle completion ──
      if (streak.currentWeeks === STREAK_WEEKS_PER_CYCLE) {
        cycleJustCompleted = true;
        streak.cyclesCompleted += 1;
        streak.consecutiveCyclesCompleted += 1;
        streak.currentWeeks = 0; // Reset for next cycle

        // Check level up
        const newLevel = getLevelFromCycles(streak.cyclesCompleted);
        const oldLevel = (userData?.level?.current as number) || 1;

        if (newLevel > oldLevel) {
          batch.update(userRef, {
            'level.current': newLevel,
            'level.levelUpPending': true,
          });
          batch.update(userRef, {
            pendingNotifications: FieldValue.arrayUnion({
              type: 'levelUp',
              level: newLevel,
              cyclesCompleted: streak.cyclesCompleted,
              description: `Nivel ${newLevel}`,
              createdAt: Date.now(),
            }),
          });

          console.log(`[Gamification] Level up! User ${userId} → Level ${newLevel} (${streak.cyclesCompleted} cycles)`);
        }
      }

      // Write streak object back
      batch.update(userRef, { streak });

      await batch.commit();

      console.log(`[Gamification] Streak week ${streak.currentWeeks || STREAK_WEEKS_PER_CYCLE} completed for user ${userId}, bonus: ${bonus} pts`);
    } else {
      // Week not yet completed — just update streak fields (postsThisWeek, currentWeekId)
      await userRef.update({ streak });
    }

    // ── Step 5: Post-batch — check seq conquests if cycle completed ──
    if (cycleJustCompleted) {
      checkAndAwardConquests(userId, 'seq')
        .catch(err => console.error(`[Gamification] Seq conquest check failed for user ${userId}:`, err));
    }
  } catch (error) {
    console.error(`[Gamification] processStreakOnPublication failed for user ${userId}:`, error);
    // Never throw — streak should never block the publishing flow
  }
}

// ─── Congratulate — social recognition mechanic ──────────────────
// Allows a collaborator to congratulate a colleague for a conquest.
// Idempotent via doc ID `{fromUserId}_{conquestId}`.
// No points awarded — pure social recognition.

export async function sendCongratulation(
  idToken: string,
  fromUserId: string,
  toUserId: string,
  conquestId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSelf(idToken, fromUserId);

    // Block self-congratulation
    if (fromUserId === toUserId) {
      return { success: false, error: 'Você não pode se parabenizar.' };
    }

    // Verify both users exist and belong to the same company
    const [fromDoc, toDoc] = await Promise.all([
      adminDb.collection('users').doc(fromUserId).get(),
      adminDb.collection('users').doc(toUserId).get(),
    ]);

    if (!fromDoc.exists || !toDoc.exists) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const fromData = fromDoc.data()!;
    const toData = toDoc.data()!;

    if (fromData.companyId !== toData.companyId) {
      return { success: false, error: 'Usuários de empresas diferentes.' };
    }

    // Idempotency: check if already congratulated
    const congratDocId = `${fromUserId}_${conquestId}`;
    const congratRef = adminDb
      .collection('users').doc(toUserId)
      .collection('congratulations').doc(congratDocId);

    const existing = await congratRef.get();
    if (existing.exists) {
      return { success: false, error: 'Already congratulated.' };
    }

    const fromName = (fromData.profile?.name as string) || (fromData.name as string) || 'Alguém';

    // Atomic batch: create congratulation + add pending notification
    const batch = adminDb.batch();

    batch.set(congratRef, {
      fromUserId,
      fromName,
      conquestId,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Add notification to target user
    const toRef = adminDb.collection('users').doc(toUserId);
    batch.update(toRef, {
      pendingNotifications: FieldValue.arrayUnion({
        type: 'congratulation',
        source: 'congratulation',
        description: `${fromName} te parabenizou por uma conquista!`,
        fromName,
        conquestId,
        createdAt: Date.now(),
      }),
    });

    await batch.commit();

    console.log(`[Gamification] Congratulation sent: ${fromUserId} → ${toUserId} for ${conquestId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('[Gamification] sendCongratulation failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ─── Award points for LinkedIn publication ────────────────────────
// Called server-side by the publish-posts cron and publishToLinkedIn action.
// Does NOT require idToken — runs in trusted server context.

export async function awardPublicationPoints(
  userId: string,
  postId: string
): Promise<void> {
  try {
    // 1. Verify user is a collaborator (only collaborators earn gamification points)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    if (userData?.role !== 'collaborator') return;

    // 2. Idempotency check — prevent double-awarding for the same post
    const existingSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('pointsHistory')
      .where('source', '==', 'publicacao')
      .where('description', '==', `Publicação no LinkedIn | ${postId}`)
      .limit(1)
      .get();

    if (!existingSnap.empty) return;

    // 3. Atomic batch: pointsHistory + increment points + pending notification
    const batch = adminDb.batch();

    const historyRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('pointsHistory')
      .doc();

    batch.set(historyRef, {
      description: `Publicação no LinkedIn | ${postId}`,
      date: FieldValue.serverTimestamp(),
      points: PUBLICATION_POINTS,
      type: 'gain',
      source: 'publicacao',
    });

    const userRef = adminDb.collection('users').doc(userId);
    batch.update(userRef, {
      points: FieldValue.increment(PUBLICATION_POINTS),
      pendingNotifications: FieldValue.arrayUnion({
        type: 'points',
        source: 'publicacao',
        points: PUBLICATION_POINTS,
        description: 'Publicação no LinkedIn',
        createdAt: Date.now(),
      }),
    });

    await batch.commit();

    // 4. Check publication conquests (fire-and-forget)
    checkAndAwardConquests(userId, 'pub')
      .catch(err => console.error(`[Gamification] Conquest check failed after publication for user ${userId}:`, err));

    // 5. Process streak (fire-and-forget)
    processStreakOnPublication(userId)
      .catch(err => console.error(`[Gamification] Streak processing failed for user ${userId}:`, err));
  } catch (error) {
    console.error(`[Gamification] awardPublicationPoints failed for user ${userId}, post ${postId}:`, error);
    // Do not throw — gamification should never block the publishing flow
  }
}
