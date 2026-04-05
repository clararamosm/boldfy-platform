'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, doc, getDocs, getDoc, query, orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, BookOpen, HelpCircle, Wrench, Target,
  ChevronLeft, ChevronRight, Loader2, FolderOpen, Trophy, Clock, Star, CheckCircle2, Zap
} from 'lucide-react';
import { Header } from '@/components/dashboard/header';
import { SuggestTrailDialog } from '@/components/suggest-trail-dialog';
import type { Sessao, Trilha, ProgressoTrilha, ModuloModo } from '@/types/trilhas';

const MODO_ICONS: Record<ModuloModo, any> = {
  aula: Play, leitura: BookOpen, desafio: HelpCircle,
  faca_voce_mesmo: Wrench, missao_conteudo: Target,
};

interface SessionWithTrails {
  session: Sessao;
  trails: (Trilha & { progress?: ProgressoTrilha })[];
}

function ScrollableTrailRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        ro.disconnect();
      };
    }
  }, [checkScroll, children]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 296; // 280px card + 16px gap
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-800/90 shadow-md rounded-full p-1.5 hover:bg-white dark:hover:bg-gray-800 transition-opacity hidden md:flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-800/90 shadow-md rounded-full p-1.5 hover:bg-white dark:hover:bg-gray-800 transition-opacity hidden md:flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}
    </div>
  );
}

