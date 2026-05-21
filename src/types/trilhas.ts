import { Timestamp } from 'firebase/firestore';

// ============================================================
// TIPOS DO SISTEMA DE TRILHAS DE APRENDIZAGEM - BOLDFY
// ============================================================

// --- Modos de Modulo ---
export type ModuloModo = 'aula' | 'leitura' | 'desafio' | 'faca_voce_mesmo' | 'missao_conteudo';

// --- Questao de Quiz (modo desafio) ---
export interface QuestaoDesafio {
  pergunta: string;
  enunciado?: string; // alias para pergunta (usado em alguns contextos)
  opcoes: string[];
  respostaCorreta: number; // indice da opcao correta
  explicacao?: string; // explicacao apos resposta
}

// --- Missao Gatilho (modo missao_conteudo) ---
export interface MissaoGatilho {
  tipo: 'postar_linkedin';
  instrucoes: string;
  exemplos?: string[];
  pontosRecompensa?: number;
}

// --- Modulo (unidade dentro de uma Trilha) ---
export interface Modulo {
  id: string;
  titulo: string;
  modo: ModuloModo;
  ordem: number;
  obrigatorio?: boolean;

  // Modo: aula
  videoUrl?: string;
  materialPdfUrl?: string; // URL do PDF/apresentacao de apoio

  // Modo: leitura
  conteudoHtml?: string;

  // Modo: desafio
  questoes?: QuestaoDesafio[];
  pontuacaoBase?: number;  // pontos por acerto >= 60%
  pontuacaoBonus?: number; // bonus extra se > 80%

  // Modo: faca_voce_mesmo
  instrucaoCard?: string;

  // Modo: missao_conteudo
  missaoGatilho?: MissaoGatilho;
}

// --- Trilha ---
export interface Trilha {
  id: string;
  sessionId: string;
  titulo: string;
  descricao: string;
  ordem: number;
  ativa: boolean;
  pontuacaoTotal: number;
  pontuacaoBonus: number;
  pontuacaoBonusTrilha: number; // bonus por completar a trilha inteira
  tempoEstimadoMin: number;
  modulos: Modulo[];
  criadaEm: Timestamp;
  atualizadaEm?: Timestamp;

  // Missao gatilho (criada ao concluir trilha)
  missaoGatilho?: {
    titulo: string;
    descricao: string;
    pontos?: number;
    requerComprovante?: boolean;
    prazoDias?: number;
  };

  // Campo para trilhas de empresa (custom)
  isGlobal?: boolean;
  globalTrailId?: string; // referencia a trilha global original

  // Trilha esqueleto criada pelo seed do template personalizado
  // (ver seedTemplatePersonalizado em src/app/actions/company-setup.ts).
  // undefined em trilhas existentes = false (retrocompat).
  isTemplate?: boolean;
}

// --- Sessao (agrupador de Trilhas) ---
export interface Sessao {
  id: string;
  titulo: string;
  descricao: string;
  ordem: number;
  ativa: boolean;
  locale?: 'pt-BR' | 'en';
  criadaEm: Timestamp;
  atualizadaEm?: Timestamp;

  // Tipo da sessao. undefined em sessoes existentes = 'customizada' (retrocompat).
  // 'template_personalizado' identifica a sessao seedada na criacao da empresa
  // (ver seedTemplatePersonalizado em src/app/actions/company-setup.ts).
  tipo?: 'global' | 'customizada' | 'template_personalizado';
}

// --- Progresso do Colaborador em uma Trilha ---
export interface ProgressoTrilha {
  trailId?: string;
  modulosCompletos: (string | number)[]; // IDs ou indices dos modulos concluidos
  pontuacaoFixadaPorModulo: Record<string, number>; // moduloId -> pontos
  primeirasTentativasDesafio: Record<string, {
    respostas?: number[];
    percentual?: number;
    percentualAcerto?: number;
    pontos?: number;
    pontosGanhos?: number;
  }>;
  concluida: boolean;
  percentual: number;
  pontosGanhos: number;
  iniciadaEm: Timestamp;
  concluidaEm?: Timestamp;
}

// --- Trilha ativada por empresa (referencia a global) ---
export interface TrilhaAtivadaEmpresa {
  trailId: string; // id da trilha global
  ativadaEm: Timestamp;
  ativadaPor: string; // uid do admin
}

