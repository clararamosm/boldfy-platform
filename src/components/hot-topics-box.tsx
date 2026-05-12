'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, ChevronLeft, ChevronRight, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { getHotTopics, regenerateHotTopics, type HotTopic } from '@/app/actions/hot-topics';
import { getAuthToken } from '@/lib/auth-client';

type HotTopicsBoxProps = {
  onSelectTopic: (prompt: string) => void;
  showRegenerate?: boolean;
};

export function HotTopicsBox({ onSelectTopic, showRegenerate = false }: HotTopicsBoxProps) {
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [semana, setSemana] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Como o backend devolve 6 tópicos fixos, capamos em 3 por página pra
  // ter 3+3 (em vez de 4+2 que ficava desbalanceado). Fallback responsivo
  // ainda reduz pra 2 ou 1 em telas pequenas.
  const [cardsPerPage, setCardsPerPage] = useState(3);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const token = await getAuthToken();
        const result = await getHotTopics(token);
        if (result.data) {
          setTopics(result.data.topics);
          setSemana(result.data.semana);
        }
      } catch (err) {
        console.error('Error loading hot topics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  // Calculate how many cards fit based on container width.
  // Cap em 3 pra sempre fechar 3+3 (com os 6 tópicos que o backend devolve).
  const updateCardsPerPage = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    // Each card is flex-1 with min-w-[200px], gap-3 (12px)
    if (containerWidth >= 650) setCardsPerPage(3);
    else if (containerWidth >= 420) setCardsPerPage(2);
    else setCardsPerPage(1);
  }, []);

  useEffect(() => {
    updateCardsPerPage();
    window.addEventListener('resize', updateCardsPerPage);
    return () => window.removeEventListener('resize', updateCardsPerPage);
  }, [updateCardsPerPage, loading]);

  const totalPages = Math.ceil(topics.length / cardsPerPage);
  const canGoLeft = page > 0;
  const canGoRight = page < totalPages - 1;
  const visibleTopics = topics.slice(page * cardsPerPage, (page + 1) * cardsPerPage);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const token = await getAuthToken();
      const result = await regenerateHotTopics(token);
      if (result.topics) {
        setTopics(result.topics);
        setSemana('Esta semana');
        setPage(0);
      }
    } catch (err) {
      console.error('Error regenerating:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSelect = (topic: HotTopic, globalIdx: number) => {
    setSelectedIdx(globalIdx);
    onSelectTopic(`Quero falar sobre: ${topic.titulo}\n\nContexto: ${topic.contexto}\n\n${topic.angulo}`);
    setTimeout(() => setSelectedIdx(null), 1500);
  };

  if (!loading && topics.length === 0) return null;

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-foreground">Temas em Alta no seu Setor</span>
          {semana && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-orange-200">
              {semana}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Gerar novos tópicos"
            >
              {regenerating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
          )}
        </div>
      </div>

      {/* Cards row with arrows */}
      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: Math.min(4, cardsPerPage) }).map((_, i) => (
            <div key={i} className="flex-1 min-w-0 rounded-xl border border-orange-100 bg-white p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          {/* Left arrow */}
          <Button
            variant="outline"
            size="icon"
            className="h-auto w-8 shrink-0 rounded-lg border-orange-200 hover:bg-orange-50 disabled:opacity-20 self-stretch"
            onClick={() => setPage(p => p - 1)}
            disabled={!canGoLeft}
          >
            <ChevronLeft className="w-4 h-4 text-orange-600" />
          </Button>

          {/* Cards */}
          <div className="flex-1 min-w-0 flex gap-3">
            {visibleTopics.map((topic, i) => {
              const globalIdx = page * cardsPerPage + i;
              return (
                <button
                  key={globalIdx}
                  onClick={() => handleSelect(topic, globalIdx)}
                  className={`flex-1 min-w-0 text-left rounded-xl border p-4 transition-all duration-200 group cursor-pointer
                    ${selectedIdx === globalIdx
                      ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300 scale-[0.98]'
                      : 'border-orange-200/60 bg-white hover:border-orange-300 hover:shadow-sm hover:shadow-orange-100'
                    }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${selectedIdx === globalIdx
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-100 text-orange-600 group-hover:bg-orange-200'
                        }`}>
                        {selectedIdx === globalIdx
                          ? <Sparkles className="w-3 h-3" />
                          : globalIdx + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                        {topic.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {topic.contexto}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right arrow */}
          <Button
            variant="outline"
            size="icon"
            className="h-auto w-8 shrink-0 rounded-lg border-orange-200 hover:bg-orange-50 disabled:opacity-20 self-stretch"
            onClick={() => setPage(p => p + 1)}
            disabled={!canGoRight}
          >
            <ChevronRight className="w-4 h-4 text-orange-600" />
          </Button>
        </div>
      )}
    </div>
  );
}
