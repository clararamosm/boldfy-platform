'use client';

/**
 * DemographicsPanel — Exibição de dados demográficos da audiência.
 * Layout: grid responsivo (1 col mobile / 2 col tablet / 3 col desktop).
 * Cada célula é um gráfico de barras horizontais com top 5 itens da categoria.
 */

import type { LinkedInDemographic } from '@/lib/linkedin-analytics-types';

interface DemographicsPanelProps {
  demographics: LinkedInDemographic[];
}

const CATEGORY_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'Cargo',              label: 'Cargo',               color: '#6366f1' },
  { key: 'Setor',              label: 'Setor',               color: '#0ea5e9' },
  { key: 'Tamanho da empresa', label: 'Tamanho da empresa',  color: '#10b981' },
  { key: 'Localização',        label: 'Localização',         color: '#f59e0b' },
  { key: 'Senioridade',        label: 'Senioridade',         color: '#ec4899' },
  { key: 'País',               label: 'País',                color: '#8b5cf6' },
];

const TOP_N = 5;

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
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-muted-foreground mt-2">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{label}</p>
      <div className="space-y-2.5">
        {top.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-baseline gap-2">
              <span
                className="text-xs text-foreground/80 truncate leading-tight"
                title={item.label}
              >
                {item.label}
              </span>
              <span
                className="text-xs font-semibold tabular-nums shrink-0"
                style={{ color }}
              >
                {item.percentage < 1 ? '<1%' : `${item.percentage.toFixed(0)}%`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.percentage / maxPct) * 100}%`,
                  backgroundColor: color,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemographicsPanel({ demographics }: DemographicsPanelProps) {
  if (!demographics.length) return null;

  // Agrupar por categoria
  const grouped: Record<string, LinkedInDemographic[]> = {};
  for (const d of demographics) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  // Ordenar: categorias conhecidas primeiro (na ordem do config), depois extras
  const knownKeys = CATEGORY_CONFIG.map(c => c.key);
  const orderedKeys = [
    ...CATEGORY_CONFIG.filter(c => grouped[c.key]).map(c => c.key),
    ...Object.keys(grouped).filter(k => !knownKeys.includes(k)),
  ];

  const charts = orderedKeys.map(key => {
    const config = CATEGORY_CONFIG.find(c => c.key === key);
    return {
      key,
      label: config?.label ?? key,
      color: config?.color ?? '#64748b',
      items: grouped[key] ?? [],
    };
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Audiência</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {charts.map(chart => (
          <CategoryChart
            key={chart.key}
            label={chart.label}
            items={chart.items}
            color={chart.color}
          />
        ))}
      </div>
    </div>
  );
}
