// src/components/onboarding/welcome-popup.tsx
// Full-screen welcome chat popup with Fai persona.
// Shows role-specific messages with branded CSS animations.
// Displayed on first login, before the onboarding checklist.

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, Heart, MessageCircle, Bookmark, Sparkles, Eye, Send, Linkedin, Loader2 } from 'lucide-react';
import type { OnboardingRole } from '@/hooks/use-onboarding';
import './onboarding-animations.css';

// ─── Types ───────────────────────────────────────────────────

/**
 * Reading time bucket for each message — used to calibrate the
 * delay (and typing indicator) shown BEFORE the message appears.
 *
 *  short  — saudação/frase curta (~ até 60 chars)
 *  medium — uma frase (~60–140 chars)
 *  long   — parágrafo (~140–250 chars) ou frase + animação inline
 *  xl     — parágrafo + card/lista/botão/tutorial
 *  anim   — animação dedicada (sem texto)
 */
type ReadingTime = 'short' | 'medium' | 'long' | 'xl' | 'anim';

const READING_DELAYS: Record<ReadingTime, number> = {
  short: 5000,
  medium: 6500,
  long: 8000,
  xl: 10000,
  anim: 4000,
};

/** Pausa curta entre a mensagem anterior e o typing indicator (ms). */
const POST_MESSAGE_PAUSE = 250;

type ChatMessage = {
  type: 'fai' | 'anim';
  content?: React.ReactNode;
  animation?: React.ReactNode;
  /** Quanto tempo a Fai "leva digitando" antes desta mensagem aparecer. */
  readingTime?: ReadingTime;
};

type WelcomePopupProps = {
  open: boolean;
  role: OnboardingRole;
  userName: string;
  companyName?: string;
  licensesCount?: number;
  /** Chamado quando o usuário clica em "Fazer upload do histórico" na mensagem do popup */
  onRequestUpload?: () => void;
  /** true quando o upload histórico já foi concluído — desbloqueia o botão "Vamos lá!" */
  historyUploaded?: boolean;
  /** Chamado quando o usuário clica em "Conectar LinkedIn" dentro do popup */
  onRequestLinkedInConnect?: () => void;
  onComplete: () => void;
};

// ─── Animation Components ────────────────────────────────────

function RocketAnimation() {
  return (
    <div className="ob-rocket-wrap">
      <span className="ob-rocket-star" /><span className="ob-rocket-star" />
      <span className="ob-rocket-star" /><span className="ob-rocket-star" />
      <div className="ob-rocket-body">
        <div className="ob-rocket">
          <div className="ob-rocket-tip" />
          <div className="ob-rocket-main" />
          <div className="ob-rocket-window" />
          <div className="ob-rocket-fin left" />
          <div className="ob-rocket-fin right" />
          <div className="ob-rocket-flame" />
        </div>
      </div>
    </div>
  );
}

function PostPublishingAnimation({ initials, author }: { initials: string; author: string }) {
  return (
    <div className="ob-post-card">
      <div className="ob-post-header">
        <div className="ob-post-avatar">{initials}</div>
        <div className="ob-post-author">{author}</div>
        <div className="ob-post-status" />
      </div>
      <div className="ob-post-body">&ldquo;Conteúdo corporativo morreu. Quem fala agora são as pessoas...&rdquo;</div>
      <div className="ob-post-metrics">
        <div className="ob-post-metric"><Heart className="h-[11px] w-[11px] fill-current" /><span>847</span></div>
        <div className="ob-post-metric"><MessageCircle className="h-[11px] w-[11px]" /><span>23</span></div>
        <div className="ob-post-metric"><Bookmark className="h-[11px] w-[11px]" /><span>52</span></div>
      </div>
    </div>
  );
}

function IAWritingAnimation() {
  return (
    <div className="ob-ia-card">
      <div className="ob-ia-header">
        <div className="ob-ia-spark"><Sparkles className="h-4 w-4" /></div>
        <div className="ob-ia-label">Assistente IA</div>
        <div className="ob-ia-status">gerando</div>
      </div>
      <div className="ob-ia-text">
        <span className="ob-ia-line">Conteúdo bom não nasce</span>
        <span className="ob-ia-line">de boa vontade...</span>
      </div>
    </div>
  );
}

