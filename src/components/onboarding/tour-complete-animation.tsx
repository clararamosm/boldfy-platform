// src/components/onboarding/tour-complete-animation.tsx
// Full-screen celebration overlay shown when the page tour (or action checklist) is completed.
// CSS-only confetti — no external libraries. Auto-dismisses after 2.8s.
// Reusable: pass variant="tour" or variant="checklist" for different messages.

'use client';

import { useEffect, useState } from 'react';

type TourCompleteAnimationProps = {
  variant?: 'tour' | 'checklist';
  onDone: () => void; // Called after animation finishes
};

// Fixed confetti pieces config (deterministic, no random at render time)
const CONFETTI = [
  { left: '10%', delay: '0s',    dur: '2.2s', color: '#CD50F1', size: 8,  rotate: 15  },
  { left: '20%', delay: '0.1s',  dur: '2.5s', color: '#F1A450', size: 6,  rotate: -30 },
  { left: '30%', delay: '0.2s',  dur: '2.0s', color: '#50C8F1', size: 10, rotate: 45  },
  { left: '40%', delay: '0.05s', dur: '2.3s', color: '#F15090', size: 7,  rotate: -20 },
  { left: '50%', delay: '0.15s', dur: '2.6s', color: '#50F1A4', size: 9,  rotate: 60  },
  { left: '60%', delay: '0.3s',  dur: '2.1s', color: '#CD50F1', size: 6,  rotate: -45 },
  { left: '70%', delay: '0.0s',  dur: '2.4s', color: '#F1D050', size: 8,  rotate: 10  },
  { left: '80%', delay: '0.25s', dur: '2.2s', color: '#5066F1', size: 7,  rotate: -60 },
  { left: '90%', delay: '0.1s',  dur: '2.5s', color: '#F15050', size: 10, rotate: 30  },
  { left: '15%', delay: '0.4s',  dur: '2.3s', color: '#50F1D0', size: 6,  rotate: -15 },
  { left: '45%', delay: '0.35s', dur: '2.0s', color: '#F1A450', size: 9,  rotate: 50  },
  { left: '75%', delay: '0.2s',  dur: '2.6s', color: '#CD50F1', size: 7,  rotate: -35 },
];

export function TourCompleteAnimation({ variant = 'tour', onDone }: TourCompleteAnimationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  const title = variant === 'checklist'
    ? 'Onboarding completo! 🎉'
    : 'Tour concluído! 🎉';

  const subtitle = variant === 'checklist'
    ? 'Você está pronto pra decolar no LinkedIn!'
    : 'Agora você conhece a plataforma. Hora de agir!';

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(var(--rotate)); opacity: 1; }
          100% { transform: translateY(110vh) rotate(calc(var(--rotate) + 360deg)); opacity: 0; }
        }
        @keyframes celebPop {
          0%   { transform: scale(0.7) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes celebFadeOut {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          top: -16px;
          border-radius: 2px;
          animation: confettiFall var(--dur) var(--delay) ease-in forwards;
        }
        .celeb-card {
          animation: celebPop 0.5s cubic-bezier(.34,1.56,.64,1) forwards,
                     celebFadeOut 0.4s ease-in 2.3s forwards;
        }
      `}</style>

      {/* Confetti */}
      {CONFETTI.map((c, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: c.left,
            width: c.size,
            height: c.size * 1.6,
            backgroundColor: c.color,
            '--rotate': `${c.rotate}deg`,
            '--dur': c.dur,
            '--delay': c.delay,
          } as React.CSSProperties}
        />
      ))}

      {/* Center card */}
      <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
        <div className="celeb-card bg-white border border-border rounded-3xl shadow-[0_24px_64px_rgba(93,42,103,.18)] px-8 py-7 text-center max-w-[300px]">
          <div className="text-4xl mb-3">🎊</div>
          <h3 className="font-headline text-xl font-black text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </>
  );
}
