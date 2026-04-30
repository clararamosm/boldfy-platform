'use client';

/**
 * DemographicsPanel — Exibição de dados demográficos da audiência.
 *
 * Layout 3 colunas (desktop):
 *   Col 1 — Cargo + Senioridade
 *   Col 2 — Setor + Tamanho da empresa
 *   Col 3 — Mapa SVG do Brasil com bolhas por estado/cidade
 *
 * "Empresas" removido completamente.
 */

import type { LinkedInDemographic } from '@/lib/linkedin-analytics-types';

interface DemographicsPanelProps {
  demographics: LinkedInDemographic[];
}

// Categorias principais — aparecem como cards de barras
const COL1_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'Cargo',       label: 'Cargo',       color: '#6366f1' },
  { key: 'Senioridade', label: 'Senioridade',  color: '#ec4899' },
];

const COL2_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'Setor',              label: 'Setor',               color: '#0ea5e9' },
  { key: 'Tamanho da empresa', label: 'Tamanho da empresa',  color: '#10b981' },
];

// Categorias de localização — alimentam o mapa
const LOCATION_KEYS = ['Localização', 'País', 'Região', 'Localidade'];

// Categorias a ignorar completamente
const IGNORED_CATEGORIES = new Set(['Empresas', 'Empresa', 'Company']);

const TOP_N = 5;
const TOP_MAP = 10;

// ─── Bar chart card ──────────────────────────────────────────

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
      <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 min-h-[120px]">
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

// ─── Brazil SVG Map ───────────────────────────────────────────
//
// ViewBox: 0 0 600 660
// States mapped to approximate centroids (x, y) within that viewbox.
// LinkedIn Analytics typically returns cities or states like
// "São Paulo", "Rio de Janeiro", "Minas Gerais", "São Paulo, SP", etc.

// State / City → [cx, cy] centroid in the Brazil SVG viewbox
const BR_LOCATIONS: Record<string, [number, number]> = {
  // States (by name and abbreviation variants)
  'Acre':                 [62,  195],
  'AC':                   [62,  195],
  'Alagoas':              [462, 265],
  'AL':                   [462, 265],
  'Amapá':                [320, 108],
  'AP':                   [320, 108],
  'Amazonas':             [145, 175],
  'AM':                   [145, 175],
  'Bahia':                [410, 300],
  'BA':                   [410, 300],
  'Ceará':                [430, 200],
  'CE':                   [430, 200],
  'Distrito Federal':     [345, 375],
  'DF':                   [345, 375],
  'Brasília':             [345, 375],
  'Espírito Santo':       [425, 405],
  'ES':                   [425, 405],
  'Goiás':                [318, 370],
  'GO':                   [318, 370],
  'Maranhão':             [355, 195],
  'MA':                   [355, 195],
  'Mato Grosso':          [240, 295],
  'MT':                   [240, 295],
  'Mato Grosso do Sul':   [275, 420],
  'MS':                   [275, 420],
  'Minas Gerais':         [375, 395],
  'MG':                   [375, 395],
  'Pará':                 [248, 175],
  'PA':                   [248, 175],
  'Paraíba':              [465, 225],
  'PB':                   [465, 225],
  'Paraná':               [318, 475],
  'PR':                   [318, 475],
  'Pernambuco':           [450, 240],
  'PE':                   [450, 240],
  'Piauí':                [395, 215],
  'PI':                   [395, 215],
  'Rio de Janeiro':       [408, 435],
  'RJ':                   [408, 435],
  'Rio Grande do Norte':  [468, 210],
  'RN':                   [468, 210],
  'Rio Grande do Sul':    [298, 535],
  'RS':                   [298, 535],
  'Rondônia':             [135, 265],
  'RO':                   [135, 265],
  'Roraima':              [195, 90],
  'RR':                   [195, 90],
  'Santa Catarina':       [330, 510],
  'SC':                   [330, 510],
  'São Paulo':            [352, 455],
  'SP':                   [352, 455],
  'Sergipe':              [455, 270],
  'SE':                   [455, 270],
  'Tocantins':            [330, 270],
  'TO':                   [330, 270],
  // Major cities (common in LinkedIn location data)
  'São Paulo, SP':        [352, 455],
  'Rio de Janeiro, RJ':   [408, 435],
  'Belo Horizonte':       [382, 400],
  'Belo Horizonte, MG':   [382, 400],
  'Brasília, DF':         [345, 375],
  'Curitiba':             [330, 478],
  'Curitiba, PR':         [330, 478],
  'Porto Alegre':         [302, 540],
  'Porto Alegre, RS':     [302, 540],
  'Salvador':             [432, 308],
  'Salvador, BA':         [432, 308],
  'Fortaleza':            [432, 195],
  'Fortaleza, CE':        [432, 195],
  'Recife':               [462, 242],
  'Recife, PE':           [462, 242],
  'Manaus':               [148, 168],
  'Manaus, AM':           [148, 168],
  'Campinas':             [358, 458],
  'Campinas, SP':         [358, 458],
  'Goiânia':              [320, 370],
  'Goiânia, GO':          [320, 370],
  'Florianópolis':        [335, 518],
  'Florianópolis, SC':    [335, 518],
  'Natal':                [472, 208],
  'Natal, RN':            [472, 208],
  'Maceió':               [463, 263],
  'Maceió, AL':           [463, 263],
  'Belém':                [262, 155],
  'Belém, PA':            [262, 155],
  'Teresina':             [393, 212],
  'Teresina, PI':         [393, 212],
  'Campo Grande':         [275, 422],
  'Campo Grande, MS':     [275, 422],
  'João Pessoa':          [468, 228],
  'João Pessoa, PB':      [468, 228],
  'Aracaju':              [456, 272],
  'Aracaju, SE':          [456, 272],
  'Cuiabá':               [238, 292],
  'Cuiabá, MT':           [238, 292],
  'Macapá':               [322, 102],
  'Macapá, AP':           [322, 102],
  'Porto Velho':          [130, 262],
  'Porto Velho, RO':      [130, 262],
  'Boa Vista':            [193, 88],
  'Boa Vista, RR':        [193, 88],
  'Rio Branco':           [62, 192],
  'Rio Branco, AC':       [62, 192],
  'Palmas':               [330, 265],
  'Palmas, TO':           [330, 265],
};

