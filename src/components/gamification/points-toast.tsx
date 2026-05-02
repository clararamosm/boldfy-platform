// src/components/gamification/points-toast.tsx
// Gamification notification system — displays pending point toasts and conquest modals.
// Reads pendingNotifications from user doc and clears after display.
// Separate from the main toast system (use-toast.ts) to avoid conflicts.
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { CoinIcon } from '@/components/coin-icon';
import { FileText, Trophy, BookOpen, Flame, Award, Zap, Heart } from 'lucide-react';
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
        {item.points != null && item.points > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <CoinIcon size="xs" />
            <span className="text-xs font-semibold text-primary">+{item.points} pts</span>
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
  const [processed, setProcessed] = useState(false);

  // Conquest modal queue
  const [conquestQueue, setConquestQueue] = useState<ConquestQueueItem[]>([]);
  const [activeConquest, setActiveConquest] = useState<ConquestQueueItem | null>(null);

  // Level-up modal queue (shown after all conquest modals)
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpQueueItem[]>([]);
  const [activeLevelUp, setActiveLevelUp] = useState<LevelUpQueueItem | null>(null);

  // Read and process pendingNotifications once on mount
  useEffect(() => {
    if (!user?.uid || processed) return;
    if (user.role !== 'colaborador') return;

    const notifications = user.rawData?.pendingNotifications as PendingNotification[] | undefined;
    if (!notifications || notifications.length === 0) {
      setProcessed(true);
      return;
    }

    // Sort by createdAt ascending so oldest shows first
    const sorted = [...notifications].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Separate conquest/levelUp notifications from point toasts
    const pointNotifications: PendingNotification[] = [];
    const conquestNotifications: ConquestQueueItem[] = [];
    const levelUpNotifications: LevelUpQueueItem[] = [];

    for (const notification of sorted) {
      if (notification.type === 'conquest' && notification.conquestId && notification.category != null) {
        conquestNotifications.push({
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
        levelUpNotifications.push({
          level: notification.level,
          cyclesCompleted: notification.cyclesCompleted || 0,
        });
      } else {
        pointNotifications.push(notification);
      }
    }

    // Queue conquest modals
    if (conquestNotifications.length > 0) {
      setConquestQueue(conquestNotifications);
    }

    // Queue level-up modals (shown after conquest modals)
    if (levelUpNotifications.length > 0) {
      setLevelUpQueue(levelUpNotifications);
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
    for (const conquest of conquestNotifications) {
      if (conquest.onboardingItemId) {
        completeOnboardingItem(user.uid, conquest.onboardingItemId)
          .catch(err => console.error('[GamificationToast] Failed to complete onboarding item:', err));
      }
    }

    // Clear pendingNotifications from Firestore (fire-and-forget)
    updateDoc(doc(db, 'users', user.uid), { pendingNotifications: [] })
      .catch(err => console.error('[GamificationToast] Failed to clear notifications:', err));

    setProcessed(true);
  }, [user, processed]);

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
