# i18n Spec — Boldfy Platform

> Documento de referência para implementação de internacionalização.
> Criado em: 2026-04-06
> Status: Aprovado, aguardando implementação

---

## 1. Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Biblioteca | Nenhuma (Context + dicionários TS) | App é 95% client components. next-intl seria overhead sem benefício |
| Routing | Sem mudança de rotas | Locale vem do Firestore, não da URL |
| Fonte do locale (logado) | `companies/{id}.locale` | Company-level, definido na criação pelo Master |
| Fonte do locale (público) | `localStorage('boldfy-public-locale')` | Toggle PT/EN no header |
| Mutabilidade | Imutável após criação da empresa | Requisito da Clara |
| Locales suportados | `'pt-BR'` e `'en'` | Expansível futuramente |
| Default | `'pt-BR'` | Maioria dos clientes são brasileiros |

---

## 2. Estrutura de Arquivos Novos

```
src/lib/i18n/
├── types.ts                    # Tipo Locale, constantes
├── context.tsx                 # LocaleProvider, useT(), useLocale()
├── interpolate.ts              # Helper pra strings com {variáveis}
├── date-utils.ts               # getDateLocale(), formatLocalDate(), formatLocalCurrency()
└── dictionaries/
    ├── index.ts                # getDictionary(locale)
    ├── pt-BR.ts                # Dicionário completo PT
    └── en.ts                   # Dicionário completo EN

src/components/
├── language-toggle.tsx         # Botão PT | EN (páginas públicas)
└── public-locale-wrapper.tsx   # Wrapper com localStorage + LocaleProvider

src/hooks/
└── use-format-date.ts          # Hook useFormatDate() pra componentes
```

---

## 3. Arquivos Existentes a Modificar (por fase)

### Fase 2 — Campo locale na empresa
- `src/app/actions/users.ts` — adicionar locale ao InviteAdminSchema e inviteAdmin()
- `src/app/master/empresas/page.tsx` — select de idioma no form + coluna na tabela
- `src/app/admin/layout.tsx` — fetch company locale, wrap com LocaleProvider
- `src/app/colaborador/layout.tsx` — fetch company locale, wrap com LocaleProvider
- `src/app/master/layout.tsx` — wrap com LocaleProvider (default pt-BR)

### Fase 3 — Páginas públicas
- `src/app/login/page.tsx`
- `src/app/beta-test/page.tsx`
- `src/app/privacidade/page.tsx`

### Fase 4 — Navegação
- `src/components/dashboard/admin-sidebar-nav.tsx`
- `src/components/dashboard/colaborador-sidebar-nav.tsx`
- `src/components/dashboard/master-sidebar-nav.tsx`
- `src/components/feedback-dialog.tsx`

### Fase 5 — Páginas admin
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/missoes/page.tsx`
- `src/app/admin/colaboradores/page.tsx`
- `src/app/admin/trilhas/page.tsx`
- `src/app/admin/recompensas/page.tsx`
- `src/app/admin/biblioteca/page.tsx`
- `src/app/admin/configuracoes/page.tsx`
- `src/app/admin/linkedin-feed/page.tsx`
- `src/app/admin/suporte/page.tsx`

### Fase 6 — Páginas colaborador
- `src/app/colaborador/dashboard/page.tsx`
- `src/app/colaborador/assistente/page.tsx`
- `src/components/ai-assistant-form.tsx`
- `src/app/colaborador/missoes/page.tsx`
- `src/app/colaborador/trilhas/page.tsx`
- `src/app/colaborador/trilhas/[id]/page.tsx`
- `src/app/colaborador/rankings/page.tsx`
- `src/app/colaborador/recompensas/page.tsx`
- `src/app/colaborador/calendario/page.tsx`
- `src/app/colaborador/calendario/novo/page.tsx`
- `src/app/colaborador/biblioteca/page.tsx`
- `src/app/colaborador/configuracoes/page.tsx`
- `src/app/colaborador/linkedin-feed/page.tsx`
- `src/components/suporte-page-content.tsx`

### Fase 7 — Páginas master
- `src/app/master/dashboard/page.tsx`
- `src/app/master/empresas/page.tsx` (complemento da Fase 2)
- `src/app/master/trilhas/page.tsx`

### Fase 8 — IA e prompts
- `src/app/actions/content.ts`
- `src/app/api/ai/generate/route.ts`
- `src/app/api/ai/missions/route.ts`

### Fase 9 — Trilhas globais por idioma
- `src/types/trilhas.ts`
- `src/app/master/trilhas/page.tsx`
- `src/app/admin/trilhas/page.tsx`

---

## 4. Tipos e Constantes

```typescript
// src/lib/i18n/types.ts

export type Locale = 'pt-BR' | 'en';

export const DEFAULT_LOCALE: Locale = 'pt-BR';

export const SUPPORTED_LOCALES: readonly Locale[] = ['pt-BR', 'en'] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (BR)',
  'en': 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en': '🇺🇸',
};
```

---

## 5. Context Provider

```typescript
// src/lib/i18n/context.tsx
'use client';

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import type { Locale } from './types';
import { DEFAULT_LOCALE } from './types';
import { getDictionary } from './dictionaries';
import type { Dictionary } from './dictionaries/pt-BR';

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: getDictionary(locale) }),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Retorna o dicionário tipado inteiro */
export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}

/** Retorna o locale ativo ('pt-BR' | 'en') */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Retorna ambos */
export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
```

---

## 6. Interpolação

```typescript
// src/lib/i18n/interpolate.ts

/**
 * Substitui {placeholders} numa string.
 * Uso: interpolate('Olá, {name}!', { name: 'Clara' }) → 'Olá, Clara!'
 */
export function interpolate(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => String(params[key] ?? `{${key}}`)
  );
}
```

---

## 7. Utilitários de Data

```typescript
// src/lib/i18n/date-utils.ts

import { ptBR } from 'date-fns/locale/pt-BR';
import { enUS } from 'date-fns/locale/en-US';
import { format as dateFnsFormat, type Locale as DateFnsLocale } from 'date-fns';
import type { Locale } from './types';

const DATE_LOCALE_MAP: Record<Locale, DateFnsLocale> = {
  'pt-BR': ptBR,
  'en': enUS,
};

export function getDateLocale(locale: Locale): DateFnsLocale {
  return DATE_LOCALE_MAP[locale] || ptBR;
}

export function formatLocalDate(
  date: Date | number | string,
  pattern: string,
  locale: Locale
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(d, pattern, { locale: getDateLocale(locale) });
}

