// src/lib/native-rewards.ts
// Native reward definitions — shared between server actions and API routes.
// Extracted from actions/company-setup.ts to avoid 'use server' restriction
// (Next.js 15 requires all exports from 'use server' files to be async).

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