function GiftAnimation() {
  return (
    <div className="ob-gift-wrap">
      <div className="ob-gift-box">
        <div className="ob-gift-base" />
        <div className="ob-gift-lid" />
        <div className="ob-gift-bow" />
        <span className="ob-confetti" /><span className="ob-confetti" />
        <span className="ob-confetti" /><span className="ob-confetti" />
        <span className="ob-confetti" /><span className="ob-confetti" />
        <span className="ob-confetti" /><span className="ob-confetti" />
      </div>
      <div className="ob-gift-badge">
        <Check className="h-[11px] w-[11px] text-green-500" />
        +150 pts · <span className="pts">Recompensa!</span>
      </div>
    </div>
  );
}

function WorkflowAnimation() {
  return (
    <div className="ob-workflow-wrap">
      <div className="ob-wf-nodes">
        <div className="ob-wf-node">
          <div className="ob-wf-icon create"><Sparkles className="h-[14px] w-[14px]" /></div>
          <div><div className="ob-wf-label">Equipe cria</div><div className="ob-wf-sublabel">IA + estratégia</div></div>
        </div>
        <div className="ob-wf-connector" />
        <div className="ob-wf-node">
          <div className="ob-wf-icon review"><Eye className="h-[14px] w-[14px]" /></div>
          <div><div className="ob-wf-label">Você revisa</div><div className="ob-wf-sublabel">no backlog</div></div>
        </div>
        <div className="ob-wf-connector" />
        <div className="ob-wf-node">
          <div className="ob-wf-icon approve"><Check className="h-[14px] w-[14px]" /></div>
          <div><div className="ob-wf-label">Aprova</div><div className="ob-wf-sublabel">com 1 clique</div></div>
        </div>
        <div className="ob-wf-connector" />
        <div className="ob-wf-node">
          <div className="ob-wf-icon publish"><Send className="h-[14px] w-[14px]" /></div>
          <div><div className="ob-wf-label">Publica</div><div className="ob-wf-sublabel">automaticamente</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── LinkedIn Analytics Tutorial Animation ───────────────────

function LinkedInExportTutorial({ onUploadClick, onSkip }: { onUploadClick: () => void; onSkip?: () => void }) {
  const [skipped, setSkipped] = useState(false);

  if (skipped) {
    return (
      <div className="mt-3 rounded-[10px] border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground text-center">
        Sem problema. Você pode subir o histórico depois nas configurações.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Tutorial steps */}
      <div className="bg-white/70 border border-primary/10 rounded-[12px] p-3 space-y-2">
        <p className="text-xs font-bold text-foreground/80">Como exportar do LinkedIn Analytics:</p>
        <div className="space-y-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/15 text-primary font-bold flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5">1</span>
            <span>Abra o <a href="https://www.linkedin.com/analytics/creator/content/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">LinkedIn Analytics</a></span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/15 text-primary font-bold flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5">2</span>
            <span>Selecione <strong>Personalizado</strong> e defina os últimos <strong>12 meses</strong></span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/15 text-primary font-bold flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5">3</span>
            <span>Clique em <strong>Exportar</strong> → baixe o arquivo <code className="bg-muted px-1 rounded text-[10px]">.xlsx</code></span>
          </div>
        </div>
      </div>
      {/* Upload button */}
      <button
        onClick={onUploadClick}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-[#E875FF] text-white font-headline font-extrabold text-xs rounded-[10px] shadow-[0_2px_10px_rgba(205,80,241,.25)] hover:shadow-[0_4px_16px_rgba(205,80,241,.35)] hover:-translate-y-px transition-all flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Fazer upload do histórico
      </button>
      {/* Pular discreto — propositalmente pequeno pra não competir com o CTA */}
      {onSkip && (
        <button
          type="button"
          onClick={() => { setSkipped(true); onSkip(); }}
          className="block mx-auto text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground/80 hover:underline underline-offset-2 transition-colors"
        >
          pular por enquanto
        </button>
      )}
    </div>
  );
}

// ─── Checklist items per role (for display in chat) ──────────
// Mantidos em sincronia com os checklists definidos em
// src/hooks/use-onboarding.ts. Se algum item for adicionado/renomeado
// lá, atualize aqui também.

const ADMIN_ITEMS = [
  'Preencher Manual de Marca',
  'Convidar um colaborador',
  'Criar uma missão',
  'Adicionar uma recompensa',
  'Ativar as trilhas globais',
];

const COLAB_ITEMS = [
  'Começar uma trilha',
  'Preencher Manual de Marca Pessoal',
  'Usar uma ideia de conteúdo',
  'Agendar um conteúdo',
  'Fazer sua primeira publicação',
  'Fazer uma compra na loja',
  'Completar uma missão',
];

const TL_ITEMS = [
  'Aprovar um conteúdo',
  'Publicar seu primeiro post',
  'Comentar em um post',
];

// ─── Message builders ────────────────────────────────────────

function getAdminMessages(name: string, licenses: number): ChatMessage[] {
  return [
    {
      type: 'fai',
      readingTime: 'short',
      content: <>Oi, <strong>{name}</strong>! Sou a <strong>Fai</strong>, sua assistente aqui na Boldfy.</>,
    },
    {
      type: 'fai',
      readingTime: 'medium',
      content: <>Seu programa de Employee Advocacy vai <strong>transformar seu time em vozes ativas</strong> no LinkedIn.</>,
    },
    {
      type: 'anim',
      readingTime: 'anim',
      animation: <RocketAnimation />,
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Posts são criados, aprovados e <strong>publicados direto da plataforma</strong>:
          <div className="ob-anim-inline"><PostPublishingAnimation initials="CR" author="Clara Ramos" /></div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'medium',
      content: <>Na plataforma, você pode adicionar <strong>dois tipos de usuário</strong>. Te explico:</>,
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Os primeiros são os <strong>Colaboradores</strong>:
          <div className="mt-2 bg-white/70 border border-primary/10 rounded-[10px] px-3 py-2">
            <div className="text-xs font-bold text-foreground">👥 Colaboradores</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Escrevem seus próprios posts com ajuda da IA, completam missões e ganham pontos. Ideais pra escalar o Employee Advocacy do time.</div>
          </div>
          <div className="mt-2 text-[13px]">Eles <strong>completam missões, ganham pontos e trocam por recompensas reais</strong> — assim o time engaja e cresce junto!</div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Os outros são os <strong>Thought Leaders</strong>:
          <div className="mt-2 bg-white/70 border border-primary/10 rounded-[10px] px-3 py-2">
            <div className="text-xs font-bold text-foreground">🎯 Thought Leaders</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Executivos ou porta-vozes que recebem conteúdo pronto da equipe de estratégia. Eles só revisam, aprovam e publicam.</div>
          </div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'medium',
      content: <>Você tem <span className="text-primary font-bold">{licenses} licenças de colaborador</span>. Pra adicionar Thought Leaders, fale com o time Boldfy.</>,
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Antes de tudo, você precisa preencher o <strong>Manual de Marca da empresa</strong>. É dele que <strong>toda IA da plataforma se alimenta</strong> pra escrever no tom de voz certo — sem isso, o conteúdo do time sai genérico.
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Preparei um checklist rápido pra configurar tudo:
          <div className="mt-2 flex flex-col gap-1.5">
            {ADMIN_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs font-medium text-foreground/80 bg-white/70 border border-primary/10 rounded-[10px] px-2.5 py-1.5">
                <div className="w-[18px] h-[18px] rounded-full border-2 border-border flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </>
      ),
    },
  ];
}

function LinkedInConnectButton({ onConnect, onSkip }: { onConnect: () => void; onSkip?: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [skipped, setSkipped] = useState(false);

  if (skipped) {
    return (
      <div className="mt-3 rounded-[10px] border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground text-center">
        Sem problema. Você pode conectar depois nas configurações.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={() => { setConnecting(true); onConnect(); }}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-[#0A66C2]/40 bg-[#0A66C2]/5 hover:bg-[#0A66C2]/10 text-[#0A66C2] font-bold text-xs px-3 py-2.5 transition-colors"
      >
        {connecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Linkedin className="h-3.5 w-3.5" />
        )}
        {connecting ? 'Conectando...' : 'Conectar LinkedIn'}
      </button>
      {/* Pular discreto — propositalmente pequeno pra não competir com o CTA */}
      {onSkip && !connecting && (
        <button
          type="button"
          onClick={() => { setSkipped(true); onSkip(); }}
          className="block mx-auto text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground/80 hover:underline underline-offset-2 transition-colors"
        >
          pular por enquanto
        </button>
      )}
    </div>
  );
}

function getColaboradorMessages(
  name: string,
  company: string,
  onUploadClick: () => void,
  onLinkedInConnect: () => void,
  onSkipLinkedIn: () => void,
  onSkipUpload: () => void,
): ChatMessage[] {
  return [
    {
      type: 'fai',
      readingTime: 'short',
      content: <>Oi, <strong>{name}</strong>! Bem-vindo(a) à <strong>{company}</strong>!</>,
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Aqui você tem uma <strong>IA que escreve com a sua voz</strong>. Não é template genérico, é conteúdo que parece você:
          <div className="ob-anim-inline"><IAWritingAnimation /></div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'medium',
      content: <>Você completa missões, ganha pontos e troca por <strong>recompensas reais</strong>!</>,
    },
    {
      type: 'anim',
      readingTime: 'anim',
      animation: <GiftAnimation />,
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Antes de tudo, você precisa preencher seu <strong>Manual de Marca Pessoal</strong>. Isso define sua voz, seus pilares e o que você quer comunicar. É <strong>daí que a IA aprende a escrever do seu jeito</strong> — sem isso, ela escreve genérico.
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Agora você precisa <strong>conectar seu perfil do LinkedIn</strong>. É por lá que a IA vai publicar os posts no seu nome — sem isso, nada rola!
          <LinkedInConnectButton onConnect={onLinkedInConnect} onSkip={onSkipLinkedIn} />
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Agora preciso do seu <strong>histórico do LinkedIn Analytics</strong>. Isso ativa os gráficos de evolução do seu perfil — e você verá sua evolução desde o início.
          <LinkedInExportTutorial onUploadClick={onUploadClick} onSkip={onSkipUpload} />
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Vou te mostrar a plataforma agora! Depois, preparei <strong>{COLAB_ITEMS.length} ações</strong> pra você completar. Quando terminar, você ganha:
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-amber-50/50 border border-amber-200/30 text-amber-500 font-extrabold text-xs px-3 py-1.5 rounded-full mt-1">
            <Sparkles className="h-3.5 w-3.5" />+150 pontos!
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {COLAB_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs font-medium text-foreground/80 bg-white/70 border border-primary/10 rounded-[10px] px-2.5 py-1.5">
                <div className="w-[18px] h-[18px] rounded-full border-2 border-border flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </>
      ),
    },
  ];
}

function getThoughtLeaderMessages(
  name: string,
  onUploadClick: () => void,
  onLinkedInConnect: () => void,
  onSkipLinkedIn: () => void,
  onSkipUpload: () => void,
): ChatMessage[] {
  return [
    {
      type: 'fai',
      readingTime: 'short',
      content: <>Oi, <strong>{name}</strong>! Sou a <strong>Fai</strong>, sua assistente aqui na Boldfy.</>,
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          A equipe de estratégia vai preparar seus posts e você <strong>publica direto da plataforma</strong>, sem sair do app:
          <div className="ob-anim-inline"><PostPublishingAnimation initials="TL" author="Seu Post" /></div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Seu fluxo é simples. Tudo num <strong>pipeline automatizado</strong>:
          <div className="ob-anim-inline"><WorkflowAnimation /></div>
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Antes de tudo, você precisa <strong>conectar seu perfil do LinkedIn</strong>. É por lá que a equipe vai publicar os posts no seu nome — sem isso, nada rola!
          <LinkedInConnectButton onConnect={onLinkedInConnect} onSkip={onSkipLinkedIn} />
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'xl',
      content: (
        <>
          Pra ativar seu <strong>dashboard de Analytics</strong>, vou precisar do seu histórico do LinkedIn. Com ele, você já estreia com os gráficos de evolução do seu perfil desde o início.
          <LinkedInExportTutorial onUploadClick={onUploadClick} onSkip={onSkipUpload} />
        </>
      ),
    },
    {
      type: 'fai',
      readingTime: 'long',
      content: (
        <>
          Vou te mostrar a plataforma agora! Depois, preparei <strong>{TL_ITEMS.length} ações</strong> pra você começar de verdade:
          <div className="mt-2 flex flex-col gap-1.5">
            {TL_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs font-medium text-foreground/80 bg-white/70 border border-primary/10 rounded-[10px] px-2.5 py-1.5">
                <div className="w-[18px] h-[18px] rounded-full border-2 border-border flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </>
      ),
    },
  ];
}

// ─── Component ───────────────────────────────────────────────

export function WelcomePopup({
  open,
  role,
  userName,
  companyName = '',
  licensesCount = 5,
  onRequestUpload,
  historyUploaded = false,
  onRequestLinkedInConnect,
  onComplete,
}: WelcomePopupProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  // Quando o usuário clica "pular por enquanto" no upload histórico,
  // destravamos o botão "Vamos lá!" sem marcar o item do checklist como
  // completo (o item continua pendente no FaiWidget).
  const [historySkipped, setHistorySkipped] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Apenas Colaborador precisa do upload histórico no welcome para liberar "Vamos lá!"
  // TL não é bloqueado pelo upload — ele vai conectar o LinkedIn depois
  const needsHistoricalUpload = role === 'colaborador';

  const handleUploadClick = useCallback(() => {
    onRequestUpload?.();
  }, [onRequestUpload]);

  const handleLinkedInConnect = useCallback(() => {
    onRequestLinkedInConnect?.();
  }, [onRequestLinkedInConnect]);

  // LinkedIn skip não precisa de estado externo: o próprio LinkedInConnectButton
  // lida com a UI internamente. Passamos um no-op só pra ativar o botão "pular".
  const handleSkipLinkedIn = useCallback(() => {
    // intencionalmente vazio — o LinkedInConnectButton trata o estado visual
  }, []);

  const handleSkipUpload = useCallback(() => {
    setHistorySkipped(true);
  }, []);

  const messages = useMemo(() => {
    if (role === 'admin') {
      return getAdminMessages(userName, licensesCount);
    }
    if (role === 'colaborador') {
      return getColaboradorMessages(
        userName,
        companyName,
        handleUploadClick,
        handleLinkedInConnect,
        handleSkipLinkedIn,
        handleSkipUpload,
      );
    }
    return getThoughtLeaderMessages(
      userName,
      handleUploadClick,
      handleLinkedInConnect,
      handleSkipLinkedIn,
      handleSkipUpload,
    );
  }, [role, userName, companyName, licensesCount, handleUploadClick, handleLinkedInConnect, handleSkipLinkedIn, handleSkipUpload]);

  // Mantemos a lista de readingTimes em ref pra evitar reagendar quando o
  // conteúdo das mensagens mudar (ex: estados internos dos CTAs do LinkedIn).
  const readingTimesRef = useRef<ReadingTime[]>([]);
  readingTimesRef.current = messages.map((m) => m.readingTime ?? 'medium');

  // Progressive message reveal — chain of setTimeouts with typing indicator
  // shown BEFORE each message arrives (mensagem N exibida → respiro curto →
  // typing indicator → delay calibrado pelo tamanho da próxima → mensagem N+1).
  useEffect(() => {
    if (!open) {
      setVisibleCount(0);
      setIsTyping(false);
      return;
    }

    const total = readingTimesRef.current.length;
    if (total === 0) return;

    // Respeita preferência do usuário por menos animação
    const reduced = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reductionFactor = reduced ? 0.15 : 1;

    // Primeira mensagem aparece imediatamente
    setVisibleCount(1);
    setIsTyping(false);

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let i = 1;

    const scheduleNext = () => {
      if (cancelled || i >= total) return;

      const nextReadingTime = readingTimesRef.current[i] ?? 'medium';
      const baseDelay = READING_DELAYS[nextReadingTime];
      // Garantimos um mínimo de 800ms mesmo em reduced-motion pra não atropelar
      const typingDelay = Math.max(800, baseDelay * reductionFactor);

      // Fase 1: pequena pausa pra "respiro" depois da mensagem anterior
      const t1 = setTimeout(() => {
        if (cancelled) return;
        setIsTyping(true);

        // Fase 2: typing indicator visível durante o delay calibrado
        const t2 = setTimeout(() => {
          if (cancelled) return;
          setIsTyping(false);
          i += 1;
          setVisibleCount(i);
          scheduleNext();
        }, typingDelay);
        timeouts.push(t2);
      }, POST_MESSAGE_PAUSE);
      timeouts.push(t1);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [open, messages.length]);

  // Auto-scroll as messages appear (ou o typing indicator)
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [visibleCount, isTyping]);

  const allVisible = visibleCount >= messages.length;

  // Botão "Vamos lá!" só fica habilitado quando:
  // - Todas as mensagens foram reveladas (allVisible)
  // - Para Colaborador: precisa ter feito o upload histórico OU explicitamente pulado
  const canProceed = allVisible && (!needsHistoricalUpload || historyUploaded || historySkipped);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[560px] p-0 gap-0 overflow-hidden border-border/50 rounded-3xl shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-background to-secondary/50">
          <Image
            src="/images/email/fai-avatar.png"
            alt="Fai"
            width={44}
            height={44}
            className="rounded-full border-2 border-white shadow-sm"
          />
          <div>
            <div className="font-headline text-[15px] font-black text-foreground">Fai</div>
            <div className="text-[11px] text-muted-foreground">Assistente Boldfy</div>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500 -ml-1 mt-3.5 border-2 border-white" />
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          className="px-6 py-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto"
        >
          {messages.slice(0, visibleCount).map((msg, idx) => (
            <div
              key={idx}
              className="ob-msg-in"
              style={{ animationDelay: `${idx === visibleCount - 1 ? 0 : 0}ms` }}
            >
              {msg.type === 'fai' ? (
                <div className="flex gap-2.5 items-start">
                  <Image
                    src="/images/email/fai-avatar.png"
                    alt="Fai"
                    width={32}
                    height={32}
                    className="rounded-full border border-border flex-shrink-0"
                  />
                  <div className="bg-secondary border border-primary/[0.08] rounded-[2px_16px_16px_16px] px-4 py-3 text-[13px] leading-relaxed text-foreground max-w-[440px]">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="ob-anim-dedicated">
                  <div className="ob-anim-inline">{msg.animation}</div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator — só visível entre uma mensagem e outra,
              durante o "tempo de digitação" da Fai. */}
          {isTyping && (
            <div className="flex gap-2.5 items-start ob-msg-in" aria-live="polite" aria-label="Fai está digitando">
              <Image
                src="/images/email/fai-avatar.png"
                alt="Fai"
                width={32}
                height={32}
                className="rounded-full border border-border flex-shrink-0"
              />
              <div className="bg-secondary border border-primary/[0.08] rounded-[2px_16px_16px_16px] px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="px-6 py-4 border-t bg-background/50 space-y-2">
          {/* Hint quando o upload ainda não foi feito nem pulado */}
          {allVisible && needsHistoricalUpload && !historyUploaded && !historySkipped && (
            <p className="text-center text-xs text-muted-foreground">
              Faça o upload do histórico para continuar ↑
            </p>
          )}
          <button
            onClick={onComplete}
            disabled={!canProceed}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-primary to-[#E875FF] text-white font-headline font-extrabold text-sm rounded-[14px] shadow-[0_4px_16px_rgba(205,80,241,.3)] hover:shadow-[0_8px_24px_rgba(205,80,241,.4)] hover:-translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_16px_rgba(205,80,241,.3)]"
          >
            Vamos lá! →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
