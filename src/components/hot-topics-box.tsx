'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, ChevronDown, ChevronUp, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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
    // Brief visual feedback then reset
    setTimeout(() => setSelectedIdx(null), 1500);
  };

  // Don't render if no topics and not loading
  if (!loading && topics.length === 0) return null;

  // Show max 3 collapsed, all when expanded
  const visibleTopics = expanded ? topics : topics.slice(0, 3);

  return (
    <Card className="border-orange-200/60 bg-gradient-to-br from-orange-50/50 to-amber-50/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Temas em Alta no seu Setor
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {semana && (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-orange-200">
                {semana}
              </Badge>
            )}
            {showRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRegenerate}
                disabled={regenerating}
                title="Gerar novos topicos"
              >
                {regenerating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {visibleTopics.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(topic, idx)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 group
                    ${selectedIdx === idx
                      ? 'bg-orange-100 ring-1 ring-orange-300'
                      : 'hover:bg-orange-100/60 bg-white/60'
                    }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
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
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {topic.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {topic.contexto}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {topics.length > 3 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium mt-2 mx-auto"
              >
                {expanded ? (
                  <>Ver menos <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Ver mais {topics.length - 3} temas <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}

            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Clique num tema pra usar como ponto de partida
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
