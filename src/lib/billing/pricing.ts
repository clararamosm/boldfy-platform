// src/lib/billing/pricing.ts
// Tabelas de preco OFICIAIS da Boldfy. Espelho de /boldfy-site/src/components/proposal-builder.tsx
// server-only: NUNCA importe no cliente para calculos de cobranca.
// Valores em centavos BRL para evitar floats.

import 'server-only';

// ────────────────────────────────────────────────────────────
// PLATFORM TIERS (colaboradores, per-seat)
// ────────────────────────────────────────────────────────────

export interface PlatformTier {
  name: string;
  minSeats: number;
  maxSeats: number | null; // null = enterprise
  pricePerSeatCents: number;
  betaPricePerSeatCents: number;
}

export const PLATFORM_TIERS: readonly PlatformTier[] = Object.freeze([
  { name: 'Tier 1', minSeats: 5,  maxSeats: 10, pricePerSeatCents: 49900, betaPricePerSeatCents: 34900 },
  { name: 'Tier 2', minSeats: 11, maxSeats: 20, pricePerSeatCents: 44900, betaPricePerSeatCents: 31500 },
  { name: 'Tier 3', minSeats: 21, maxSeats: 40, pricePerSeatCents: 39900, betaPricePerSeatCents: 27900 },
  { name: 'Tier 4', minSeats: 41, maxSeats: 70, pricePerSeatCents: 34900, betaPricePerSeatCents: 24500 },
  // Tier 5 (70+) e enterprise e deve ser negociado manualmente
]);

export const PLATFORM_MIN_SEATS = 5;
export const PLATFORM_ENTERPRISE_THRESHOLD = 70;

/**
 * Retorna o tier apropriado para uma quantidade de seats.
 * Retorna null se seats for maior que o enterprise threshold
 * ou menor que o minimo.
 */
export function getPlatformTier(seats: number): PlatformTier | null {
  if (seats < PLATFORM_MIN_SEATS) return null;
  if (seats > PLATFORM_ENTERPRISE_THRESHOLD) return null;
  return PLATFORM_TIERS.find(
    (t) => seats >= t.minSeats && (t.maxSeats === null || seats <= t.maxSeats),
  ) ?? null;
}

/**
 * Calcula preco mensal total do modulo Platform.
 * Sempre retorna em centavos BRL.
 * Aplica desconto beta (30%) se isBeta=true.
 */
export function calculatePlatformMonthlyPriceCents(
  seats: number,
  isBeta: boolean,
): { tier: PlatformTier; totalCents: number } | null {
  const tier = getPlatformTier(seats);
  if (!tier) return null;
  const perSeat = isBeta ? tier.betaPricePerSeatCents : tier.pricePerSeatCents;
  return {
    tier,
    totalCents: perSeat * seats,
  };
}

// ────────────────────────────────────────────────────────────
// TL MATRIX (thought leaders, matriz executivos x frequencia)
// ────────────────────────────────────────────────────────────

export type TLFrequency = 2 | 3 | 4;
export type TLExecutiveCount = 1 | 2 | 3 | 4 | 5;

/**
 * Matriz de precos para TL. Sem desconto beta.
 * Valores em centavos BRL. Espelho do proposal-builder.tsx do site.
 */
export const TL_MATRIX: Readonly<Record<TLExecutiveCount, Readonly<Record<TLFrequency, number>>>> = Object.freeze({
  1: Object.freeze({ 2: 550000,  3: 770000,  4: 960000 }),
  2: Object.freeze({ 2: 900000,  3: 1260000, 4: 1570000 }),
  3: Object.freeze({ 2: 1200000, 3: 1680000, 4: 2090000 }),
  4: Object.freeze({ 2: 1520000, 3: 2130000, 4: 2650000 }),
  5: Object.freeze({ 2: 1800000, 3: 2520000, 4: 3140000 }),
});

export const TL_MAX_EXECUTIVES = 5;

/**
 * Calcula preco mensal do modulo TL com base em executivos e frequencia.
 * Retorna null se valores fora da matriz (> 5 executivos = enterprise).
 */
export function calculateTLMonthlyPriceCents(
  executives: number,
  frequency: number,
): number | null {
  if (executives < 1 || executives > TL_MAX_EXECUTIVES) return null;
  if (frequency !== 2 && frequency !== 3 && frequency !== 4) return null;
  const row = TL_MATRIX[executives as TLExecutiveCount];
  if (!row) return null;
  return row[frequency as TLFrequency] ?? null;
}

// ────────────────────────────────────────────────────────────
// DESIGN PACKS (add-on, fixos)
// ────────────────────────────────────────────────────────────

export type DesignPackId = 'starter' | 'growth' | 'scale';

export interface DesignPack {
  id: DesignPackId;
  label: string;
  piecesPerMonth: number;
  priceCents: number;
}

export const DESIGN_PACKS: Readonly<Record<DesignPackId, DesignPack>> = Object.freeze({
  starter: Object.freeze({ id: 'starter', label: 'Starter', piecesPerMonth: 4,  priceCents: 160000 }),
  growth:  Object.freeze({ id: 'growth',  label: 'Growth',  piecesPerMonth: 7,  priceCents: 280000 }),
  scale:   Object.freeze({ id: 'scale',   label: 'Scale',   piecesPerMonth: 10, priceCents: 360000 }),
});

export function getDesignPack(id: string | undefined | null): DesignPack | null {
  if (!id) return null;
  if (id === 'starter' || id === 'growth' || id === 'scale') {
    return DESIGN_PACKS[id];
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// BETA RULES
// ────────────────────────────────────────────────────────────

/** Desconto beta aplicavel apenas ao modulo Platform. */
export const BETA_DISCOUNT_PERCENT = 30;

/** Periodo de 7 dias entre ativacao e primeiro pagamento. */
export const FIRST_PAYMENT_DEADLINE_DAYS = 7;

export const FIRST_PAYMENT_DEADLINE_MS = FIRST_PAYMENT_DEADLINE_DAYS * 24 * 60 * 60 * 1000;

/** Formata centavos em BRL (R$ 1.234,56). Util para emails e logs. */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