// --- Analytics de Trilha ---
export interface TrilhaAnalytics {
  trailId: string;
  titulo: string;
  totalInscritos: number;
  emProgresso: number;
  concluidos: number;
  naoIniciados: number;
  pontuacaoMedia: number;
  taxaConclusao: number; // percentual
}

// --- Dashboard Analytics (Master) ---
export interface DashboardTrilhasAnalytics {
  totalTrilhas: number;
  totalTrilhasAtivas: number;
  totalSessoes: number;
  totalColaboradoresComTrilha: number;
  mediaConclusao: number;
  trilhasMaisPopulares: TrilhaAnalytics[];
  trilhasMenosConcluidas: TrilhaAnalytics[];
  trilhasMenorPontuacao: TrilhaAnalytics[];
}

// --- Filtros do Dashboard ---
export interface FiltrosDashboardTrilhas {
  sessaoId?: string;
  modo?: ModuloModo;
  ordenarPor: 'concluidos' | 'emProgresso' | 'pontuacaoMedia' | 'naoIniciados';
  ordem: 'asc' | 'desc';
}

// --- Workbook Responses (respostas de exercicios interativos) ---
export interface WorkbookResponse {
  trailId: string;
  moduleId: string;
  trailTitle: string;
  moduleTitle: string;
  respostas: Record<string, string | string[]>; // id do campo → valor
  concluido: boolean;
  atualizadoEm: Timestamp;
  criadoEm: Timestamp;
}

// --- Helper: detectar se modulo e workbook (contem tags interativas) ---
export function isWorkbookModule(instrucaoCard?: string): boolean {
  if (!instrucaoCard) return false;
  return /<input-(field|area|list|select)\s/i.test(instrucaoCard);
}

// --- Helper: labels para modos ---
export const MODO_LABELS: Record<ModuloModo, string> = {
  aula: 'Aula (Vídeo)',
  leitura: 'Leitura',
  desafio: 'Desafio (Quiz)',
  faca_voce_mesmo: 'Faça Você Mesmo',
  missao_conteudo: 'Missão de Conteúdo',
};

// --- Helper: icones para modos ---
export const MODO_ICONS: Record<ModuloModo, string> = {
  aula: 'Play',
  leitura: 'BookOpen',
  desafio: 'HelpCircle',
  faca_voce_mesmo: 'Wrench',
  missao_conteudo: 'Target',
};

// --- Helper: pontuacao por modo ---
export const MODO_CONFIG: Record<ModuloModo, { temPontuacao: boolean; pontosPadrao: number; pontosBonus: number }> = {
  aula: { temPontuacao: true, pontosPadrao: 80, pontosBonus: 0 },
  leitura: { temPontuacao: true, pontosPadrao: 20, pontosBonus: 0 },
  desafio: { temPontuacao: true, pontosPadrao: 40, pontosBonus: 30 },
  faca_voce_mesmo: { temPontuacao: false, pontosPadrao: 0, pontosBonus: 0 },
  missao_conteudo: { temPontuacao: false, pontosPadrao: 0, pontosBonus: 0 },
};

// --- Constantes de Scoring do Desafio ---
export const DESAFIO_THRESHOLDS = {
  MINIMO_PARA_PONTOS: 0.6, // 60% - minimo para ganhar pontos base
  BONUS_THRESHOLD: 0.8,     // 80% - acima disso ganha bonus
};

// --- Caminhos Firestore ---
export const FIRESTORE_PATHS = {
  // Global (Master)
  globalSessions: 'globalSessions',
  globalTrails: (sessionId: string) => `globalSessions/${sessionId}/trails`,

  // Empresa
  companySessions: (companyId: string) => `companies/${companyId}/sessions`,
  companyTrails: (companyId: string, sessionId: string) =>
    `companies/${companyId}/sessions/${sessionId}/trails`,
  companyActivatedTrails: (companyId: string) =>
    `companies/${companyId}/activatedGlobalTrails`,

  // Progresso do colaborador
  userTrailProgress: (userId: string) => `users/${userId}/trailProgress`,

  // Workbook responses
  userWorkbooks: (userId: string) => `users/${userId}/workbookResponses`,
  userWorkbook: (userId: string, trailId: string, moduleId: string) =>
    `users/${userId}/workbookResponses/${trailId}_${moduleId}`,
};
