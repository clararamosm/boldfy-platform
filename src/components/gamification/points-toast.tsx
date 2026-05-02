// src/components/gamification/points-toast.tsx
// Gamification notification system — displays pending point toasts and conquest modals.
// Reads pendingNotifications from user doc and clears after display.
// Separate from the main toast system (use-toast.ts) to avoid conflicts.
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { doc, updateDoc, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { CoinIcon } from '@/components/coin-icon';
import { FileText, Trophy, BookOpen, Flame, Award, Zap, Heart, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConquestModal } from '@/components/gamification/conquest-modal';
import { LevelUpModal } from '@/components/gamification/level-up-modal';
import { completeOnboardingItem } from '@/hooks/use-onboarding';

// ─── Types ────────────────────────────────────────────────────

type PendingNotification = {
  type: 'points' | 'conquest' | 'levelUp' | 'congratulation';
  source?: 'publicacao' | 'trilha' | 'missao' | 'streak' | 'conquest' | 'extract' | 'congratulation';
  points?: number;
  description: string;
  createdAt: number;
  // Conquest-specific fields
  conquestId?: string;
  category?: string;
  target?: number;
  // Level-up specific fields
  level?: number;
  cyclesCompleted?: number;
  // Onboarding auto-complete
  onboardingItemId?: string;
};

type ToastItem = PendingNotification & {
  id: string;
  visible: boolean;
  exiting: boolean;
};

type ConquestQueueItem = {
  conquestId: string;
  category: string;
  target: number;
  points: number;
  onboardingItemId?: string;
};

type LevelUpQueueItem = {
  level: number;
  cyclesCompleted: number;
};

// ─── Source-specific config ───────────────────────────────────

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  publicacao: { icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
  missao: { icon: Trophy, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  trilha: { icon: BookOpen, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  streak: { icon: Flame, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  conquest: { icon: Award, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  extract: { icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  congratulation: { icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  resgate: { icon: Gift, color: 'text-primary', bgColor: 'bg-primary/10' },
};

const DEFAULT_CONFIG = { icon: CoinIcon, color: 'text-primary', bgColor: 'bg-primary/10' };

// ─── Single Toast ─────────────────────────────────────────────

function PointToast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const config = (item.source && SOURCE_CONFIG[item.source]) || DEFAULT_CONFIG;
  const IconComponent = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-lg max-w-[320px] w-full',
        'border-primary/20 shadow-primary/10',
        'transition-all duration-300 ease-out',
        item.visible && !item.exiting && 'animate-in slide-in-from-right fade-in',
        item.exiting && 'animate-out slide-out-to-right fade-out',
      )}
    >
      <div className={cn('flex-shrink-0 rounded-full p-2', config.bgColor)}>
        <IconComponent className={cn('h-5 w-5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
        {item.points != null && item.points !== 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <CoinIcon size="xs" />
            <span className={cn('text-xs font-semibold', item.points > 0 ? 'text-primary' : 'text-muted-foreground')}>
              {item.points > 0 ? `+${item.points} pts` : `${item.points} pts`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────
// Mounts in the colaborador layout and processes pending notifications.

export function GamificationToastProvider() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Conquest modal queue
  const [conquestQueue, setConquestQueue] = useState<ConquestQueueItem[]>([]);
  const [activeConquest, setActiveConquest] = useState<ConquestQueueItem | null>(null);

  // Level-up modal queue (shown after all conquest modals)
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpQueueItem[]>([]);
  const [activeLevelUp, setActiveLevelUp] = useState<LevelUpQueueItem | null>(null);

  // Track which notification createdAt timestamps we've already processed (dedupe)
  const processedIdsRef = useRef<Set<number>>(new Set());
  // Prevent concurrent processing
  const processingRef = useRef(false);

  // Process a batch of new notifications
  const processNotifications = useCallback((notifications: PendingNotification[], uid: string) => {
    if (notifications.length === 0) return;

    // Filter out already-processed notifications (dedupe by createdAt)
    const newNotifications = notifications.filter(n => !processedIdsRef.current.has(n.createdAt));
    if (newNotifications.length === 0) return;

    // Mark as processed
    for (const n of newNotifications) {
      processedIdsRef.current.add(n.createdAt);
    }

    // Sort by createdAt ascending so oldest shows first
    const sorted = [...newNotifications].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Separate conquest/levelUp notifications from point toasts
    const pointNotifications: PendingNotification[] = [];
    const newConquests: ConquestQueueItem[] = [];
    const newLevelUps: LevelUpQueueItem[] = [];

    for (const notification of sorted) {
      if (notification.type === 'conquest' && notification.conquestId && notification.category != null) {
        newConquests.push({
          conquestId: notification.conquestId,
          category: notification.category,
          target: notification.target || 0,
          points: notification.points || 50,
          onboardingItemId: notification.onboardingItemId,
        });
        // Also create a toast for the +50pts (shows alongside the modal)
        pointNotifications.push({
          ...notification,
          type: 'points', // override to show as regular toast
        });
      } else if (notification.type === 'levelUp' && notification.level != null) {
        newLevelUps.push({
          level: notification.level,
          cyclesCompleted: notification.cyclesCompleted || 0,
        });
      } else {
        pointNotifications.push(notification);
      }
    }

    // Queue conquest modals
    if (newConquests.length > 0) {
      setConquestQueue(prev => [...prev, ...newConquests]);
    }

    // Queue level-up modals (shown after conquest modals)
    if (newLevelUps.length > 0) {
      setLevelUpQueue(prev => [...prev, ...newLevelUps]);
    }

    // Stagger toasts with delay
    pointNotifications.forEach((notification, index) => {
      setTimeout(() => {
        setToasts(prev => [
          ...prev,
          {
            ...notification,
            id: `gamification-${Date.now()}-${index}`,
            visible: true,
            exiting: false,
          },
        ]);
      }, index * 600); // 600ms between each toast
    });

    // Handle onboarding auto-complete for conquest notifications
    for (const conquest of newConquests) {
      if (conquest.onboardingItemId) {
        completeOnboardingItem(uid, conquest.onboardingItemId)
          .catch(err => console.error('[GamificationToast] Failed to complete onboarding item:', err));
      }
    }

    // Handle onboarding auto-complete for point/other notifications (trail, reward, etc.)
    for (const notification of pointNotifications) {
      if (notification.onboardingItemId) {
        completeOnboardingItem(uid, notification.onboardingItemId)
          .catch(err => console.error('[GamificationToast] Failed to complete onboarding item:', err));
      }
    }

    // Clear only the processed notifications from Firestore (prevents race condition)
    updateDoc(doc(db, 'users', uid), {
      pendingNotifications: arrayRemove(...sorted),
    }).catch(err => console.error('[GamificationToast] Failed to clear notifications:', err));
  }, []);

  // Real-time listener for pendingNotifications
  useEffect(() => {
    if (!user?.uid) return;
    if (user.role !== 'colaborador') return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists() || processingRef.current) return;
      const data = snap.data();
      const notifications = data?.pendingNotifications as PendingNotification[] | undefined;
      if (!notifications || notifications.length === 0) return;

      processingRef.current = true;
      processNotifications(notifications, user.uid);
      // Allow processing again after a short delay (debounce rapid updates)
      setTimeout(() => { processingRef.current = false; }, 1000);
    });

    return () => unsub();
  }, [user?.uid, user?.role, processNotifications]);

  // Process conquest queue — show one at a time
  useEffect(() => {
    if (activeConquest || conquestQueue.length === 0) return;
    // Pop first conquest from queue
    const [next, ...rest] = conquestQueue;
    setActiveConquest(next);
    setConquestQueue(rest);
  }, [conquestQueue, activeConquest]);

  // Process level-up queue — show after all conquest modals are done
  useEffect(() => {
    if (activeLevelUp || levelUpQueue.length === 0) return;
    // Wait until all conquest modals are done
    if (activeConquest || conquestQueue.length > 0) return;
    const [next, ...rest] = levelUpQueue;
    setActiveLevelUp(next);
    setLevelUpQueue(rest);
  }, [levelUpQueue, activeLevelUp, activeConquest, conquestQueue]);

  const handleDismiss = useCallback((id: string) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove after exit animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const handleConquestClose = useCallback(() => {
    setActiveConquest(null);
    // Next conquest (if any) will be picked up by the useEffect above
  }, []);

  const handleLevelUpClose = useCallback(() => {
    setActiveLevelUp(null);
    // Next level-up (if any) will be picked up by the useEffect above
  }, []);

  // Only show max 3 toasts at a time
  const visibleToasts = toasts.slice(-3);

  return (
    <>
      {/* Point toasts */}
      {visibleToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {visibleToasts.map(item => (
            <PointToast key={item.id} item={item} onDismiss={handleDismiss} />
          ))}
        </div>
      )}

      {/* Conquest modal */}
      {activeConquest && (
        <ConquestModal
          open={true}
          onClose={handleConquestClose}
          conquestId={activeConquest.conquestId}
          category={activeConquest.category}
          target={activeConquest.target}
          points={activeConquest.points}
        />
      )}

      {/* Level-up modal */}
      {activeLevelUp && (
        <LevelUpModal
          open={true}
          onClose={handleLevelUpClose}
          level={activeLevelUp.level}
          cyclesCompleted={activeLevelUp.cyclesCompleted}
        />
      )}
    </>
  );
}
