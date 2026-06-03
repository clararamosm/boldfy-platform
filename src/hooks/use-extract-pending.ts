// src/hooks/use-extract-pending.ts
// Source-of-truth check for whether the previous month's LinkedIn extract
// is still pending for a user. Reads the actual snapshot doc instead of
// trusting `linkedinSnapshotStatus.lastUploadMonth` on the user record —
// that flag has dessynchronized in real cases (e.g. a snapshot was created
// but the user-doc update racing it never landed, or the snapshot came
// from a seed/script that didn't touch the flag).
//
// Rule: the extract for month M is "available" starting day 1 of month
// M+1, and stays pending until a *monthly* snapshot with id "YYYY-MM"
// for that previous month exists under users/{uid}/linkedinSnapshots.
//
// IMPORTANT — only a `monthly` upload clears the pending state. A
// `historical` snapshot (the 12-month retroactive import done at
// onboarding) covers the same month but is partial: it feeds the trend
// charts, not the monthly KPIs/top-posts. Treating it as "done" was the
// real bug Clara hit — a user with a historical May snapshot never saw
// the banner to upload May's actual monthly extract. So a month whose
// only snapshot is `historical` is still pending.
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function getPreviousMonthId(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type ExtractPendingState = {
  pending: boolean;
  previousMonth: string;
  loading: boolean;
};

/**
 * Returns whether the user still owes last month's extract.
 * Subscribes to the snapshot doc so the banner reacts in real time — when
 * the upload action writes the snapshot the listener fires and `pending`
 * flips to false without any explicit refresh from the caller.
 */
export function useExtractPending(uid: string | undefined): ExtractPendingState {
  const previousMonth = getPreviousMonthId();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPending(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', uid, 'linkedinSnapshots', previousMonth),
      snap => {
        // Pending unless a *monthly* snapshot exists. A historical/partial
        // snapshot does NOT clear the reminder. `uploadType` undefined is
        // treated as 'monthly' for backward-compat with older docs that
        // predate the field (mirrors the `?? 'monthly'` default used in
        // the analytics dashboard).
        const uploadType = snap.exists() ? snap.data()?.uploadType : undefined;
        const hasMonthly = snap.exists() && uploadType !== 'historical';
        setPending(!hasMonthly);
        setLoading(false);
      },
      () => {
        // If the listener errors out we err on the side of *not* nagging.
        setPending(false);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid, previousMonth]);

  return { pending, previousMonth, loading };
}
