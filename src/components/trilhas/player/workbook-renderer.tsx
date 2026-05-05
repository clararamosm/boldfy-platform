// src/components/trilhas/player/workbook-renderer.tsx
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, BookOpenCheck, CheckCircle2, Loader2, Save } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIRESTORE_PATHS, type WorkbookResponse } from '@/types/trilhas';
import { parseWorkbookHtml, countWorkbookFields, countFilledFields } from './workbook-parser';
import { WorkbookField } from './workbook-fields';
import type { MappedModule } from './use-trail-player';
import { useT } from '@/lib/i18n/context';

// ─── PROSE_CLASSES (same as module-renderer) ────────────────
const PROSE_CLASSES = "prose prose-base max-w-none prose-p:leading-relaxed prose-p:mb-7 prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-10 prose-h1:mb-5 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-h4:text-base prose-h4:font-medium prose-h4:mt-4 prose-h4:mb-2 prose-li:mb-2 prose-ul:mb-5 prose-ol:mb-5 prose-hr:border-transparent prose-hr:my-8 prose-blockquote:border-l-purple-400 prose-blockquote:bg-purple-50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic [&_mark]:bg-purple-100 [&_mark]:text-inherit [&_mark]:px-0.5 [&_mark]:rounded-sm [&_svg]:max-w-full [&_svg]:mx-auto [&_svg]:block [&_svg]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-6 prose-a:text-purple-600 prose-a:underline [&_u]:underline";

// ─── Props ──────────────────────────────────────────────────
type Props = {
  currentModule: MappedModule;
  moduleCompleted: boolean;
  content: string;
  trailId: string;
  trailTitle: string;
  userId: string;
  onCompleteModule: (moduleId: string, points: number) => void;
};

export function WorkbookRenderer({
  currentModule,
  moduleCompleted,
  content,
  trailId,
  trailTitle,
  userId,
  onCompleteModule,
}: Props) {
  const tp = useT().trailPlayer;

  // ─── Parse HTML into chunks ─────────────────────────────
  const chunks = useMemo(() => parseWorkbookHtml(content), [content]);
  const totalFields = useMemo(() => countWorkbookFields(chunks), [chunks]);

  // ─── State ──────────────────────────────────────────────
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasExistingDoc, setHasExistingDoc] = useState(false);
  const existingCreatedAt = useRef<Timestamp | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Firestore doc path ─────────────────────────────────
  const docPath = useMemo(
    () => FIRESTORE_PATHS.userWorkbook(userId, trailId, currentModule.id),
    [userId, trailId, currentModule.id]
  );

  // ─── Load from Firestore ────────────────────────────────
  useEffect(() => {
    if (!userId || !trailId || !currentModule.id) return;

    const loadResponses = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, docPath));
        if (snap.exists()) {
          const data = snap.data() as WorkbookResponse;
          setResponses(data.respostas || {});
          setConcluido(data.concluido || false);
          setHasExistingDoc(true);
          existingCreatedAt.current = data.criadoEm || null;
        }
      } catch (err) {
        console.error('Error loading workbook responses:', err);
      }
      setLoading(false);
    };

    loadResponses();
  }, [userId, trailId, currentModule.id, docPath]);

  // ─── Save to Firestore ──────────────────────────────────
  const saveToFirestore = useCallback(async (currentResponses: Record<string, string | string[]>) => {
    if (!userId || !trailId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, docPath), {
        trailId,
        moduleId: currentModule.id,
        trailTitle: trailTitle,
        moduleTitle: currentModule.titulo,
        respostas: currentResponses,
        concluido: concluido,
        atualizadoEm: Timestamp.now(),
        criadoEm: existingCreatedAt.current || Timestamp.now(),
      } satisfies WorkbookResponse, { merge: true });
      setHasExistingDoc(true);
      if (!existingCreatedAt.current) {
        existingCreatedAt.current = Timestamp.now();
      }
      setLastSaved(new Date());
    } catch (err) {
      console.error('Error saving workbook responses:', err);
    }
    setSaving(false);
  }, [userId, trailId, currentModule.id, currentModule.titulo, trailTitle, concluido, docPath]);

  // ─── Debounced save (2s after last change) ──────────────
  const debouncedSave = useCallback((newResponses: Record<string, string | string[]>) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveToFirestore(newResponses);
    }, 2000);
  }, [saveToFirestore]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ─── Handle field change ────────────────────────────────
  const handleChange = useCallback((fieldId: string, value: string | string[]) => {
    setResponses(prev => {
      const updated = { ...prev, [fieldId]: value };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // ─── Handle conclude workbook ───────────────────────────
  const handleConcluir = useCallback(async () => {
    if (!userId || !trailId) return;
    // Cancel any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSaving(true);
    try {
      await setDoc(doc(db, docPath), {
        trailId,
        moduleId: currentModule.id,
        trailTitle: trailTitle,
        moduleTitle: currentModule.titulo,
        respostas: responses,
        concluido: true,
        atualizadoEm: Timestamp.now(),
        criadoEm: existingCreatedAt.current || Timestamp.now(),
      } satisfies WorkbookResponse);
      setConcluido(true);
      setLastSaved(new Date());
      // Mark module as completed in trail progress (0 points)
      onCompleteModule(currentModule.id, 0);
    } catch (err) {
      console.error('Error concluding workbook:', err);
    }
    setSaving(false);
  }, [userId, trailId, currentModule.id, currentModule.titulo, trailTitle, responses, docPath, onCompleteModule]);

  // ─── Computed values ────────────────────────────────────
  const filledCount = useMemo(() => countFilledFields(chunks, responses), [chunks, responses]);

  // ─── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">{currentModule.titulo}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Wrench className="h-3 w-3 mr-1" /> Pratica
            </Badge>
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
              <BookOpenCheck className="h-3 w-3 mr-1" /> Workbook
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando workbook...
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-1">{currentModule.titulo}</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Wrench className="h-3 w-3 mr-1" /> Pratica
          </Badge>
          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
            <BookOpenCheck className="h-3 w-3 mr-1" /> Workbook
          </Badge>
          {(moduleCompleted || concluido) && (
            <Badge className="bg-green-100 text-green-800 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>
      </div>

      {/* Interleaved HTML + Fields */}
      {chunks.map((chunk, i) => {
        if (chunk.type === 'html') {
          return (
            <div
              key={i}
              className={PROSE_CLASSES}
              dangerouslySetInnerHTML={{ __html: chunk.content }}
            />
          );
        }
        return (
          <WorkbookField
            key={`${chunk.id}-${i}`}
            chunk={chunk}
            responses={responses}
            onChange={handleChange}
          />
        );
      })}

      {/* Save bar */}
      <div className="flex items-center justify-between p-4 bg-purple-50/60 rounded-xl mt-6">
        <div className="flex items-center gap-2 text-xs text-purple-400">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Salvando...
            </>
          ) : lastSaved ? (
            <>
              <Save className="h-3.5 w-3.5" />
              Salvo automaticamente &middot; {filledCount} de {totalFields} campos preenchidos
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              {filledCount} de {totalFields} campos preenchidos
            </>
          )}
        </div>

        {!concluido && !moduleCompleted && (
          <Button
            size="sm"
            onClick={handleConcluir}
            disabled={saving}
            className="bg-purple-700 hover:bg-purple-800"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Concluir Workbook
          </Button>
        )}

        {(concluido || moduleCompleted) && (
          <Badge variant="outline" className="text-green-700 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{tp.noPointsModule}</p>
    </div>
  );
}
