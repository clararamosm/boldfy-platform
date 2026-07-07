// Geração client-side da capa do PDF (página 1 → PNG).
//
// Usada no upload de PDF nos dois editores de post pra alimentar o
// `pdfThumbUrl` — a imagem que o calendário mostra como preview do carrossel.
//
// IMPORTANTE: só pode rodar no browser (canvas + worker do pdf.js). Importe
// sempre via dynamic import dentro do handler de upload — assim o pdf.js não
// entra no bundle inicial e o SSR nunca toca neste módulo.
//
// Falha NUNCA bloqueia o upload do PDF em si: retorna null e o caller segue
// sem thumb (o calendário cai no fallback de ícone).

/** Largura máxima da capa gerada. 640px cobre o quadrado do card do
 *  calendário (~200px) com folga pra telas retina. */
const THUMB_MAX_WIDTH = 640;

export async function renderPdfCoverPng(source: File | Blob | string): Promise<Blob | null> {
  try {
    // Reusa o pdfjs que o react-pdf traz — mesma versão, mesmo worker.
    const { pdfjs } = await import('react-pdf');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }

    // String = URL de um PDF já no Storage (backfill de posts antigos).
    // Firebase Storage libera CORS nas download URLs.
    const data = typeof source === 'string'
      ? await (await fetch(source)).arrayBuffer()
      : await source.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);

    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(THUMB_MAX_WIDTH / baseViewport.width, 2);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fundo branco — PDFs com transparência renderizariam sobre preto no PNG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    await doc.destroy();

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (err) {
    console.error('renderPdfCoverPng failed (upload segue sem thumb):', err);
    return null;
  }
}
