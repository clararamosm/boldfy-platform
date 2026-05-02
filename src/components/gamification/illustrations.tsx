// src/components/gamification/illustrations.tsx
// CSS-only animated illustrations for gamification modals.
// Three illustrations: PostStack, ConfettiExplosion, GiftBox.
'use client';

import React from 'react';
import './gamification-illustrations.css';

// ─── 1. Post Stack — Publications milestones ────────────────
// Cards stacked → spread → check + confetti

const PostCard = () => (
  <div className="gm-stack-card">
    <div className="gm-stack-card-header">
      <div className="gm-stack-card-avatar" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="gm-stack-card-line" />
        <div className="gm-stack-card-line" />
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="gm-stack-card-body-line" />
      <div className="gm-stack-card-body-line" />
      <div className="gm-stack-card-body-line" />
    </div>
  </div>
);

export function PostStackIllustration() {
  return (
    <div className="gm-stack-wrap">
      {Array.from({ length: 8 }).map((_, i) => (
        <PostCard key={i} />
      ))}
      {/* Central check */}
      <div className="gm-stack-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      {/* Confetti */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`c-${i}`} className="gm-stack-confetti" />
      ))}
    </div>
  );
}

// ─── 2. Confetti Explosion — Higher milestones ──────────────
// Badge with number + exploding confetti + rings

export function ConfettiExplosionIllustration({ number }: { number: number }) {
  return (
    <div className="gm-celebrate-wrap">
      {/* Background glow */}
      <div className="gm-celebrate-glow" />
      {/* Expanding rings */}
      <div className="gm-celebrate-ring" />
      <div className="gm-celebrate-ring" />
      {/* Confetti pieces (12) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={`cf-${i}`} className="gm-celebrate-confetti" />
      ))}
      {/* Central badge */}
      <div className="gm-celebrate-badge"><span>{number}</span></div>
    </div>
  );
}

// ─── 3. Gift Box — Reward redemption ────────────────────────
// Box shakes, lid opens, confetti bursts out

export function GiftBoxIllustration() {
  return (
    <div className="gm-gift-wrap">
      {/* Confetti from inside gift */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`gc-${i}`} className="gm-gift-confetti" />
      ))}
      {/* Gift box */}
      <div className="gm-gift-box">
        <div className="gm-gift-base" />
        <div className="gm-gift-lid" />
        <div className="gm-gift-bow" />
      </div>
    </div>
  );
}