// Simplified Brazil state outlines (equirectangular approximation, viewBox 0 0 600 660)
// These are simplified polygon shapes for each state — good enough as backdrop
const BRAZIL_STATES: { d: string; state: string }[] = [
  // Acre (AC)
  { state: 'AC', d: 'M 30,178 L 65,172 L 95,175 L 98,205 L 80,218 L 50,215 L 30,200 Z' },
  // Amazonas (AM)
  { state: 'AM', d: 'M 95,95 L 185,88 L 230,100 L 235,155 L 220,185 L 195,200 L 170,215 L 130,220 L 100,210 L 85,190 L 82,160 L 90,130 Z' },
  // Roraima (RR)
  { state: 'RR', d: 'M 155,55 L 210,48 L 235,65 L 240,95 L 215,105 L 190,108 L 162,100 L 148,78 Z' },
  // Pará (PA)
  { state: 'PA', d: 'M 185,88 L 265,78 L 310,85 L 325,110 L 320,145 L 295,175 L 265,188 L 235,185 L 215,165 L 205,145 L 195,120 L 185,105 Z' },
  // Amapá (AP)
  { state: 'AP', d: 'M 290,72 L 325,68 L 342,80 L 338,115 L 318,120 L 298,112 L 285,95 Z' },
  // Maranhão (MA)
  { state: 'MA', d: 'M 320,145 L 360,135 L 395,145 L 400,170 L 385,198 L 360,208 L 330,205 L 308,190 L 300,168 L 305,152 Z' },
  // Piauí (PI)
  { state: 'PI', d: 'M 385,155 L 415,150 L 432,162 L 430,192 L 415,218 L 395,225 L 372,218 L 360,200 L 365,178 L 372,162 Z' },
  // Ceará (CE)
  { state: 'CE', d: 'M 415,148 L 450,145 L 465,158 L 462,180 L 450,200 L 432,208 L 415,200 L 408,182 L 408,162 Z' },
  // Rio Grande do Norte (RN)
  { state: 'RN', d: 'M 450,145 L 482,140 L 492,155 L 488,178 L 472,188 L 452,182 L 445,165 Z' },
  // Paraíba (PB)
  { state: 'PB', d: 'M 450,185 L 480,180 L 490,190 L 485,208 L 468,215 L 450,210 L 440,198 Z' },
  // Pernambuco (PE)
  { state: 'PE', d: 'M 415,200 L 462,195 L 475,205 L 472,222 L 455,232 L 428,235 L 410,225 L 406,210 Z' },
  // Alagoas (AL)
  { state: 'AL', d: 'M 452,230 L 475,225 L 480,238 L 472,252 L 455,255 L 442,245 L 440,232 Z' },
  // Sergipe (SE)
  { state: 'SE', d: 'M 440,248 L 460,244 L 468,255 L 465,270 L 450,275 L 436,268 L 432,255 Z' },
  // Bahia (BA)
  { state: 'BA', d: 'M 325,205 L 398,195 L 440,210 L 452,248 L 448,282 L 440,315 L 422,335 L 400,345 L 375,340 L 355,325 L 340,305 L 325,280 L 315,255 L 318,228 Z' },
  // Tocantins (TO)
  { state: 'TO', d: 'M 295,185 L 320,180 L 348,190 L 362,210 L 368,238 L 365,268 L 350,292 L 330,302 L 308,295 L 292,278 L 285,255 L 285,225 L 288,202 Z' },
  // Rondônia (RO)
  { state: 'RO', d: 'M 88,215 L 130,208 L 162,215 L 175,240 L 172,275 L 155,292 L 125,295 L 98,285 L 82,265 L 82,238 Z' },
  // Mato Grosso (MT)
  { state: 'MT', d: 'M 155,212 L 220,208 L 265,218 L 290,232 L 302,260 L 298,300 L 280,318 L 252,325 L 220,322 L 192,308 L 168,290 L 155,268 L 148,242 Z' },
  // Goiás (GO)
  { state: 'GO', d: 'M 285,262 L 325,255 L 360,268 L 375,290 L 378,318 L 368,348 L 348,362 L 322,365 L 298,355 L 278,338 L 268,315 L 268,288 Z' },
  // Minas Gerais (MG)
  { state: 'MG', d: 'M 340,310 L 385,302 L 425,310 L 445,330 L 448,362 L 438,392 L 415,410 L 388,415 L 358,410 L 335,398 L 315,378 L 308,352 L 312,328 Z' },
  // Mato Grosso do Sul (MS)
  { state: 'MS', d: 'M 220,325 L 270,320 L 300,335 L 312,360 L 310,400 L 295,428 L 268,445 L 240,442 L 218,428 L 205,405 L 200,378 L 205,350 Z' },
  // Distrito Federal (DF)
  { state: 'DF', d: 'M 337,368 L 355,365 L 358,378 L 352,388 L 336,388 L 330,376 Z' },
  // Espírito Santo (ES)
  { state: 'ES', d: 'M 430,368 L 448,362 L 455,378 L 452,405 L 438,418 L 420,415 L 412,400 L 415,380 Z' },
  // Rio de Janeiro (RJ)
  { state: 'RJ', d: 'M 375,415 L 412,408 L 432,418 L 435,438 L 420,450 L 398,452 L 378,442 L 368,428 Z' },
  // São Paulo (SP)
  { state: 'SP', d: 'M 295,398 L 362,392 L 398,405 L 408,428 L 405,458 L 385,472 L 355,478 L 325,472 L 298,458 L 282,438 L 282,415 Z' },
  // Paraná (PR)
  { state: 'PR', d: 'M 258,442 L 318,435 L 358,445 L 368,465 L 360,492 L 335,502 L 305,498 L 275,488 L 252,472 L 245,455 Z' },
  // Santa Catarina (SC)
  { state: 'SC', d: 'M 285,498 L 340,492 L 360,500 L 362,522 L 345,535 L 318,538 L 295,530 L 278,515 Z' },
  // Rio Grande do Sul (RS)
  { state: 'RS', d: 'M 265,530 L 318,522 L 358,532 L 370,558 L 360,585 L 335,600 L 302,602 L 272,590 L 252,568 L 248,545 Z' },
];

