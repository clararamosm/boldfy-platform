// src/lib/reward-suggestions.ts
// Static curated reward suggestions for the admin popup (sections 7.1-7.3 of the gamification plan).
// No 'use server' or 'use client' — importable in both.

export type RewardSuggestion = {
  name: string;
  category: 'micro' | 'medium' | 'aspirational';
  suggestedPoints: number;
  realValue: string;
  whereToBuy: string;
  whereToBuyUrl?: string;
  delivery: 'code' | 'manual';
};

export const REWARD_SUGGESTIONS: RewardSuggestion[] = [
  // ── Micro-rewards (high frequency, easy to redeem) ──────────────
  {
    name: 'Cupom iFood R$25',
    category: 'micro',
    suggestedPoints: 500,
    realValue: 'R$25',
    whereToBuy: 'Card Store, Amazon BR',
    whereToBuyUrl: 'https://www.cardstore.com.br/',
    delivery: 'code',
  },
  {
    name: 'Cupom iFood R$50',
    category: 'micro',
    suggestedPoints: 900,
    realValue: 'R$50',
    whereToBuy: 'Card Store, Amazon BR',
    whereToBuyUrl: 'https://www.cardstore.com.br/',
    delivery: 'code',
  },
  {
    name: 'Assinatura Spotify 1 mês',
    category: 'micro',
    suggestedPoints: 350,
    realValue: '~R$22',
    whereToBuy: 'Card Store',
    whereToBuyUrl: 'https://www.cardstore.com.br/cartao-presente-gift-card-spotify-1-mes',
    delivery: 'code',
  },
  {
    name: 'Assinatura Spotify 3 meses',
    category: 'micro',
    suggestedPoints: 900,
    realValue: '~R$65',
    whereToBuy: 'Card Store',
    whereToBuyUrl: 'https://www.cardstore.com.br/cartao-presente-gift-card-spotify-3-meses',
    delivery: 'code',
  },
  {
    name: 'Vale Netflix R$35',
    category: 'micro',
    suggestedPoints: 700,
    realValue: 'R$35',
    whereToBuy: 'Gift Card Online, Full Cards',
    whereToBuyUrl: 'https://www.giftcardonline.com.br/',
    delivery: 'code',
  },
  {
    name: 'Ingresso cinema R$35',
    category: 'micro',
    suggestedPoints: 700,
    realValue: '~R$35',
    whereToBuy: 'Ingresso.com',
    whereToBuyUrl: 'https://www.ingresso.com/',
    delivery: 'code',
  },

  // ── Medium rewards (consistent engagement) ──────────────────────
  {
    name: 'Vale Amazon R$50',
    category: 'medium',
    suggestedPoints: 1000,
    realValue: 'R$50',
    whereToBuy: 'Amazon BR',
    whereToBuyUrl: 'https://www.amazon.com.br',
    delivery: 'code',
  },
  {
    name: 'Vale Amazon R$100',
    category: 'medium',
    suggestedPoints: 1800,
    realValue: 'R$100',
    whereToBuy: 'Amazon BR',
    whereToBuyUrl: 'https://www.amazon.com.br',
    delivery: 'code',
  },
  {
    name: 'Vale Renner R$100',
    category: 'medium',
    suggestedPoints: 1800,
    realValue: 'R$100',
    whereToBuy: 'Card Store, Carpe Diem XP',
    whereToBuyUrl: 'https://www.cardstore.com.br/',
    delivery: 'code',
  },
  {
    name: 'Vale Hering R$100',
    category: 'medium',
    suggestedPoints: 1800,
    realValue: 'R$100',
    whereToBuy: 'Hering, Carpe Diem XP',
    whereToBuyUrl: 'https://cartaopresente.hering.com.br/',
    delivery: 'code',
  },
  {
    name: 'Kit/brinde da empresa',
    category: 'medium',
    suggestedPoints: 1500,
    realValue: 'Variável',
    whereToBuy: 'Interno',
    delivery: 'manual',
  },
  {
    name: 'Crédito cartão de benefícios R$50',
    category: 'medium',
    suggestedPoints: 1000,
    realValue: 'R$50',
    whereToBuy: 'Pluxee, Caju ou Flash',
    whereToBuyUrl: 'https://www.pluxee.com.br/',
    delivery: 'manual',
  },

  // ── Aspirational rewards (long-term, high value) ────────────────
  {
    name: 'Crédito cartão de benefícios R$200',
    category: 'aspirational',
    suggestedPoints: 3500,
    realValue: 'R$200',
    whereToBuy: 'Pluxee, Caju ou Flash',
    whereToBuyUrl: 'https://www.pluxee.com.br/',
    delivery: 'manual',
  },
  {
    name: 'Curso ou certificação online',
    category: 'aspirational',
    suggestedPoints: 5000,
    realValue: 'R$300-500',
    whereToBuy: 'Udemy, Coursera, Alura',
    whereToBuyUrl: 'https://www.udemy.com/',
    delivery: 'manual',
  },
  {
    name: 'Day off',
    category: 'aspirational',
    suggestedPoints: 10000,
    realValue: '~R$300 (dia útil)',
    whereToBuy: 'Interno (RH)',
    delivery: 'manual',
  },
  {
    name: 'Experiência (jantar, spa, etc.)',
    category: 'aspirational',
    suggestedPoints: 7000,
    realValue: 'R$200-400',
    whereToBuy: 'Carpe Diem XP',
    whereToBuyUrl: 'https://www.carpediemxp.com/',
    delivery: 'code',
  },
  {
    name: 'Viagem (passagem Buser)',
    category: 'aspirational',
    suggestedPoints: 4000,
    realValue: 'R$80-200',
    whereToBuy: 'PicPay, Flash Pay',
    delivery: 'code',
  },
];
