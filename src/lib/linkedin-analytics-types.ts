// LinkedIn Analytics — Tipos de dados
// Gerado para feature de upload XLSX mensal
// API do LinkedIn (Community Management) pendente de aprovação — dados vêm do XLSX por enquanto

export type LinkedInTopPost = {
  url: string;
  date: string;              // "YYYY-MM-DD"
  engagement: number;
  impressions: number;
  // Enriquecidos via post matching com contentPipeline:
  postId?: string;
  caption?: string;
  mediaUrl?: string;
  format?: string;           // "foto" | "texto" | "infográfico" | "carrossel" | "vídeo"
  pillar?: string;
};

export type LinkedInDailyEngagement = {
  date: string;              // "YYYY-MM-DD"
  impressions: number;
  engagement: number;
};

export type LinkedInDailyFollower = {
  date: string;              // "YYYY-MM-DD"
  newFollowers: number;
};

export type LinkedInDemographic = {
  category: string;          // "Cargo" | "Setor" | "Tamanho da empresa"
  label: string;
  percentage: number;        // 0–100 ("menos de 1%" → 0.5)
};

export type ActionPlanItem = {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;      // ISO timestamp
};

export type ActionPlan = {
  updatedAt: string;         // ISO timestamp
  updatedBy: string;         // userId da estrategista
  items: ActionPlanItem[];
};

export type LinkedInSnapshot = {
  mesAno: string;            // "YYYY-MM" ex: "2026-04"
  uploadedAt: string;        // ISO timestamp
  uploadedBy: string;        // userId de quem fez upload

  /**
   * 'monthly'    — upload mês a mês (padrão). Alimenta KPIs, top posts, seletor de mês.
   * 'historical' — upload retroativo de 12 meses feito no onboarding.
   *                Alimenta apenas os gráficos de tendência. Não aparece no seletor
   *                individual nem gera top posts.
   */
  uploadType?: 'monthly' | 'historical';

  period: {
    start: string;           // "YYYY-MM-DD"
    end: string;             // "YYYY-MM-DD"
  };

  // Aba 0 — Descoberta
  totalImpressions: number;
  totalReach: number;

  // Aba 1 — Engajamento diário
  totalEngagement: number;   // soma de dailyEngagement[].engagement
  dailyEngagement: LinkedInDailyEngagement[];

  // Aba 2 — Top posts (máx 3 por critério)
  totalPostsPublished: number; // posts únicos entre as duas listas, deduplicados por URL
  topPostsByEngagement: LinkedInTopPost[];
  topPostsByImpressions: LinkedInTopPost[];

  // Aba 3 — Seguidores
  totalFollowers: number;    // total atual do perfil
  totalNewFollowers: number; // soma de novos seguidores no período
  dailyNewFollowers: LinkedInDailyFollower[];

  // Aba 4 — Dados demográficos
  demographics: LinkedInDemographic[];

  // Plano de ação — preenchido pela estrategista após upload (apenas TL)
  actionPlan?: ActionPlan;

  // ICP-Fit Score — calculado on-demand e persistido para evitar recálculos
  icpFitScore?: IcpFitScore;
};

// Estrutura retornada pelo parser XLSX (antes de salvar no Firestore)
// uploadType é opcional aqui e definido pelo modal no momento do upload
export type ParsedLinkedInData = Omit<LinkedInSnapshot, 'uploadedAt' | 'uploadedBy' | 'actionPlan'>;

// Status de upload no documento do usuário (users/{userId})
export type LinkedInSnapshotStatus = {
  lastUploadMonth: string;   // "YYYY-MM"
  lastUploadAt: string;      // ISO timestamp
};

// Para o filtro de usuários no /admin/analytics
export type AnalyticsUser = {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'thoughtleader' | 'colaborador';
  lastUploadMonth?: string;  // undefined = nunca fez upload
};

// Para cálculo de delta entre períodos
export type KpiDelta = {
  absolute: number;
  percentage: number;        // positivo = crescimento, negativo = queda
} | null;                    // null = sem dados do período anterior

