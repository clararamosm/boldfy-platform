// src/lib/stripe.ts
// Server-side Stripe instance — NEVER import this on the client.
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY env var is required.');
  }

  _stripe = new Stripe(key);

  return _stripe;
}

// ── Boldfy Pricing Tiers ──
// Per-seat pricing based on company size (monthly, BRL cents)

export interface PricingTier {
  name: string;
  minSeats: number;
  maxSeats: number | null; // null = unlimited (enterprise)
  pricePerSeatCents: number; // full price in BRL cents
  betaPricePerSeatCents: number; // 30% discount
}

export const PRICING_TIERS: PricingTier[] = [
  { name: 'Tier 1', minSeats: 5,  maxSeats: 10,  pricePerSeatCents: 49900, betaPricePerSeatCents: 34900 },
  { name: 'Tier 2', minSeats: 11, maxSeats: 20,  pricePerSeatCents: 44900, betaPricePerSeatCents: 31500 },
  { name: 'Tier 3', minSeats: 21, maxSeats: 40,  pricePerSeatCents: 39900, betaPricePerSeatCents: 27900 },
  { name: 'Tier 4', minSeats: 41, maxSeats: 70,  pricePerSeatCents: 34900, betaPricePerSeatCents: 24500 },
  // Tier 5 (70+) is enterprise — custom pricing
];

export function getTierForSeats(seats: number): PricingTier | null {
  return PRICING_TIERS.find(t => seats >= t.minSeats && (t.maxSeats === null || seats <= t.maxSeats)) || null;
}
