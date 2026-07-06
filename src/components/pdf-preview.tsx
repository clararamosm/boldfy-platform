'use client';

// Preview inline de PDF usando react-pdf (pdf.js). Renderiza uma página por
// vez com navegação ‹ › — o suficiente pra conferir o carrossel sem sair da
// tela. Usado nos dois editores de post (pipeline e colaborador).
//
// IMPORTANTE: importe sempre via next/dynamic com ssr:false — pdf.js depende
// de APIs de browser (canvas, worker) e quebra no server render.
//
// Aceita qualquer URL que o pdf.js consiga buscar: https (Firebase Storage
// libera CORS nas download URLs), data: (FileReader antes do upload) e blob:.

import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Worker resolvido pelo bundler (webpack/turbopack) a partir do pdfjs-dist
// instalado — evita depender de CDN externo.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Props = {
  /** URL do PDF: https, data: ou blob: */
  url: string;
  className?: string;
};

export function PdfPreview({ url, className }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);
  // Largura do container pra Page renderizar responsivo (sem overflow).
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Se o pdf.js não conseguir carregar (CORS, arquivo corrompido), cai no
  // fallback antigo: link pra abrir em nova aba. Nunca pior do que era.
  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-4 rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
      >
        <FileText className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm">Visualizar PDF</span>
      </a>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            setPageNumber(1);
          }}
          onLoadError={() => setFailed(true)}
          loading={
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          }
        >
          {width > 0 && (
            <Page
              pageNumber={pageNumber}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          )}
        </Document>
      </div>

      {/* Controles: paginação + abrir em nova aba */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pageNumber} / {numPages ?? '…'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={numPages == null || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages ?? p, p + 1))}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* data: URLs não abrem em nova aba (browsers bloqueiam navegação
            top-level pra data:) — só mostra o link pra https/blob. */}
        {!url.startsWith('data:') && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir em nova aba
          </a>
        )}
      </div>
    </div>
  );
}
