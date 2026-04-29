'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkedInDemographic } from '@/lib/linkedin-analytics-types';

interface DemographicsPanelProps {
  demographics: LinkedInDemographic[];
}

const CATEGORY_ORDER = ['Cargo', 'Setor', 'Tamanho da empresa'];

export function DemographicsPanel({ demographics }: DemographicsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');

  if (!demographics.length) return null;

  // Agrupar por categoria
  const grouped: Record<string, LinkedInDemographic[]> = {};
  for (const d of demographics) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  // Ordenar categorias
  const categories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const currentTab = activeTab || categories[0] || '';
  const items = (grouped[currentTab] ?? [])
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10);

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-semibold">Dados Demográficos</span>
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="border-t p-4 space-y-4">
          {/* Tabs de categoria */}
          <div className="flex gap-1 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  (activeTab || categories[0]) === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Barras horizontais */}
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/80 truncate max-w-[70%]">{item.label}</span>
                  <span className="text-muted-foreground font-medium">
                    {item.percentage < 1 ? '<1%' : `${item.percentage.toFixed(0)}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
