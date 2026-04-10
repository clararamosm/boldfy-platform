// src/hooks/use-subscription.ts
// Real-time subscription status hook.
// Reads subscription data from company document and determines access level.

'use client';

import { useState, useEffect } from 'react';
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

const BLOCKED_STATUSES: string[] = ['canceled', 'expired', 'unpaid', 'incomplete_expired'];

export function useSubscription(companyId: string | undefined | null): SubscriptionData {
  const [data, setData] = useState<SubscriptionData>({
    plan: 'trial',
    status: 'trialing',
    totalLicenses: 0,
    usedLicenses: 0,
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
    tier: '',
    daysLeft: 30,
    isBlocked: false,
    canAccessApp: true,
    loading: true,
  });

  useEffect(() => {
    if (!companyId) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const unsub = onSnapshot(doc(db, 'companies', companyId), (snap) => {
      if (!snap.exists()) {
        setData(prev => ({ ...prev, loading: false, isBlocked: true, canAccessApp: false }));
        return;
      }

      const raw = snap.data();
      const sub = raw.subscription || {};

      const plan = sub.plan || 'trial';
      const status = sub.status || 'trialing';
      const trialEnd = sub.trialEnd?.toDate?.() || (sub.trialEnd ? new Date(sub.trialEnd) : null);
      const currentPeriodEnd = sub.currentPeriodEnd?.toDate?.() || (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null);

      const now = new Date();

      // Calculate days left
      let daysLeft = 30;
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

      // Explicitly blocked statuses
      if (BLOCKED_STATUSES.includes(status)) {
        isBlocked = true;
      }

      // Active subscription overrides trial expiry
      if (status === 'active' || status === 'trialing') {
        // If status is active (paid), never block
        if (status === 'active') {
          isBlocked = false;
        }
        // If trialing and trial hasn't expired, don't block
        if (status === 'trialing' && trialEnd && trialEnd >= now) {
          isBlocked = false;
        }
      }

      setData({
        plan,
        status: isBlocked ? 'blocked' : (status as SubscriptionStatus),
        totalLicenses: sub.totalLicenses || 0,
        usedLicenses: sub.usedLicenses || 0,
        trialEnd,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
        stripeSubscriptionId: sub.stripeSubscriptionId || null,
        tier: sub.tier || '',
        daysLeft,
        isBlocked,
        canAccessApp: !isBlocked,
        loading: false,
      });
    }, (error) => {
      console.error('useSubscription: Error:', error);
      setData(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, [companyId]);

  return data;
}
