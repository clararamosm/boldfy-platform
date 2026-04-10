// src/hooks/use-subscription.ts
// Real-time subscription status hook.
// Reads subscription data from company document and determines access level.
// Includes a client-side timer to catch trial expiry without waiting for Firestore changes.

'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SubscriptionStatus =
  | 'trialing'    // Free trial active
  | 'active'      // Paid subscription active
  | 'past_due'    // Payment failed, grace period
  | 'canceled'    // Canceled
  | 'expired'     // Trial ended, no payment
  | 'blocked';    // Should block access

export type SubscriptionData = {
  plan: string;       // 'trial' | 'beta' | 'paid' | 'canceled'
  status: SubscriptionStatus;
  totalLicenses: number;
  usedLicenses: number;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  tier: string;
  daysLeft: number;         // Days until trial/period expires
  isBlocked: boolean;       // Whether app should be blocked
  canAccessApp: boolean;    // Inverse of isBlocked for convenience
  loading: boolean;
};

// Statuses that always block access
const BLOCKED_STATUSES: string[] = ['canceled', 'expired', 'unpaid', 'incomplete_expired', 'past_due'];

// SECURE default: blocked until we know the real status
const BLOCKED_DEFAULT: SubscriptionData = {
  plan: 'unknown',
  status: 'blocked',
  totalLicenses: 0,
  usedLicenses: 0,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  stripeSubscriptionId: null,
  tier: '',
  daysLeft: 0,
  isBlocked: true,
  canAccessApp: false,
  loading: true,
};

function computeSubscription(sub: Record<string, unknown>): Omit<SubscriptionData, 'loading'> {
  const plan = (sub.plan as string) || 'trial';
  const status = (sub.status as string) || 'trialing';

  // Handle both Firestore Timestamps and plain dates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toDate = (v: any): Date | null => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    return new Date(v);
  };

  const trialEnd = toDate(sub.trialEnd);
  const currentPeriodEnd = toDate(sub.currentPeriodEnd);
  const now = new Date();

  // Calculate days left
  let daysLeft = 0;
  if (plan === 'trial' && trialEnd) {
    daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (currentPeriodEnd) {
    daysLeft = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Determine if blocked
  let isBlocked = false;

  // Trial expired and no active subscription
  if (plan === 'trial' && trialEnd && trialEnd < now) {
    isBlocked = true;
  }

  // No trialEnd at all and plan is trial = missing data, block to be safe
  if (plan === 'trial' && !trialEnd) {
    isBlocked = true;
  }

  // Explicitly blocked statuses (includes past_due now)
  if (BLOCKED_STATUSES.includes(status)) {
    isBlocked = true;
  }

  // Active subscription overrides trial expiry
  if (status === 'active') {
    isBlocked = false;
  }
  // If trialing and trial hasn't expired, don't block
  if (status === 'trialing' && trialEnd && trialEnd >= now) {
    isBlocked = false;
  }

  return {
    plan,
    status: isBlocked ? 'blocked' : (status as SubscriptionStatus),
    totalLicenses: (sub.totalLicenses as number) || 0,
    usedLicenses: (sub.usedLicenses as number) || 0,
    trialEnd,
    currentPeriodEnd,
    cancelAtPeriodEnd: (sub.cancelAtPeriodEnd as boolean) || false,
    stripeSubscriptionId: (sub.stripeSubscriptionId as string) || null,
    tier: (sub.tier as string) || '',
    daysLeft,
    isBlocked,
    canAccessApp: !isBlocked,
  };
}

export function useSubscription(companyId: string | undefined | null): SubscriptionData {
  const [data, setData] = useState<SubscriptionData>(BLOCKED_DEFAULT);
  const lastSubRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!companyId) {
      // No companyId = block (secure default). Don't grant free access.
      setData({ ...BLOCKED_DEFAULT, loading: false });
      return;
    }

    // Reset to loading when companyId changes
    setData(BLOCKED_DEFAULT);

    const unsub = onSnapshot(doc(db, 'companies', companyId), (snap) => {
      if (!snap.exists()) {
        setData({ ...BLOCKED_DEFAULT, loading: false });
        return;
      }

      const raw = snap.data();
      const sub = (raw.subscription || {}) as Record<string, unknown>;
      lastSubRef.current = sub;

      const computed = computeSubscription(sub);
      setData({ ...computed, loading: false });
    }, (error) => {
      console.error('useSubscription: Error:', error);
      // On error, keep blocked (secure default)
      setData({ ...BLOCKED_DEFAULT, loading: false });
    });

    return () => unsub();
  }, [companyId]);

  // Client-side timer: recheck every 60s to catch trial expiry in real-time
  // Without this, the gate only appears on Firestore doc changes or page refresh
  useEffect(() => {
    if (!companyId || data.loading) return;

    // Only relevant for trials approaching expiry
    if (data.plan !== 'trial' || !data.trialEnd) return;
    if (data.isBlocked) return; // Already blocked, no need to recheck

    const interval = setInterval(() => {
      if (lastSubRef.current) {
        const recomputed = computeSubscription(lastSubRef.current);
        setData(prev => {
          // Only update if blocking status changed
          if (prev.isBlocked !== recomputed.isBlocked || prev.daysLeft !== recomputed.daysLeft) {
            return { ...recomputed, loading: false };
          }
          return prev;
        });
      }
    }, 60_000); // Every 60 seconds

    return () => clearInterval(interval);
  }, [companyId, data.loading, data.plan, data.trialEnd, data.isBlocked]);

  return data;
}
