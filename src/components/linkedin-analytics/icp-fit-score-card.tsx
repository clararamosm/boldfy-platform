'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, RefreshCw, Target, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuthToken } from '@/lib/auth-client';
import { getIcpFitScore } from '@/app/actions/linkedin-analytics';
import type { IcpFitScore } from '@/lib/linkedin-analytics-types';

interface IcpFitScoreCardProps {
  userId: string;
  mesAno: string;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? '#10b981'  // verde
    : score >= 45 ? '#f59e0b' // amarelo
    : '#ef4444';              // vermelho

  const label =
    score >= 70 ? 'Alto fit'
    : score >= 45 ? 'Fit médio'
    : 'Baixo fit';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44" cy="44" r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="8"
          />
          <circle
            cx="44" cy="44" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-foreground leading-none">{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

function CategoryBar({
  category,
  score,
  insight,
  matchedLabels,
}: {
  category: string;
  score: number;
  insight: string;
  matchedLabels?: string[];
}) {
  const color =
    score >= 70 ? 'bg-emerald-500'
    : score >= 45 ? 'bg-amber-400'
    : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground/80">{category}</span>
        <span className="font-bold text-foreground">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">{insight}</p>
      {/* Labels que fizeram match — detalhe colapsável */}
      {matchedLabels && matchedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {matchedLabels.slice(0, 4).map(label => (
            <span
              key={label}
              className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full leading-tight"
            >
              {label}
            </span>
          ))}
          {matchedLabels.length > 4 && (
            <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5 leading-tight">
              +{matchedLabels.length - 4} mais
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function IcpFitScoreCard({ userId, mesAno }: IcpFitScoreCardProps) {
  const [score, setScore] = useState<IcpFitScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [noTargetAudience, setNoTargetAudience] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o score (do cache ou calcula pela primeira vez)
  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setNoTargetAudience(false);
    try {
      const token = await getAuthToken();
      const result = await getIcpFitScore(token, userId, mesAno, forceRefresh);
      if (result.noTargetAudience) {
        setNoTargetAudience(true);
      } else if (result.error) {
        setError(result.error);
      } else {
        setScore(result.score ?? null);
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [userId, mesAno]);

  // Carrega ao montar ou quando o mês muda — usa cache se disponível
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mesAno]);

  // Estado: calculando
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">
          {score ? 'Recalculando score...' : 'Calculando ICP-Fit Score...'}
        </p>
      </div>
    );
  }

  // Estado: sem targetAudience configurado
  if (noTargetAudience) {
    return (
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">ICP-Fit Score</h3>
        </div>
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            O campo <strong>Público-alvo / ICP</strong> no Brand Context não está preenchido.
            Peça ao time de estratégia para configurá-lo e então calcule o score.
          </p>
        </div>
      </div>
    );
  }

  // Estado: erro
  if (error) {
    return (
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">ICP-Fit Score</h3>
        </div>
        <p className="text-xs text-red-600">{error}</p>
        <Button size="sm" variant="outline" onClick={() => load(true)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Estado: score calculado
  if (!score) return null;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">ICP-Fit Score</h3>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
            determinístico
          </span>
        </div>
        {/* Botão de recalcular — força descarte do cache e nova extração */}
        <button
          onClick={() => load(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Recalcular (descarta cache)"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layout principal: ring + categorias */}
      <div className="flex gap-6 items-start">
        {/* Score ring */}
        <ScoreRing score={score.overall} />

        {/* Categorias */}
        <div className="flex-1 space-y-3">
          {score.categories.map(cat => (
            <CategoryBar
              key={cat.category}
              category={cat.category}
              score={cat.score}
              insight={cat.insight}
              matchedLabels={cat.matchedLabels}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-foreground/80 leading-relaxed">{score.summary}</p>
      </div>

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground/60 text-right">
        Calculado em {new Date(score.computedAt).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>
    </div>
  );
}