export function formatLocalNumber(value: number, locale: Locale): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR');
}

export function formatLocalCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: locale === 'en' ? 'USD' : 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
```

```typescript
// src/hooks/use-format-date.ts

import { useLocale } from '@/lib/i18n/context';
import { formatLocalDate, getDateLocale } from '@/lib/i18n/date-utils';

export function useFormatDate() {
  const locale = useLocale();
  return {
    format: (date: Date | number | string, pattern: string) =>
      formatLocalDate(date, pattern, locale),
    dateLocale: getDateLocale(locale),
  };
}
```

---

## 8. Firestore Schema Changes

### companies/{companyId}
```diff
{
  companyName: string,
  status: 'Ativa' | 'Inativa' | 'Trial',
  licenses: number,
+ locale: 'pt-BR' | 'en',          // SET AT CREATION, IMMUTABLE
  adminProfile: { email, name },
  brandContext: { ... },
  subscription: { ... },
  createdAt: Timestamp,
}
```

### globalSessions/{sessionId}
```diff
{
  titulo: string,
  descricao: string,
  ordem: number,
  ativa: boolean,
+ locale: 'pt-BR' | 'en',          // TAGS SESSION BY LANGUAGE
  criadaEm: Timestamp,
}
```

### Migration script (one-shot):
```typescript
// scripts/migrate-add-locale.ts
// Adds locale: 'pt-BR' to all companies and globalSessions missing it
// Run: npx tsx scripts/migrate-add-locale.ts
```

---

## 9. Layout Integration Pattern

### admin/layout.tsx (padrão — colaborador/layout segue o mesmo)

```tsx
function AdminLayoutInner({ children }) {
  const { user, loading } = useAuth();
  const [companyId, setCompanyId] = useState<string>();
  const [companyLocale, setCompanyLocale] = useState<Locale>('pt-BR');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  useEffect(() => {
    if (!companyId) return;
    getDoc(doc(db, 'companies', companyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCompanyLocale(data.locale || 'pt-BR');
        setCompanyData(data as CompanyData);
      }
    });
  }, [companyId]);

  // ... rest of existing logic ...

  return (
    <LocaleProvider locale={companyLocale}>
      <DashboardLayout sidebar={sidebarContent}>
        <TrialNotification companyData={companyData} />
        {children}
      </DashboardLayout>
    </LocaleProvider>
  );
}
```

**Benefício:** O fetch que TrialNotification já fazia agora é feito uma vez no nível do layout e reaproveitado. Menos reads do Firestore, não mais.

---

## 10. Public Pages Pattern

```tsx
// src/components/public-locale-wrapper.tsx
'use client';

import { useState, useEffect } from 'react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';
import { DEFAULT_LOCALE } from '@/lib/i18n/types';

const STORAGE_KEY = 'boldfy-public-locale';

export function PublicLocaleWrapper({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'en' || stored === 'pt-BR') setLocale(stored);
  }, []);

  const toggle = () => {
    const next: Locale = locale === 'pt-BR' ? 'en' : 'pt-BR';
    setLocale(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LocaleProvider locale={locale}>
      {/* O LanguageToggle usa useLocale() internamente */}
      {children}
    </LocaleProvider>
  );
}
```

```tsx
// src/components/language-toggle.tsx
'use client';

import { useLocale } from '@/lib/i18n/context';
import { LOCALE_FLAGS } from '@/lib/i18n/types';

export function LanguageToggle({ onToggle }: { onToggle: () => void }) {
  const locale = useLocale();
  const other = locale === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <button
      onClick={onToggle}
      className="text-xs font-semibold px-2 py-1 rounded-md border bg-secondary hover:bg-accent transition-colors"
      aria-label={`Switch to ${other}`}
    >
      {LOCALE_FLAGS[other]} {other === 'en' ? 'EN' : 'PT'}
    </button>
  );
}
```

---

## 11. Dicionário PT-BR (Completo)

> Estrutura real extraída de todas as páginas do app.
> O dicionário EN terá a mesma estrutura exata, com valores em inglês.

```typescript
// src/lib/i18n/dictionaries/pt-BR.ts

