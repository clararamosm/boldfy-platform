'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, ChevronLeft, ChevronRight, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { getHotTopics, regenerateHotTopics, type HotTopic } from '@/app/actions/hot-topics';
import { getAuthToken } from '@/lib/auth-client';

type HotTopicsBoxProps = {
  /** Callback when user clicks a topic — receives the suggested prompt text */
  onSelectTopic: (prompt: string) => void;
  /** Show the regenerate button (admin only) */
  showRegenerate?: boolean;
};

export function HotTopicsBox({ onSelectTopic, showRegenerate = false }: HotTopicsBoxProps) {
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [semana, setSemana] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [topics, loading]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 260;
    const gap = 12;
    const scrollAmount = cardWidth + gap;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const token = await getAuthToken();
      const result = await regenerateHotTopics(token);
      if (result.topics) {
        setTopics(result.topics);
        setSemana('Esta semana');
      }
    } catch (err) {
      console.error('Error regenerating:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSelect = (topic: HotTopic, idx: number) => {
    setSelectedIdx(idx);
    onSelectTopic(`Quero falar sobre: ${topic.titulo}\n\nContexto: ${topic.contexto}\n\n${topic.angulo}`);
    setTimeout(() => setSelectedIdx(null), 1500);
  };

  // Don't render if no topics and not loading
  if (!loading && topics.length === 0) return null;

  return (
    <div className="space-y-2">
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
          {/* Arrow buttons */}
          {!loading && topics.length > 0 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-orange-200 hover:bg-orange-50 disabled:opacity-30"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
              >
                <ChevronLeft className="w-4 h-4 text-orange-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-orange-200 hover:bg-orange-50 disabled:opacity-30"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
              >
                <ChevronRight className="w-4 h-4 text-orange-600" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards slider */}
      {loading ? (
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="shrink-0 w-[260px] rounded-xl border border-orange-100 bg-white p-4 space-y-2"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Left fade */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          )}

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {topics.map((topic, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(topic, idx)}
                className={`shrink-0 w-[260px] text-left rounded-xl border p-4 transition-all duration-200 group cursor-pointer
                  ${selectedIdx === idx
                    ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300 scale-[0.98]'
                    : 'border-orange-200/60 bg-white hover:border-orange-300 hover:shadow-sm hover:shadow-orange-100'
                  }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${selectedIdx === idx
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-100 text-orange-600 group-hover:bg-orange-200'
                      }`}>
                      {selectedIdx === idx
                        ? <Sparkles className="w-3 h-3" />
                        : idx + 1}
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
            ))}
          </div>

          {/* Right fade */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          )}
        </div>
      )}
    </div>
  );
}
