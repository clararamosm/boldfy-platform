'use client';

/**
 * DemographicsPanel — Exibição de dados demográficos da audiência.
 *
 * Layout:
 *   Linha 1 — grid 2×2 desktop (Cargo, Setor, Tamanho, Senioridade)
 *   Linha 2 — localidades em barra horizontal compacta (texto + %)
 *
 * Porcentagens sempre substituídas pelo upload mais recente (nunca média).
 */

import type { LinkedInDemographic } from '@/lib/linkedin-analytics-types';

interface DemographicsPanelProps {
  demographics: LinkedInDemographic[];
}

// Categorias principais — aparecem como cards de barras
const MAIN_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'Cargo',              label: 'Cargo',               color: '#6366f1' },
  { key: 'Setor',              label: 'Setor',               color: '#0ea5e9' },
  { key: 'Tamanho da empresa', label: 'Tamanho da empresa',  color: '#10b981' },
  { key: 'Senioridade',        label: 'Senioridade',         color: '#ec4899' },
];

// Categorias de localização — aparecem como linha compacta
const LOCATION_KEYS = ['Localização', 'País', 'Região'];

const TOP_N = 5;
const TOP_LOCATIONS = 6;

// ─── Bar chart card (Cargo, Setor, Tamanho, Senioridade) ─────

interface CategoryChartProps {
  label: string;
  items: LinkedInDemographic[];
  color: string;
}

function CategoryChart({ label, items, color }: CategoryChartProps) {
  const top = [...items]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, TOP_N);

  const maxPct = top[0]?.percentage ?? 100;

  if (!top.length) {
    return (
      <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 min-h-[140px]">
        <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-muted-foreground mt-2">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide">{label}</p>
      <div className="space-y-2.5">
        {top.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-xs text-foreground/80 truncate leading-tight" title={item.label}>
                {item.label}
              </span>
              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
                {item.percentage < 1 ? '<1%' : `${item.percentage % 1 === 0 ? item.percentage.toFixed(0) : item.percentage.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.percentage / maxPct) * 100}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Location row (Localização, País) ────────────────────────

function LocationRow({ itemsByKey }: { itemsByKey: Record<string, LinkedInDemographic[]> }) {
  // Mescla todos os itens de localização disponíveis
  const allItems = LOCATION_KEYS
    .flatMap(k => itemsByKey[k] ?? [])
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, TOP_LOCATIONS);

  if (!allItems.length) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide mb-3">
        Localização
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-[120px]">
            <span className="text-xs text-foreground/70 truncate flex-1" title={item.label}>
              {item.label}
            </span>
            <span className="text-xs font-semibold tabular-nums text-[#f59e0b] shrink-0">
              {item.percentage < 1 ? '<1%' : `${item.percentage % 1 === 0 ? item.percentage.toFixed(0) : item.percentage.toFixed(1)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function DemographicsPanel({ demographics }: DemographicsPanelProps) {
  if (!demographics.length) return null;

  // Agrupar por categoria
  const grouped: Record<string, LinkedInDemographic[]> = {};
  for (const d of demographics) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  // Categorias principais disponíveis (na ordem do config)
  const mainCharts = MAIN_CATEGORIES
    .filter(c => grouped[c.key]?.length)
    .map(c => ({ ...c, items: grouped[c.key] }));

  // Verifica se tem dados de localização
  const hasLocation = LOCATION_KEYS.some(k => grouped[k]?.length);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Audiência</h3>

      {/* Linha principal: Cargo, Setor, Tamanho, Senioridade — 2 col mobile, 4 col desktop */}
      {mainCharts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mainCharts.map(chart => (
            <CategoryChart
              key={chart.key}
              label={chart.label}
              items={chart.items}
              color={chart.color}
            />
          ))}
        </div>
      )}

      {/* Linha de localidades */}
      {hasLocation && <LocationRow itemsByKey={grouped} />}
    </div>
  );
}