// ICP-Fit Score — qualidade da audiência vs ICP definido no Brand Context
export type IcpFitCategoryScore = {
  category: string;          // ex: "Cargo", "Setor", "Tamanho da empresa"
  score: number;             // 0-100
  insight: string;           // uma linha explicando o score desta categoria
  matchedLabels?: string[];  // labels do XLSX que fizeram match com o ICP
  matchedPct?: number;       // soma das porcentagens dos labels que fizeram match
};

export type IcpFitScore = {
  overall: number;           // 0-100
  categories: IcpFitCategoryScore[];
  summary: string;           // 2-3 frases resumindo o fit da audiência
  computedAt: string;        // ISO timestamp
  method?: 'deterministic' | 'ai-only'; // método usado no cálculo
};

/**
 * Dicionário de match extraído pela IA a partir do targetAudience textual.
 * Salvo no Firestore em companies/{companyId}.icpDefinition
 * Só é recalculado quando o targetAudience muda.
 */
export type IcpDefinition = {
  cargos: string[];          // ex: ["CEO", "Fundador", "VP", "Diretor", "Head", "CMO"]
  setores: string[];         // ex: ["Tecnologia", "SaaS", "Marketing", "Varejo"]
  tamanhos: string[];        // ex: ["1-10", "11-50", "201-500"] — valores que aparecem no LinkedIn
  extractedFrom: string;     // hash ou trecho do targetAudience que gerou esta definição
  extractedAt: string;       // ISO timestamp
};

// ─── LinkedIn Profile Optimizer ───────────────────────────────────────────────

export type ProfileExperience = {
  title: string;
  company: string;
  period: string;            // ex: "jan 2022 – presente"
  description: string;
  isCurrent: boolean;
};

export type ProfileExperienceSuggestion = ProfileExperience & {
  action: 'keep' | 'rewrite' | 'add_impact';
  rewrittenDescription?: string; // preenchido se action !== 'keep'
};

export type ProfileFeaturedItem = {
  title: string;
  url?: string;
  imageUrl?: string;
};

export type ProfileFeaturedItemSuggestion = ProfileFeaturedItem & {
  action: 'keep' | 'replace' | 'add';
  rationale: string;
};

export type ProfileAlignmentIssue = {
  element: 'headline' | 'about' | 'skills' | 'experience' | 'featured';
  severity: 'high' | 'medium' | 'low';
  description: string;       // ex: "Headline genérico — não declara nicho"
  fix: string;               // ex: "Declare o problema resolvido + metodologia"
};

export type ProfileSemanticAlignment = {
  score: number;             // 0–100
  passesAudit: boolean;      // score >= 40
  issues: ProfileAlignmentIssue[];
};

/**
 * Versão atual do perfil, extraída do PDF.
 * Salva em users/{tlUserId}/linkedinProfile/current.current
 */
export type LinkedInProfileCurrent = {
  headline: string;
  about: string;
  topSkills: string[];       // até 5 (o que existia no PDF)
  experiences: ProfileExperience[];
  featuredItems: ProfileFeaturedItem[];
  extractedAt: string;       // ISO timestamp
};

/**
 * Sugestões geradas pela IA (ou editadas pela estrategista).
 * Salva em users/{tlUserId}/linkedinProfile/current.suggestions / .edited
 */
export type LinkedInProfileSuggestions = {
  headline: string;
  about: string;
  topSkills: string[];       // exatamente 5
  experiences: ProfileExperienceSuggestion[];
  featuredItems: ProfileFeaturedItemSuggestion[];
  semanticAlignment: ProfileSemanticAlignment;
  gapAnalysis: string;       // texto livre com diagnóstico de gaps
  generatedAt: string;       // ISO timestamp
};

/**
 * Documento principal do otimizador de perfil.
 * Salvo em users/{tlUserId}/linkedinProfile/current
 */
export type LinkedInProfileOptimization = {
  current: LinkedInProfileCurrent | null;
  suggestions: LinkedInProfileSuggestions | null;
  edited: LinkedInProfileSuggestions | null;
  editedAt: string | null;
  status: 'empty' | 'processing' | 'ready' | 'published' | 'error';
  publishedAt: string | null;
  errorMessage?: string;
  // Score do perfil ANTES da otimização (calculado a partir do current)
  currentAlignment?: ProfileSemanticAlignment | null;
  // Fotos do perfil (URLs do Storage)
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};