export default function ColaboradorTrilhasPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsWithTrails, setSessionsWithTrails] = useState<SessionWithTrails[]>([]);
  const [stats, setStats] = useState({ total: 0, emProgresso: 0, concluidas: 0, pontos: 0 });
  const router = useRouter();

  // Get company ID
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) setCompanyId(userDoc.data().companyId || null);
    };
    fetch();
  }, [user]);

  // Load all available trails (global activated + company custom)
  const loadTrails = useCallback(async () => {
    if (!companyId || !user) return;
    setLoading(true);
    try {
      const allSessions: SessionWithTrails[] = [];

      // 1. Load activated global trails
      const actSnap = await getDocs(collection(db, `companies/${companyId}/activatedGlobalTrails`));
      const activatedBySession: Record<string, string[]> = {};
      actSnap.docs.forEach(d => {
        const data = d.data();
        const sessId = data.sessionId;
        if (!activatedBySession[sessId]) activatedBySession[sessId] = [];
        activatedBySession[sessId].push(d.id);
      });

      // Load global sessions that have activated trails
      for (const [sessId, trailIds] of Object.entries(activatedBySession)) {
        const sessDoc = await getDoc(doc(db, 'globalSessions', sessId));
        if (!sessDoc.exists()) continue;
        const session = { id: sessDoc.id, ...sessDoc.data() } as Sessao;

        const trails: Trilha[] = [];
        for (const tid of trailIds) {
          const tDoc = await getDoc(doc(db, `globalSessions/${sessId}/trails`, tid));
          if (tDoc.exists()) trails.push({ id: tDoc.id, ...tDoc.data() } as Trilha);
        }
        if (trails.length > 0) {
          trails.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
          allSessions.push({ session, trails });
        }
      }

      // 2. Load company custom sessions + trails
      const compSessSnap = await getDocs(
        query(collection(db, `companies/${companyId}/sessions`), orderBy('ordem', 'asc'))
      );
      for (const sessDoc of compSessSnap.docs) {
        const session = { id: sessDoc.id, ...sessDoc.data() } as Sessao;
        const trailSnap = await getDocs(
          query(collection(db, `companies/${companyId}/sessions/${sessDoc.id}/trails`), orderBy('ordem', 'asc'))
        );
        const trails = trailSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)).filter(t => t.ativa);
        if (trails.length > 0) allSessions.push({ session, trails });
      }

      // 3. Load user progress for all trails
      const progressSnap = await getDocs(collection(db, `users/${user.uid}/trailProgress`));
      const progressMap: Record<string, ProgressoTrilha> = {};
      progressSnap.docs.forEach(d => { progressMap[d.id] = d.data() as ProgressoTrilha; });

      // Merge progress into trails
      let totalTrails = 0, inProgress = 0, completed = 0, totalPts = 0;
      const merged = allSessions.map(sw => ({
        ...sw,
        trails: sw.trails.map(t => {
          totalTrails++;
          const prog = progressMap[t.id];
          if (prog) {
            if (prog.concluida) { completed++; totalPts += prog.pontosGanhos || 0; }
            else { inProgress++; totalPts += prog.pontosGanhos || 0; }
          }
          return { ...t, progress: prog };
        }),
      }));

      setSessionsWithTrails(merged);
      setStats({ total: totalTrails, emProgresso: inProgress, concluidas: completed, pontos: totalPts });
    } catch (err) {
      console.error('Erro ao carregar trilhas:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, user]);

  useEffect(() => { if (companyId) loadTrails(); }, [companyId, loadTrails]);

  const openTrail = (trail: Trilha) => {
    router.push(`/colaborador/trilhas/${trail.id}`);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

      {/* Suggest new trails */}
      <div className="flex justify-end">
        <SuggestTrailDialog pagina="Trilhas Colaborador" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <BookOpen className="w-6 h-6 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Trilhas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.emProgresso}</p>
          <p className="text-xs text-muted-foreground">Em Progresso</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold">{stats.concluidas}</p>
          <p className="text-xs text-muted-foreground">Concluidas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Star className="w-6 h-6 mx-auto mb-2 text-amber-500" />
          <p className="text-2xl font-bold">{stats.pontos}</p>
          <p className="text-xs text-muted-foreground">Pontos Ganhos</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : sessionsWithTrails.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma trilha disponivel</p>
            <p className="text-muted-foreground">Seu administrador ainda nao ativou trilhas para sua empresa</p>
          </CardContent>
        </Card>
      ) : (
        sessionsWithTrails.map(({ session, trails }) => (
          <div key={session.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold">{session.titulo}</h3>
              <Badge variant="outline">{trails.length} trilha{trails.length !== 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-sm text-muted-foreground ml-7">{session.descricao}</p>

            <div className="ml-7">
            <ScrollableTrailRow>
              {trails.map(trail => {
                const progress = trail.progress;
                const totalModulos = trail.modulos?.length || 0;
                const completedModulos = progress?.modulosCompletos?.length || 0;
                const percentual = totalModulos > 0 ? Math.round((completedModulos / totalModulos) * 100) : 0;
                const isConcluida = progress?.concluida || false;

                return (
                  <Card
                    key={trail.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow flex-shrink-0 w-[280px] ${isConcluida ? 'border-green-200 bg-green-50/30' : ''}`}
                    style={{ scrollSnapAlign: 'start' }}
                    onClick={() => openTrail(trail)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{trail.titulo}</CardTitle>
                        {isConcluida && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      </div>
                      <CardDescription className="line-clamp-2">{trail.descricao}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {totalModulos} modulo{totalModulos !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="w-3 h-3 mr-1 text-yellow-500" />{trail.pontuacaoTotal || 0} pontos
                        </Badge>
                        {trail.tempoEstimadoMin > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />{trail.tempoEstimadoMin} min
                          </Badge>
                        )}
                      </div>

                      {progress && !isConcluida && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{completedModulos}/{totalModulos} modulos</span>
                            <span>{percentual}%</span>
                          </div>
                          <Progress value={percentual} className="h-2" />
                        </div>
                      )}

                      {isConcluida && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Trophy className="w-4 h-4" />
                          <span>{progress?.pontosGanhos || 0} pontos conquistados</span>
                        </div>
                      )}

                      {!progress && (
                        <Button variant="outline" size="sm" className="w-full">
                          Comecar Trilha <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </ScrollableTrailRow>
            </div>
          </div>
        ))
      )}
      </main>
    </>
  );
}
