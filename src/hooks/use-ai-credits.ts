'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';

export interface AiCreditsData {
  remaining: number;
  bonusCredits: number;
  monthlyLimit: number;
  renewsAt: Date | null;
  totalUsed: number;
}

export function useAiCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<AiCreditsData>({
    remaining: 40,
    bonusCredits: 0,
    monthlyLimit: 40,
    renewsAt: null,
    totalUsed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        const ai = data?.aiCredits;
        if (ai) {
          const renewsAtRaw = ai.renewsAt;
          let renewsAtDate: Date | null = null;
          if (renewsAtRaw?.toDate) {
            renewsAtDate = renewsAtRaw.toDate();
          } else if (renewsAtRaw?.seconds) {
            renewsAtDate = new Date(renewsAtRaw.seconds * 1000);
          } else if (renewsAtRaw instanceof Date) {
            renewsAtDate = renewsAtRaw;
          }

          setCredits({
            remaining: ai.remaining ?? 0,
            bonusCredits: ai.bonusCredits ?? 0,
            monthlyLimit: ai.monthlyLimit ?? 40,
            renewsAt: renewsAtDate,
            totalUsed: ai.totalUsed ?? 0,
          });
        }
        setLoading(false);
      },
      () => {
        // Silently fail — non-critical
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Renovação é LAZY no servidor (ensureAndRenewCredits roda só ao gerar
  // conteúdo). Se a UI bloquear com base no doc cru — que ainda mostra
  // remaining:0 e renewsAt no passado — o usuário nunca consegue gerar e a
  // renovação nunca dispara (deadlock). Aqui refletimos o saldo EFETIVO:
  // se renewsAt já venceu, o usuário já tem direito ao limite mensal cheio.
  // O servidor reconcilia o doc na primeira geração.
  const renewalDue = credits.renewsAt != null && credits.renewsAt.getTime() <= Date.now();
  const effectiveRemaining = renewalDue ? credits.monthlyLimit : credits.remaining;

  const totalAvailable = effectiveRemaining + credits.bonusCredits;

  const daysUntilRenewal = credits.renewsAt
    ? Math.max(0, Math.ceil((credits.renewsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    ...credits,
    remaining: effectiveRemaining,
    totalAvailable,
    daysUntilRenewal,
    loading,
  };
}
