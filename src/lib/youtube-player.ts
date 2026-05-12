/**
 * YouTube IFrame Player API helpers.
 *
 * Usado pelo player de trilha (/colaborador/trilhas/[id]) pra rastrear
 * progresso real de vídeo (80% pra liberar conclusão). Veja
 * /specs/trilha-video-tracking.md.
 */

// ---------------------------------------------------------------------------
// Tipos mínimos do namespace YT — só o que usamos. Evita instalar
// @types/youtube como dependência.
// ---------------------------------------------------------------------------

export interface YTPlayer {
  getDuration(): number;
  getCurrentTime(): number;
  destroy(): void;
}

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YTPlayerStateValue = typeof YT_PLAYER_STATE[keyof typeof YT_PLAYER_STATE];

export interface YTPlayerEvent {
  target: YTPlayer;
  data: YTPlayerStateValue;
}

export interface YTPlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
    onError?: (e: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: typeof YT_PLAYER_STATE;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ---------------------------------------------------------------------------
// extractYouTubeVideoId
// ---------------------------------------------------------------------------

/**
 * Extrai o videoId de uma URL do YouTube em qualquer formato comum:
 * - https://youtu.be/VIDEO_ID
 * - https://youtu.be/VIDEO_ID?si=...
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID&t=42s
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID?si=...&autoplay=1
 *
 * Retorna null se a URL não for do YouTube ou se não der pra extrair o ID.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  return null;
}

// ---------------------------------------------------------------------------
// loadYouTubeAPI
// ---------------------------------------------------------------------------

const YT_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
let loadPromise: Promise<YTNamespace> | null = null;

/**
 * Carrega o script da YouTube IFrame API uma única vez na página e resolve
 * quando window.YT está disponível. Chamadas subsequentes reaproveitam a
 * mesma Promise.
 *
 * Roda apenas no browser. Em SSR retorna uma Promise que nunca resolve
 * (o caller deve verificar typeof window antes de chamar).
 */
export function loadYouTubeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return new Promise(() => { /* SSR: never resolves */ });
  }

  // Já carregado
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  // Já em curso
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<YTNamespace>((resolve) => {
    // Se a API resolver via callback global antes do nosso polling
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) {
        try { previousCallback(); } catch { /* ignore */ }
      }
      if (window.YT) resolve(window.YT);
    };

    // Verifica se o script já existe (outro componente pode ter injetado)
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${YT_SCRIPT_SRC}"]`
    );
    if (!existing) {
      const script = document.createElement('script');
      script.src = YT_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return loadPromise;
}
