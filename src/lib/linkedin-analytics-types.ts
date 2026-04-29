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
};

// Estrutura retornada pelo parser XLSX (antes de salvar no Firestore)
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