const ptBR = {

  // ══════════════════════════════════════════════
  // COMMON (shared across all roles)
  // ══════════════════════════════════════════════
  common: {
    loading: 'Carregando...',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    create: 'Criar',
    back: 'Voltar',
    confirm: 'Confirmar',
    search: 'Buscar',
    noResults: 'Nenhum resultado encontrado.',
    error: 'Erro',
    success: 'Sucesso',
    close: 'Fechar',
    yes: 'Sim',
    no: 'Não',
    actions: 'Ações',
    logout: 'Sair',
    comingSoon: 'Em breve',
    points: 'pontos',
    pts: 'pts',
    seeAll: 'Ver todas',
    saving: 'Salvando...',
    sending: 'Enviando...',
    submit: 'Enviar',
    status: 'Status',
    active: 'Ativa',
    inactive: 'Inativa',
    trial: 'Trial',
    activate: 'Ativar',
    deactivate: 'Desativar',
    remove: 'Remover',
    date: 'Data',
    settings: 'Configurações',
    support: 'Suporte',
    privacyPolicy: 'Política de Privacidade',
    saveChanges: 'Salvar Alterações',
    selectOption: 'Selecione...',
    select: 'Selecione',
    required: 'obrigatório',
    optional: 'opcional',
    uploading: 'Enviando...',
    changePhoto: 'Mudar foto',
    viewProfile: 'Ver Perfil',
  },

  // ══════════════════════════════════════════════
  // AUTH / LOGIN
  // ══════════════════════════════════════════════
  auth: {
    welcomeBack: 'Bem-vindo de volta',
    resetPassword: 'Recuperar senha',
    loginSubtitle: 'Entre com suas credenciais para acessar a plataforma',
    resetSubtitle: 'Digite seu e-mail para receber o link de recuperação',
    email: 'Email',
    password: 'Senha',
    emailPlaceholder: 'seu@email.com',
    loggingIn: 'Entrando...',
    login: 'Entrar',
    forgotPassword: 'Esqueci minha senha',
    sendResetLink: 'Enviar link de recuperação',
    resetEmailSent: 'Email de recuperação enviado! Verifique sua caixa de entrada e a pasta de spam.',
    backToLogin: 'Voltar para o login',
    errors: {
      wrongCredentials: 'Email ou senha incorretos.',
      tooManyRequests: 'Muitas tentativas. Tente novamente em alguns minutos.',
      generic: 'Erro ao fazer login. Tente novamente.',
      userNotFound: 'Nenhuma conta encontrada com este e-mail.',
      invalidEmail: 'E-mail inválido. Verifique e tente novamente.',
      resetGeneric: 'Erro ao enviar e-mail de recuperação. Tente novamente.',
      profileNotRecognized: 'Perfil de usuário não reconhecido.',
      authMissing: 'Token de autenticação ausente.',
      tooManyResetAttempts: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    },
  },

  // ══════════════════════════════════════════════
  // NAVIGATION (sidebars)
  // ══════════════════════════════════════════════
  nav: {
    dashboard: 'Dashboard',
    collaborators: 'Colaboradores',
    missions: 'Missões',
    trails: 'Trilhas',
    rewards: 'Recompensas',
    library: 'Biblioteca',
    linkedinFeed: 'LinkedIn Feed',
    linkedinLeads: 'LinkedIn Leads',
    contentAssistant: 'Assistente de Conteúdo',
    calendar: 'Calendário',
    rankings: 'Rankings',
    companies: 'Empresas',
    globalContent: 'Conteúdo Global',
  },

  // ══════════════════════════════════════════════
  // ROLES
  // ══════════════════════════════════════════════
  roles: {
    admin: 'Admin',
    collaborator: 'Colaborador',
    master: 'Master',
    administrator: 'Administrador',
  },

  // ══════════════════════════════════════════════
  // FEEDBACK DIALOG
  // ══════════════════════════════════════════════
  feedback: {
    title: 'Feedback & Bugs',
    description: 'Encontrou um problema ou tem uma sugestão? Nos conte!',
    type: 'Tipo',
    typeFeedback: 'Feedback',
    typeBug: 'Bug',
    titleLabel: 'Título',
    titlePlaceholderBug: 'Ex: Botão não funciona na página X',
    titlePlaceholderFeedback: 'Ex: Sugestão para melhorar Y',
    descriptionLabel: 'Descrição',
    descriptionPlaceholderBug: 'O que aconteceu? O que você esperava que acontecesse?',
    descriptionPlaceholderFeedback: 'O que podemos melhorar? Tem alguma ideia?',
    screenshotLabel: 'Screenshot (opcional)',
    attachImage: 'Anexar imagem',
    submitSuccess: 'Enviado com sucesso!',
    submitSuccessMessage: 'Obrigado pelo seu feedback.',
    imageTooLarge: 'Imagem muito grande',
    imageTooLargeMessage: 'Máximo 5MB.',
    titleRequired: 'Título obrigatório',
    titleRequiredMessage: 'Dê um título curto ao seu report.',
    descriptionRequired: 'Descrição obrigatória',
    descriptionRequiredMessage: 'Escreva uma descrição do feedback ou bug.',
    submitError: 'Erro ao enviar',
    submitErrorMessage: 'Não foi possível enviar o feedback.',
    triggerButton: 'Reportar bug ou dar feedback',
  },

  // ══════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ══════════════════════════════════════════════
  adminDashboard: {
    title: 'Dashboard',
    periods: {
      thisWeek: 'Esta semana',
      thisMonth: 'Este mês',
      lastMonth: 'Último mês',
      last3Months: 'Últimos 3 meses',
      last6Months: 'Últimos 6 meses',
    },
    equivalentValue: 'Valor equivalente',
    estimateCollaborators: 'Estimativa: {count} colaboradores',
    impressionsGenerated: 'Impressões geradas',
    impressionsCost: '× R$0,30 = valor acima',
    activeCollaborators: 'Colaboradores ativos',
    adhesionRate: '{rate}% de adesão',
    programROI: 'ROI do programa',
    roiSubtitle: 'Valor gerado ÷ custo',
    impressionsAndValue: 'Impressões e valor equivalente',
    monthlyEvolution: 'Evolução mensal — efeito composto',
    availableWithLinkedinTrack: 'Disponível com LinkedIn Track',
    engagement: 'Engajamento no programa',
    activityDistribution: 'Distribuição de atividade',
    collaborators: 'colaboradores',
    engaged: 'Engajados ({count})',
    noActivity: 'Sem atividade ({count})',
    inactive: 'Inativos ({count})',
    missionsCompleted: 'Missões concluídas',
    trailsCompleted: 'Trilhas concluídas',
    started: 'iniciadas',
    pointsDistributed: 'Pontos distribuídos',
    pendingReview: '{count} pendente(s) de revisão',
    rewardsRedeemed: '{count} recompensa(s) resgatada(s)',
    top5: 'Top 5 colaboradores',
    rankingByPoints: 'Ranking por pontos no período',
    noPointsYet: 'Nenhum colaborador com pontos ainda.',
    missionsStat: '{count} missão(ões) · {points} pts',
    programHealth: 'Saúde do programa',
    healthAdhesion: 'Adesão ao programa',
    healthMissionsWeek: 'Missões completadas (semana)',
    healthTrailsProgress: 'Trilhas em andamento',
    healthRewardsRedeemed: 'Recompensas resgatadas',
    costPerImpression: 'Custo por impressão efetivo',
    costComparison: 'vs R$0,30 em Ads = 57% mais barato',
    loadingError: 'Erro ao carregar dashboard',
    loadingSubtitle: 'Carregando...',
    errorSubtitle: 'Erro ao carregar dados',
    comingSoonOverlay: 'Em breve com LinkedIn Track',
  },

  // ══════════════════════════════════════════════
  // ADMIN: MISSIONS
  // ══════════════════════════════════════════════
  adminMissions: {
    title: 'Missões',
    weeklyMissions: 'Missões da Semana',
    activeMissions: 'Missões Ativas',
    activeDescription: 'Missões disponíveis para os colaboradores agora.',
    scheduled: 'Agendadas',
    scheduledTitle: 'Missões Agendadas',
    scheduledDescription: 'Missões que serão ativadas automaticamente na data de início.',
    history: 'Histórico',
    historyTitle: 'Histórico de Missões',
    historyDescription: 'Missões encerradas e seus resultados.',
    createMission: 'Criar Missão',
    createFixed: 'Missão Fixa',
    createFixedDescription: 'Sempre ativa, sem data de término.',
    createTimed: 'Missão com Período',
    createTimedDescription: 'Configure uma missão com data de início e fim.',
    editMission: 'Editar Missão',
    editMissionDescription: 'Atualize os detalhes desta missão.',
    missionName: 'Nome da Missão',
    missionNamePlaceholderFixed: 'Ex: Atualize seu banner do LinkedIn',
    missionNamePlaceholderTimed: 'Ex: Compartilhar post no LinkedIn',
    description: 'Descrição',
    descriptionPlaceholder: 'Descreva o que o colaborador precisa fazer.',
    pointsLabel: 'Pontos',
    pointsPlaceholder: 'Ex: 100',
    completionMode: 'Modo de Conclusão',
    completionModePlaceholder: 'Selecione o modo',
    completionProof: 'Com comprovação (admin aprova)',
    completionProofHelp: 'O colaborador envia um arquivo e o admin precisa aprovar.',
    completionAuto: 'Auto-conclusão (sem comprovação)',
    completionAutoHelp: 'O colaborador conclui com um clique. Pontos são dados automaticamente.',
    startDate: 'Data de Início',
    endDate: 'Data de Término',
    fixed: 'Fixa',
    timed: 'Temporária',
    auto: 'Auto',
    proof: 'Comprovação',
    alwaysActive: 'Sempre ativa',
    statusActive: 'Ativa',
    statusScheduled: 'Agendada',
    statusEnded: 'Encerrada',
    noActiveMissions: 'Nenhuma missão ativa no momento.',
    noScheduledMissions: 'Nenhuma missão agendada.',
    noHistoryMissions: 'Nenhuma missão no histórico.',
    noMissionsCategory: 'Nenhuma missão nesta categoria.',
    submissions: 'Envio(s)',
    pendingProofs: '{count} comprovação(ões) pendente(s)',
    proofsTitle: 'Comprovações Pendentes',
    proofsDescription: 'Revise as comprovações enviadas pelos colaboradores.',
    noProofs: 'Nenhuma comprovação pendente.',
    proofLabel: 'Comprovação:',
    viewFile: 'Ver arquivo',
    feedbackOptional: 'Feedback (opcional, para rejeição):',
    feedbackPlaceholder: 'Motivo da rejeição...',
    reject: 'Rejeitar',
    approve: 'Aprovar',
    generateWithAI: 'Gerar com IA',
    generateTitle: 'Gerar Missões com IA',
    generateDescription: 'A IA analisa o contexto da sua empresa e sugere missões. Selecione, configure o tipo e modo, e defina datas se necessário.',
    generateLoading: 'Analisando o contexto da empresa e gerando sugestões...',
    generateEmpty: 'Nenhuma sugestão gerada. Tente novamente.',
    createSelected: 'Criar {count} missão(ões)',
    selectAtLeastOne: 'Selecione ao menos uma missão.',
    setDates: 'Defina as datas de início e término das missões temporárias selecionadas.',
    toastUpdated: 'Missão atualizada com sucesso!',
    toastCreated: 'Missão criada com sucesso!',
    toastSaveError: 'Erro ao salvar missão.',
    toastFetchError: 'Erro ao buscar missões.',
    toastGenerateError: 'Erro ao gerar sugestões de missões.',
    toastProofApproved: 'Comprovação aprovada!',
    toastProofRejected: 'Comprovação rejeitada.',
    toastProofError: 'Erro ao avaliar comprovação.',
  },

  // ══════════════════════════════════════════════
  // ADMIN: COLLABORATORS
  // ══════════════════════════════════════════════
  adminCollaborators: {
    title: 'Colaboradores',
    totalCollaborators: 'Total de Colaboradores',
    activeCollaborators: 'Colaboradores Ativos',
    availableLicenses: 'Licenças Disponíveis',
    teamTitle: 'Equipe',
    teamDescription: 'Gerencie os colaboradores da sua empresa.',
    tableCollaborator: 'Colaborador',
    tablePoints: 'Pontos',
    tableStatus: 'Status',
    tableLinkedin: 'LinkedIn',
    tableJoinDate: 'Data de Adesão',
    loading: 'Carregando colaboradores...',
    empty: 'Nenhum colaborador encontrado. Convide o primeiro!',
    linkedinConnected: 'Conectado',
    linkedinExpiring: 'Expirando',
    linkedinExpired: 'Expirado',
    invite: 'Convidar Colaborador',
    inviteTitle: 'Convidar Novo Colaborador',
    inviteDescription: 'Envie um convite para um novo membro da equipe. Ele receberá um e-mail para criar sua senha.',
    inviteName: 'Nome do Colaborador',
    inviteNamePlaceholder: 'Ex: Maria Souza',
    inviteEmail: 'E-mail do Colaborador',
    inviteEmailPlaceholder: 'nome@empresa.com.br',
    sendInvite: 'Enviar Convite',
    editTitle: 'Editar Colaborador',
    editDescription: 'Atualize os dados do colaborador.',
    nameLabel: 'Nome',
    emailLabel: 'Email',
    removeTitle: 'Remover Colaborador',
    removeConfirm: 'Tem certeza que deseja remover {name}? Esta ação não pode ser desfeita.',
    toastInviteSent: 'Convite enviado!',
    toastInviteDescription: 'O colaborador receberá um e-mail para definir sua senha.',
    toastInviteError: 'Erro ao convidar',
    toastUpdated: 'Colaborador atualizado com sucesso!',
    toastUpdateError: 'Erro ao atualizar colaborador',
    toastRemoved: 'Colaborador removido com sucesso!',
    toastRemoveError: 'Erro ao remover colaborador',
    errorCompanyNotFound: 'Empresa não encontrada no perfil do usuário.',
    errorUserNotFound: 'Dados do usuário não encontrados.',
    errorLoadUser: 'Erro ao carregar dados do usuário.',
    errorFetch: 'Erro ao buscar colaboradores.',
  },

  // ══════════════════════════════════════════════
  // ADMIN: TRAILS
  // ══════════════════════════════════════════════
  adminTrails: {
    title: 'Trilhas',
    globalTrails: 'Trilhas Globais',
    companyTrails: 'Trilhas da Empresa',
    noGlobalTrails: 'Nenhuma trilha global disponível',
    noGlobalTrailsDescription: 'O administrador master ainda não criou trilhas globais',
    noTrailsInSession: 'Nenhuma trilha nesta sessão',
    newSession: 'Nova Sessão',
    noCustomSessions: 'Nenhuma sessão personalizada',
    noCustomSessionsDescription: 'Crie sessões e trilhas exclusivas da sua empresa',
    createSession: 'Criar Sessão',
    sessionActive: 'Ativa',
    sessionInactive: 'Inativa',
    newTrail: 'Nova Trilha',
    newSessionTitle: 'Nova Sessão',
    newSessionDescription: 'Crie uma sessão personalizada',
    editSessionTitle: 'Editar Sessão',
    editSessionDescription: 'Atualize os dados da sessão',
    titleLabel: 'Título',
    descriptionLabel: 'Descrição',
    toastSessionCreated: 'Sessão criada com sucesso!',
    toastSessionCreateError: 'Erro ao criar sessão',
    toastSessionUpdated: 'Sessão atualizada com sucesso!',
    toastSessionUpdateError: 'Erro ao atualizar sessão',
    toastSessionDeactivated: 'Sessão desativada com sucesso!',
    toastSessionActivated: 'Sessão ativada com sucesso!',
    toastSessionToggleError: 'Erro ao alterar sessão',
    toastTrailSaved: 'Trilha salva com sucesso!',
    toastTrailSaveError: 'Erro ao salvar',
    toastTrailDeleted: 'Trilha excluída com sucesso',
    toastTrailDeleteError: 'Erro ao excluir',
    toastTrailToggleError: 'Erro ao alterar trilha',
    validationTitleRequired: 'Título obrigatório',
    validationTitleMessage: 'Preencha o título da trilha para salvar.',
  },

  // ══════════════════════════════════════════════
  // ADMIN: REWARDS
  // ══════════════════════════════════════════════
  adminRewards: {
    title: 'Recompensas',
    shopTab: 'Loja de Recompensas',
    historyTab: 'Histórico de Resgates',
    addReward: 'Adicionar Recompensa',
    addTitle: 'Adicionar Nova Recompensa',
    addDescription: 'Cadastre uma nova recompensa na loja para seus colaboradores.',
    rewardName: 'Nome da Recompensa',
    rewardNamePlaceholder: 'Ex: Vale-presente iFood R$50',
    costPoints: 'Custo (Pontos)',
    costPlaceholder: 'Ex: 5000',
    stock: 'Estoque',
    stockUnlimited: 'Ilimitado',
    stockHelp: 'Deixe em branco para ilimitado',
    requiredFields: 'Campos obrigatórios',
    requiredFieldsMessage: 'Nome e pontos são obrigatórios.',
    monthlyPrize: 'Prêmio do Mês (Top 1 Ranking)',
    monthlyPrizeDescription: 'Selecione qual recompensa da loja será o prêmio para o primeiro lugar do ranking neste mês.',
    monthlyPrizeSelect: 'Selecione uma recompensa',
    monthlyPrizeSave: 'Salvar Prêmio do Mês',
    monthlyPrizeDefault: 'Prêmio não definido',
    manageTitle: 'Gerenciar Loja de Recompensas',
    manageDescription: 'Adicione, edite ou remova as recompensas disponíveis.',
    tableReward: 'Recompensa',
    tableCost: 'Custo (Pontos)',
    tableStock: 'Estoque',
    empty: 'Nenhuma recompensa encontrada.',
    editTitle: 'Editar Recompensa',
    editDescription: 'Atualize os detalhes da recompensa.',
    deleteConfirm: 'Tem certeza que deseja excluir esta recompensa?',
    historyTitle: 'Histórico de Resgates',
    historyDescription: 'Acompanhe os resgates feitos pelos colaboradores.',
    historyCollaborator: 'Colaborador',
    historyReward: 'Recompensa',
    historyPoints: 'Pontos',
    historyDate: 'Data',
    historyAction: 'Ação',
    historyEmpty: 'Nenhum resgate encontrado.',
    markPaid: 'Marcar como Pago',
    paid: 'Pago',
    toastUpdated: 'Recompensa atualizada!',
    toastCreated: 'Recompensa criada!',
    toastSaveError: 'Erro ao salvar recompensa.',
    toastStatusChanged: 'Status alterado para {status}',
    toastStatusError: 'Erro ao alterar status.',
    toastDeleted: 'Recompensa excluída.',
    toastDeleteError: 'Erro ao excluir recompensa.',
    toastPaid: 'Resgate marcado como pago.',
    toastPaidError: 'Erro ao marcar como pago.',
    toastFetchError: 'Erro ao buscar recompensas.',
    toastFetchHistoryError: 'Erro ao buscar resgates.',
  },

  // ══════════════════════════════════════════════
  // ADMIN: SETTINGS
  // ══════════════════════════════════════════════
  adminSettings: {
    title: 'Configurações',
    profileTitle: 'Perfil do Administrador',
    profileDescription: 'Gerencie as informações da sua conta e empresa.',
    adminName: 'Nome do Admin',
    companyName: 'Nome da Empresa',
    brandContextTitle: 'Brand Context da Empresa',
    brandContextDescription: 'Essas informações alimentam a IA para alinhar o conteúdo dos colaboradores com a marca. A IA tece a marca de forma orgânica na narrativa pessoal de cada autor.',
    valueProposition: 'Proposta de Valor',
    valuePropositionPlaceholder: 'O que a empresa entrega de único para o mercado?',
    tagline: 'Tagline',
    taglinePlaceholder: "Frase-síntese da marca (ex: 'Gamificação que transforma colaboradores em embaixadores')",
    businessKeywords: 'Keywords de Negócio',
    businessKeywordsPlaceholder: 'Termos do nicho da empresa, separados por vírgula (ex: employee advocacy, gamificação, marca empregadora)',
    businessKeywordsHelp: 'Separe por vírgula. A IA usa esses termos naturalmente nos textos.',
    solutions: 'Soluções que a Empresa Oferece',
    solutionsPlaceholder: 'O que a empresa vende ou faz, separado por vírgula (ex: plataforma de advocacy, trilhas de capacitação, assistente IA)',
    solutionsHelp: 'Separe por vírgula.',
    targetPainPoints: 'Dores do Público-alvo',
    targetPainPointsPlaceholder: 'Problemas que seu público enfrenta, separados por vírgula (ex: baixo engajamento no LinkedIn, colaboradores não postam, marca sem presença)',
    targetPainPointsHelp: 'Separe por vírgula. A IA usa isso para gerar identificação no leitor.',
    targetAudience: 'Público-alvo',
    targetAudiencePlaceholder: 'Quem a empresa atende (ex: líderes de RH e marketing de empresas B2B com 50+ colaboradores)',
    approvedTopics: 'Tópicos Aprovados',
    approvedTopicsPlaceholder: 'Temas que os colaboradores devem abordar, separados por vírgula (ex: employee advocacy, cultura organizacional, liderança)',
    approvedTopicsHelp: 'Separe por vírgula. O conteúdo gerado girará em torno desses temas.',
    prohibitedPhrases: 'Frases / Tópicos Proibidos',
    prohibitedPhrasesPlaceholder: 'O que NUNCA deve aparecer no conteúdo, separado por vírgula (ex: nome de concorrente X, preços, termos técnicos internos)',
    prohibitedPhrasesHelp: 'Separe por vírgula.',
    saveBrandContext: 'Salvar Brand Context',
    notificationsTitle: 'Notificações',
    notificationsDescription: 'Gerencie como você recebe as notificações.',
    notifRewards: 'Resgates de Recompensas',
    notifRewardsDescription: 'Receba alertas quando um colaborador resgatar uma recompensa.',
    notifNewCollaborators: 'Novos Colaboradores',
    notifNewCollaboratorsDescription: 'Seja notificado quando um novo colaborador entrar na plataforma.',
    notifWeeklyReports: 'Relatórios Semanais',
    notifWeeklyReportsDescription: 'Receba relatórios de engajamento da plataforma.',
    toastPhotoUpdated: 'Foto atualizada!',
    toastPhotoUpdatedDescription: 'Sua foto de perfil foi salva com sucesso.',
    toastPhotoError: 'Erro no upload',
    toastPhotoErrorDescription: 'Não foi possível atualizar a foto.',
    toastBrandSaved: 'Sucesso!',
    toastBrandSavedDescription: 'O Brand Context da empresa foi salvo.',
    toastBrandError: 'Erro ao salvar',
    toastBrandErrorDescription: 'Não foi possível salvar as alterações.',
    toastLoadCompanyError: 'Erro ao carregar empresa',
    toastLoadCompanyErrorDescription: 'Os dados da sua empresa não foram encontrados.',
    toastLoadError: 'Erro ao carregar configurações',
    toastLoadErrorDescription: 'Não foi possível buscar os dados. Tente novamente mais tarde.',
  },

  // ══════════════════════════════════════════════
  // ADMIN LAYOUT (trial, master mode)
  // ══════════════════════════════════════════════
  adminLayout: {
    trialExpiresToday: 'Seu trial expira hoje! Faça upgrade agora.',
    trialExpiresTomorrow: 'Seu trial expira amanhã! Faça upgrade agora.',
    trialExpiresIn: 'Seu trial expira em {days} dias. Faça upgrade para não perder acesso.',
    upgrade: 'Fazer Upgrade',
    masterMode: 'Modo Master — Visualizando: {company}',
    backToMaster: 'Voltar ao Painel Master',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: DASHBOARD
  // ══════════════════════════════════════════════
  colabDashboard: {
    greeting: 'Olá, {name}!',
    subtitle: 'Acompanhe seu progresso e conquistas',
    points: 'Pontos',
    activeMissions: 'Missões Ativas',
    trails: 'Trilhas',
    rewards: 'Recompensas',
    connectLinkedin: 'Conecte seu LinkedIn',
    connectLinkedinDescription: 'Conecte sua conta para ver métricas dos seus posts aqui no dashboard.',
    connectButton: 'Conectar LinkedIn',
    goToSettings: 'Ir para Configurações',
    linkedinPerformance: 'LinkedIn Performance',
    publishedPosts: 'Posts publicados',
    totalReactions: 'Reações totais',
    comments: 'Comentários',
    avgReactionsPerPost: 'Média reações/post',
    recentPosts: 'Posts recentes',
    seeAllPosts: 'Ver todos os {count} posts',
    noPostsYet: 'Nenhum post publicado ainda',
    noPostsDescription: 'Publique seu primeiro post pelo Calendário para ver as métricas aqui.',
    createPost: 'Criar post',
    seeCalendar: 'Ver calendário',
    activeMissionsTitle: 'Missões Ativas',
    noActiveMissions: 'Nenhuma missão ativa no momento',
    learningTrails: 'Trilhas de Aprendizado',
    noTrails: 'Nenhuma trilha disponível',
    noData: 'Nenhum dado encontrado. Verifique sua conta.',
    loadingError: 'Erro ao carregar dashboard',
    loadingErrorDescription: 'Tente novamente mais tarde.',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: MISSIONS
  // ══════════════════════════════════════════════
  colabMissions: {
    title: 'Missões',
    weeklyPoints: 'Pontos de Missões da Semana',
    fixedProgress: 'Progresso em Missões Fixas',
    tabWeekly: 'Missões da Semana',
    tabFixed: 'Missões Fixas',
    tabTrail: 'Missões de Trilha',
    tabHistory: 'Histórico',
    completed: 'Concluída',
    waiting: 'Aguardando',
    waitingApproval: 'Aguardando aprovação',
    rejected: 'Rejeitada',
    expired: 'Expirada',
    scheduled: 'Agendada',
    scheduledButton: 'Em breve',
    completedButton: 'Concluída',
    conclude: 'Concluir',
    submitProof: 'Enviar Comprovação',
    submitProofTitle: 'Enviar Comprovação',
    submitProofDescription: 'Envie um anexo para completar a missão "{name}".',
    resubmitProof: 'Reenviar Comprovação',
    resubmitDescription: 'Envie um novo anexo para a missão "{name}".',
    selectFile: 'Selecione um arquivo',
    fileLabel: 'Arquivo',
    fileHelp: 'Envie uma imagem, vídeo ou PDF como comprovação.',
    feedbackLabel: 'Feedback: {feedback}',
    rejectionReason: 'Motivo: {feedback}',
    period: 'Período:',
    noMissions: 'Nenhuma missão nesta categoria.',
    noHistory: 'Nenhuma missão no histórico',
    noHistoryDescription: 'Missões concluídas ou expiradas aparecerão aqui.',
    allFixedCompleted: 'Você completou todas as missões fixas!',
    toastProofSent: 'Comprovação enviada!',
    toastProofSentDescription: 'Aguarde a aprovação do admin.',
    toastCompleted: 'Missão concluída!',
    toastCompletedDescription: 'Pontos adicionados ao seu saldo.',
    toastProofError: 'Erro ao enviar comprovação.',
    toastCompleteError: 'Erro ao concluir missão.',
    toastFetchError: 'Erro ao buscar missões.',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: TRAILS
  // ══════════════════════════════════════════════
  colabTrails: {
    title: 'Trilhas',
    totalTrails: 'Total Trilhas',
    inProgress: 'Em Progresso',
    completed: 'Concluídas',
    pointsEarned: 'Pontos Ganhos',
    noTrails: 'Nenhuma trilha disponível',
    noTrailsDescription: 'Seu administrador ainda não ativou trilhas para sua empresa',
    modules: 'módulos',
    module: 'módulo',
    min: 'min',
    pointsConquered: 'pontos conquistados',
    startTrail: 'Começar Trilha',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: RANKINGS
  // ══════════════════════════════════════════════
  colabRankings: {
    title: 'Rankings',
    generalRanking: 'Ranking Geral',
    monthlyPrize: 'Prêmio do Mês:',
    monthlyPrizeDefault: 'Prêmio não definido',
    monthlyPrizeDescription: 'O top 1 do ranking este mês ganha esta recompensa.',
    daysOf: 'de {total} dias',
    position: 'Posição',
    collaborator: 'Colaborador',
    points: 'Pontos',
    you: 'Você',
    noParticipants: 'Nenhum participante no ranking ainda.',
    rank1: '1º Lugar',
    rank2: '2º Lugar',
    rank3: '3º Lugar',
    fetchError: 'Erro ao buscar dados do ranking:',
    fetchErrorDescription: 'Não foi possível carregar os dados. Tente novamente.',
    authError: 'Usuário não autenticado',
    authErrorDescription: 'Faça login para ver o ranking.',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: CALENDAR
  // ══════════════════════════════════════════════
  colabCalendar: {
    title: 'Calendário',
    newPost: 'Novo Post',
    filterAll: 'Todos',
    filterPublished: 'Publicados',
    filterScheduled: 'Agendados',
    filterInProgress: 'Em andamento',
    filterIdeas: 'Ideias',
    filterFailed: 'Falhou',
    statusPublished: 'Publicado',
    statusScheduled: 'Agendado',
    statusIdea: 'Ideia',
    statusFailed: 'Falhou',
    dayNames: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    selectDay: 'Selecione um dia',
    noPostsScheduled: 'Nenhum post agendado',
    createForDay: 'Criar post para este dia',
    nextScheduled: 'Próximos agendamentos:',
    emptyState: 'Nenhum post agendado. Clique em um dia ou use o botão "Novo Post".',
    noPublished: 'Nenhum post publicado ainda',
    schedule: 'Agendar',
    viewOnLinkedin: 'Ver no LinkedIn ↗',
    publishedAt: 'Publicado em {date} às {time}',
    mediaAttached: 'Mídia anexada',
    postRemoved: 'Post removido.',
    loadError: 'Erro ao carregar posts',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR: AI ASSISTANT
  // ══════════════════════════════════════════════
  ai: {
    createCaption: 'Crie sua legenda',
    createCaptionDescription: 'Escreva sua ideia e nossa IA irá sugerir hooks para você escolher antes de gerar o post completo.',
    yourIdea: 'Sua ideia',
    ideaPlaceholder: 'Escreva sua ideia de post aqui...',
    format: 'Formato',
    formatLinkedin: 'LinkedIn',
    formatTextHeavy: 'Texto Denso',
    formatHybrid: 'Híbrido',
    size: 'Tamanho',
    sizeShort: 'Curto',
    sizeMedium: 'Médio',
    sizeLong: 'Longo',
    generateCaption: 'Gerar Legenda',
    chooseHook: 'Escolha seu hook',
    chooseHookDescription: 'Selecione a abertura que mais combina com você. O post será gerado a partir dela.',
    regenerateHooks: 'Gerar outros hooks',
    selectedHook: 'Hook selecionado:',
    preview: 'Preview do seu post',
    previewNoHook: 'Selecione um hook para gerar o post completo',
    previewEmpty: 'Gere uma legenda para ver como ficará no LinkedIn',
    copyCaption: 'Copiar legenda',
    copied: 'Copiado!',
    useCaption: 'Usar legenda',
    seeMore: '...ver mais',
    like: 'Gostei',
    comment: 'Comentar',
    repost: 'Repostar',
    send: 'Enviar',
    now: 'Agora',
    mediaNote: 'Mídia será adicionada no editor',
    reactions: 'Você e outras pessoas',
    loadingHooks: [
      'Lendo seu contexto de marca...',
      'Analisando seu tom de voz...',
      'Criando opções de hook...',
    ],
    loadingPost: [
      'Desenvolvendo o post com seu hook...',
      'Aplicando as melhores práticas...',
      'Criando uma legenda alinhada...',
      'Finalizando os ajustes...',
    ],
    errorEmptyIdea: 'Escreva sua ideia',
    errorEmptyIdeaMessage: 'O campo de ideia não pode estar vazio.',
    errorHooks: 'Erro ao gerar hooks',
    errorPost: 'Erro ao gerar post',
    errorAuth: 'Erro de autenticação',
    errorAuthMessage: 'Faça login novamente para continuar.',
  },

  // ══════════════════════════════════════════════
  // COLABORADOR LAYOUT (token warnings)
  // ══════════════════════════════════════════════
  colabLayout: {
    tokenExpired: 'Seu token do LinkedIn expirou. Reconecte para continuar publicando.',
    tokenExpiring: 'Seu token do LinkedIn expira em {days} dia(s). Reconecte para evitar interrupções.',
    reconnect: 'Reconectar',
  },

  // ══════════════════════════════════════════════
  // MASTER: COMPANIES
  // ══════════════════════════════════════════════
  masterCompanies: {
    title: 'Empresas',
    cardTitle: 'Gerenciamento de Empresas',
    cardDescription: 'Crie um novo ambiente de empresa e convide um administrador.',
    addCompany: 'Adicionar Empresa',
    addTitle: 'Adicionar Nova Empresa',
    addDescription: 'Preencha os dados para criar uma nova empresa. Ela começará com um free trial.',
    createAndInvite: 'Criar e Convidar Admin',
    companyName: 'Nome da Empresa',
    companyNamePlaceholder: 'Ex: TechCorp',
    adminName: 'Nome do Admin',
    adminNamePlaceholder: 'Ex: João Silva',
    adminEmail: 'E-mail do Admin',
    adminEmailPlaceholder: 'admin@techcorp.com',
    licenses: 'Número de Licenças (mín. 5)',
    licensesPlaceholder: 'Ex: 50',
    licensesHelp: 'Licenças contam apenas colaboradores (a conta de admin é gratuita). Mínimo de 5 licenças.',
    locale: 'Idioma do Ambiente',
    localeHelp: 'Define o idioma da interface para todos os usuários desta empresa. Não pode ser alterado depois.',
    tableCompany: 'Empresa',
    tableStatus: 'Status',
    tableLicenses: 'Licenças',
    tableAdmin: 'Admin',
    tableStartDate: 'Data de Início',
    tableLanguage: 'Idioma',
    loading: 'Carregando empresas...',
    empty: 'Nenhuma empresa encontrada.',
    viewEnvironment: 'Visualizar Ambiente',
    editTitle: 'Editar Empresa',
    editDescription: 'Altere o nome e as licenças da empresa.',
    deleteTitle: 'Excluir Empresa',
    deleteConfirm: 'Tem certeza que deseja excluir a empresa "{name}"? TODOS os dados serão permanentemente removidos: recompensas, missões, trilhas, biblioteca e usuários vinculados. Esta ação não pode ser desfeita.',
    toastCreated: 'Empresa e Admin Criados!',
    toastCreatedDescription: 'A empresa foi criada em modo Trial. O admin pode agora fazer login e iniciar a assinatura.',
    toastCreateError: 'Erro ao Criar Empresa',
    toastStatusChanged: 'Status da empresa alterado para {status}',
    toastStatusError: 'Erro ao alterar status da empresa.',
    toastUpdated: 'Empresa atualizada com sucesso!',
    toastUpdateError: 'Erro ao atualizar empresa.',
    toastDeleted: 'Empresa e todos os dados excluídos com sucesso!',
    toastDeleteError: 'Erro ao excluir empresa e seus dados.',
    toastFetchError: 'Erro ao buscar empresas',
  },

  // ══════════════════════════════════════════════
  // MASTER: DASHBOARD
  // ══════════════════════════════════════════════
  masterDashboard: {
    title: 'Master Dashboard',
    activeCompanies: 'Empresas Ativas',
    activeCompaniesDescription: '+2 novas este mês',
    totalCollaborators: 'Colaboradores Totais',
    totalCollaboratorsDescription: 'Em todas as empresas',
    globalTrails: 'Trilhas Globais',
    globalTrailsDescription: 'Conteúdos disponíveis',
    avgEngagement: 'Engajamento Médio',
    avgEngagementDescription: 'Atividade na plataforma',
    recentCompanies: 'Empresas Recentes',
    recentCompaniesDescription: 'As últimas empresas que se juntaram à plataforma.',
    view: 'Visualizar',
    fetchError: 'Erro ao buscar dados mestre',
  },

  // ══════════════════════════════════════════════
  // MASTER: TRAILS
  // ══════════════════════════════════════════════
  masterTrails: {
    title: 'Trilhas',
    sessionsTitle: 'Sessões de Aprendizagem',
    sessionsDescription: 'Gerencie sessões globais e suas trilhas',
    newSession: 'Nova Sessão',
    noSessions: 'Nenhuma sessão criada',
    noSessionsDescription: 'Crie sua primeira sessão de aprendizagem',
    createSession: 'Criar Sessão',
    newTrail: 'Nova Trilha',
    noTrails: 'Nenhuma trilha nesta sessão',
    noTrailsDescription: 'Crie a primeira trilha de aprendizagem',
    createTrail: 'Criar Trilha',
    newSessionTitle: 'Nova Sessão',
    newSessionDescription: 'Crie uma sessão personalizada',
    editSessionTitle: 'Editar Sessão',
    editSessionDescription: 'Atualize os dados da sessão',
    titleLabel: 'Título',
    titlePlaceholder: 'Ex: Módulo Básico',
    descriptionLabel: 'Descrição',
    descriptionPlaceholder: 'Descreva esta sessão...',
    orderLabel: 'Ordem',
    localeLabel: 'Idioma',
    localeHelp: 'Trilhas globais são filtradas por idioma. Empresas só veem trilhas no seu idioma.',
    toastSessionSaved: 'Sessão salva com sucesso!',
    toastSessionSaveError: 'Erro ao salvar sessão',
    toastSessionStatusChanged: 'Status alterado com sucesso!',
    toastSessionStatusError: 'Erro ao alterar status',
    toastSessionDeleted: 'Sessão excluída com sucesso!',
    toastSessionDeleteError: 'Erro ao excluir sessão',
    toastTrailSaved: 'Trilha salva com sucesso!',
    toastTrailSaveError: 'Erro ao salvar trilha',
    toastTrailDeleted: 'Trilha excluída com sucesso!',
    toastTrailDeleteError: 'Erro ao excluir trilha',
    toastLoadSessionsError: 'Erro ao carregar sessões',
    toastLoadTrailsError: 'Erro ao carregar trilhas',
    deleteSessionConfirm: 'Tem certeza que deseja excluir esta sessão e todas as suas trilhas?',
    deleteTrailConfirm: 'Tem certeza que deseja excluir esta trilha?',
    validationTitleRequired: 'Título obrigatório',
    validationTitleMessage: 'Preencha o título da trilha para salvar.',
  },

  // ══════════════════════════════════════════════
  // TRAIL TYPES
  // ══════════════════════════════════════════════
  trailTypes: {
    aula: 'Aula (Vídeo)',
    leitura: 'Leitura',
    desafio: 'Desafio (Quiz)',
    facaVoceMesmo: 'Faça Você Mesmo',
    missaoConteudo: 'Missão de Conteúdo',
  },

} as const;

export type Dictionary = typeof ptBR;
export default ptBR;
```

---

## 12. Pattern de Uso nos Componentes

### Antes (hardcoded):
```tsx
<h1>Dashboard</h1>
<p>Carregando...</p>
<Button>Salvar</Button>
<span>{format(date, 'dd/MM/yyyy', { locale: ptBR })}</span>
```

### Depois (i18n):
```tsx
const t = useT();
const { format: fmtDate } = useFormatDate();

<h1>{t.adminDashboard.title}</h1>
<p>{t.common.loading}</p>
<Button>{t.common.save}</Button>
<span>{fmtDate(date, 'dd/MM/yyyy')}</span>
```

### Com interpolação:
```tsx
import { interpolate } from '@/lib/i18n/interpolate';

<p>{interpolate(t.colabDashboard.greeting, { name: user.name })}</p>
// → "Olá, Clara!" ou "Hello, Clara!"
```

---

## 13. Verificação Pós-Implementação

1. `npm run build` — sem erros
2. Testar fluxo completo em PT (nada deve mudar)
3. Criar empresa teste com `locale: 'en'` no Master
4. Login como admin dessa empresa → toda a interface deve estar em inglês
5. Login como colaborador → toda a interface deve estar em inglês
6. Verificar que IA gera conteúdo em inglês
7. Verificar que trilhas globais são filtradas por idioma
8. Verificar que empresas existentes (sem campo locale) funcionam normal em PT
9. Toggle PT/EN funciona nas páginas públicas (login, beta-test)