interface LocationMapProps {
  items: LinkedInDemographic[];
}

function LocationMap({ items }: LocationMapProps) {
  if (!items.length) return null;

  const top = [...items]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, TOP_MAP);

  const maxPct = top[0]?.percentage ?? 1;

  const formatPct = (n: number) =>
    n < 1 ? '<1%' : `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;

  // LinkedIn exporta localidades no formato "Cidade e Região" ou "Estado, UF"
  // Tenta fazer lookup exato e, se falhar, tenta variantes extraídas do label
  function findCentroid(label: string): [number, number] | undefined {
    // 1. Lookup exato
    if (BR_LOCATIONS[label]) return BR_LOCATIONS[label];

    // 2. "Cidade e Região" → tenta "Cidade" (remove " e Região", " e Reg.", " e região")
    const semRegiao = label.replace(/\s+e\s+regi[ãa]o.*/i, '').trim();
    if (semRegiao !== label && BR_LOCATIONS[semRegiao]) return BR_LOCATIONS[semRegiao];

    // 3. "Cidade, UF" → tenta só "Cidade" (remove ", XX")
    const semUF = label.replace(/,\s*[A-Z]{2}$/, '').trim();
    if (semUF !== label && BR_LOCATIONS[semUF]) return BR_LOCATIONS[semUF];

    // 4. Procura parcial: se alguma chave do mapa está contida no início do label
    for (const key of Object.keys(BR_LOCATIONS)) {
      if (label.startsWith(key)) return BR_LOCATIONS[key];
    }

    return undefined;
  }

  // Split items into those matched on the Brazil map vs others (e.g., Portugal, USA)
  const brazilDots: Array<{ label: string; pct: number; cx: number; cy: number; r: number }> = [];
  const otherItems: Array<{ label: string; pct: number }> = [];

  for (const item of top) {
    const centroid = findCentroid(item.label);
    if (centroid) {
      const r = 4 + (item.percentage / maxPct) * 10; // radius 4–14
      brazilDots.push({ label: item.label, pct: item.percentage, cx: centroid[0], cy: centroid[1], r });
    } else {
      otherItems.push({ label: item.label, pct: item.percentage });
    }
  }

  // Show map only if there are Brazil matches
  const showMap = brazilDots.length > 0;

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 h-full">
      <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide">
        Localização
      </p>

      {/* SVG Brazil Map */}
      {showMap && (
        <div className="w-full">
          <svg
            viewBox="0 0 600 660"
            className="w-full rounded-lg"
            style={{ background: 'hsl(var(--muted)/0.35)' }}
            aria-label="Mapa de localização da audiência no Brasil"
          >
            {/* State fills */}
            {BRAZIL_STATES.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill="hsl(var(--muted))"
                stroke="white"
                strokeWidth="1.5"
              />
            ))}

            {/* Bubble dots for matched locations */}
            {brazilDots.map((dot, i) => (
              <g key={i}>
                <circle
                  cx={dot.cx}
                  cy={dot.cy}
                  r={dot.r}
                  fill="#f59e0b"
                  fillOpacity={0.85}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {/* Percentage label for top 3 */}
                {i < 3 && (
                  <text
                    x={dot.cx}
                    y={dot.cy - dot.r - 3}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="700"
                    fill="#92400e"
                    stroke="white"
                    strokeWidth="2.5"
                    paintOrder="stroke"
                  >
                    {formatPct(dot.pct)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Legend: all items (Brazil + others) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {top.map((item, i) => {
          const isMapped = !!BR_LOCATIONS[item.label];
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: '#f59e0b', opacity: isMapped ? 1 : 0.4 }}
              />
              <span className="text-xs text-foreground/70 truncate max-w-[130px]" title={item.label}>
                {item.label}
              </span>
              <span className="text-xs font-semibold text-[#d97706] tabular-nums">
                {formatPct(item.percentage)}
              </span>
            </div>
          );
        })}
      </div>

      {/* If no Brazil data at all, show plain text list */}
      {!showMap && (
        <p className="text-xs text-muted-foreground">
          Nenhuma localidade mapeada no Brasil.
        </p>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function DemographicsPanel({ demographics }: DemographicsPanelProps) {
  if (!demographics.length) return null;

  // Agrupar por categoria — ignorar Empresas
  const grouped: Record<string, LinkedInDemographic[]> = {};
  for (const d of demographics) {
    if (IGNORED_CATEGORIES.has(d.category)) continue;
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  // Coletar dados de localização
  const locationItems = LOCATION_KEYS
    .flatMap(k => grouped[k] ?? [])
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Audiência</h3>

      {/*
        Layout 3 colunas (desktop):
          Col 1: Cargo + Senioridade
          Col 2: Setor + Tamanho da empresa
          Col 3: Mapa do Brasil com bolhas
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">

        {/* Col 1 */}
        <div className="flex flex-col gap-3">
          {COL1_CATEGORIES.map(cat => (
            <CategoryChart
              key={cat.key}
              label={cat.label}
              items={grouped[cat.key] ?? []}
              color={cat.color}
            />
          ))}
        </div>

        {/* Col 2 */}
        <div className="flex flex-col gap-3">
          {COL2_CATEGORIES.map(cat => (
            <CategoryChart
              key={cat.key}
              label={cat.label}
              items={grouped[cat.key] ?? []}
              color={cat.color}
            />
          ))}
        </div>

        {/* Col 3: Mapa do Brasil */}
        {locationItems.length > 0 && (
          <div>
            <LocationMap items={locationItems} />
          </div>
        )}
      </div>
    </div>
  );
}
