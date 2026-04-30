// src/components/onboarding/welcome-popup.tsx
// Full-screen welcome chat popup with Fai persona.
// Shows role-specific messages with branded CSS animations.
// Displayed on first login, before the onboarding checklist.

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, Heart, MessageCircle, Bookmark, Sparkles, Eye, Send } from 'lucide-react';
import type { OnboardingRole } from '@/hooks/use-onboarding';
import './onboarding-animations.css';

// ─── Types ───────────────────────────────────────────────────

type ChatMessage = {
  type: 'fai' | 'anim';
  content?: React.ReactNode;
  animation?: React.ReactNode;
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

function LinkedInExportTutorial({ onUploadClick }: { onUploadClick: () => void }) {
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
    </div>
  );
}

// ─── Checklist items per role (for display in chat) ──────────

const ADMIN_ITEMS = [
  'Preencher Brand Context',
  'Convidar um colaborador',
  'Criar uma missão',
  'Adicionar uma recompensa',
  'Ativar as trilhas globais',
];

const COLAB_ITEMS = [
  'Conectar LinkedIn',
  'Importar histórico LinkedIn',
  'Ver uma trilha',
  'Criar um post',
  'Completar uma missão',
];

const TL_ITEMS = [
  'Backlog — revise e aprove seus posts',
  'Calendário — veja sua pauta',
  'LinkedIn Feed — acompanhe seus colegas',
  'Analytics — seu dashboard de análise',
  'Perfil do LinkedIn — perfil conectado',
  'Estratégia — sua estratégia de conteúdo',
  'Manual de Marca — seu guia de voz',
];

// ─── Message builders ────────────────────────────────────────

function getAdminMessages(name: string, licenses: number): ChatMessage[] {
  return [
    {
      type: 'fai',
      content: <>Oi, <strong>{name}</strong>! Sou a <strong>Fai</strong>, sua assistente aqui na Boldfy.</>,
    },
    {
      type: 'fai',
      content: <>Seu programa de Employee Advocacy vai <strong>transformar seu time em vozes ativas</strong> no LinkedIn.</>,
    },
    {
      type: 'anim',
      animation: <RocketAnimation />,
    },
    {
      type: 'fai',
      content: (
        <>
          Posts são criados, aprovados e <strong>publicados direto da plataforma</strong>:
          <div className="ob-anim-inline"><PostPublishingAnimation initials="CR" author="Clara Ramos" /></div>
        </>
      ),
    },
    {
      type: 'fai',
      content: <>Na plataforma, você pode adicionar <strong>dois tipos de usuário</strong>. Te explico:</>,
    },
    {
      type: 'fai',
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
      content: <>Você tem <span className="text-primary font-bold">{licenses} licenças de colaborador</span>. Pra adicionar Thought Leaders, fale com o time Boldfy.</>,
    },
    {
      type: 'fai',
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

function getColaboradorMessages(name: string, company: string, onUploadClick: () => void): ChatMessage[] {
  return [
    {
      type: 'fai',
      content: <>Oi, <strong>{name}</strong>! Bem-vindo(a) à <strong>{company}</strong>!</>,
    },
    {
      type: 'fai',
      content: (
        <>
          Aqui você tem uma <strong>IA que escreve com a sua voz</strong>. Não é template genérico, é conteúdo que parece você:
          <div className="ob-anim-inline"><IAWritingAnimation /></div>
        </>
      ),
    },
    {
      type: 'fai',
      content: <>Você completa missões, ganha pontos e troca por <strong>recompensas reais</strong>!</>,
    },
    {
      type: 'anim',
      animation: <GiftAnimation />,
    },
    {
      type: 'fai',
      content: (
        <>
          Antes de começar, preciso do seu <strong>histórico do LinkedIn Analytics</strong>. Isso ativa os gráficos de evolução do seu perfil — e você verá sua evolução desde o início.
          <LinkedInExportTutorial onUploadClick={onUploadClick} />
        </>
      ),
    },
    {
      type: 'fai',
      content: (
        <>
          Preparei uns passos rápidos pra começar. Quando completar, você ganha:
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

function getThoughtLeaderMessages(name: string, onUploadClick: () => void): ChatMessage[] {
  return [
    {
      type: 'fai',
      content: <>Oi, <strong>{name}</strong>! Sou a <strong>Fai</strong>, sua assistente aqui na Boldfy.</>,
    },
    {
      type: 'fai',
      content: (
        <>
          A equipe de estratégia vai preparar seus posts e você <strong>publica direto da plataforma</strong>, sem sair do app:
          <div className="ob-anim-inline"><PostPublishingAnimation initials="TL" author="Seu Post" /></div>
        </>
      ),
    },
    {
      type: 'fai',
      content: (
        <>
          Seu fluxo é simples. Tudo num <strong>pipeline automatizado</strong>:
          <div className="ob-anim-inline"><WorkflowAnimation /></div>
        </>
      ),
    },
    {
      type: 'fai',
      content: (
        <>
          Antes de tudo, você precisa <strong>conectar seu perfil do LinkedIn</strong>. É por lá que a equipe vai publicar os posts no seu nome — sem isso, nada rola!
          <div className="mt-3 bg-white/70 border border-primary/10 rounded-[12px] p-3 space-y-1.5">
            <p className="text-xs font-bold text-foreground/80">Como conectar:</p>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary font-bold flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5">1</span>
                <span>Vá em <strong>Configurações</strong> no menu lateral</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary font-bold flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5">2</span>
                <span>Clique em <strong>Conectar LinkedIn</strong> e autorize o acesso</span>
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      type: 'fai',
      content: (
        <>
          Pra ativar seu <strong>dashboard de Analytics</strong>, vou precisar do seu histórico do LinkedIn. Com ele, você já estreia com os gráficos de evolução do seu perfil desde o início.
          <LinkedInExportTutorial onUploadClick={onUploadClick} />
        </>
      ),
    },
    {
      type: 'fai',
      content: (
        <>
          Vou te apresentar cada parte da plataforma. Conforme você explora, vai completando essas etapas:
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
  onComplete,
}: WelcomePopupProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Apenas Colaborador precisa do upload histórico no welcome para liberar "Vamos lá!"
  // TL não é bloqueado pelo upload — ele vai conectar o LinkedIn depois
  const needsHistoricalUpload = role === 'colaborador';

  const handleUploadClick = () => {
    onRequestUpload?.();
  };

  const messages = role === 'admin'
    ? getAdminMessages(userName, licensesCount)
    : role === 'colaborador'
    ? getColaboradorMessages(userName, companyName, handleUploadClick)
    : getThoughtLeaderMessages(userName, handleUploadClick);

  // Progressive message reveal
  useEffect(() => {
    if (!open) {
      setVisibleCount(0);
      return;
    }

    // Show first message immediately
    setVisibleCount(1);

    let i = 1;
    const delay = role === 'thoughtleader' ? 2000 : 1200; // TL gets more reading time
    const interval = setInterval(() => {
      i++;
      if (i > messages.length) {
        clearInterval(interval);
        return;
      }
      setVisibleCount(i);
    }, delay);

    return () => clearInterval(interval);
  }, [open, messages.length]);

  // Auto-scroll as messages appear
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [visibleCount]);

  const allVisible = visibleCount >= messages.length;

  // Botão "Vamos lá!" só fica habilitado quando:
  // - Todas as mensagens foram reveladas (allVisible)
  // - Para TL e Colaborador: também precisa ter feito o upload histórico
  const canProceed = allVisible && (!needsHistoricalUpload || historyUploaded);

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

          {/* Typing indicator while messages are loading */}
          {!allVisible && (
            <div className="flex gap-2.5 items-start ob-msg-in">
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
          {/* Hint quando o upload ainda não foi feito */}
          {allVisible && needsHistoricalUpload && !historyUploaded && (
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
