// src/lib/media-rules.ts
//
// Regras de validação de mídia para os editores de post (colaborador +
// estrategista). Centralizado pra que ambos sigam exatamente a mesma
// política, sem duplicação:
//
//   - Imagens (JPG/PNG/WEBP): até 10 por post, 5MB cada. Galeria multi-image.
//   - GIF: 1 só, 10MB. (GIF tende a ter peso maior que imagem estática por
//     conta dos frames — limite mais generoso que imagem comum.)
//   - PDF: 1 só, 5MB.
//   - Vídeo: 1 só, 200MB.
//   - Mistura proibida: galeria de imagens não convive com vídeo/PDF/GIF.

export const MAX_GALLERY_IMAGES = 10;
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_GIF_SIZE_MB = 10;
export const MAX_PDF_SIZE_MB = 5;
export const MAX_VIDEO_SIZE_MB = 200;

const MB = 1024 * 1024;

export type MediaKind = 'image' | 'gif' | 'video' | 'pdf' | 'unknown';

/**
 * Classifica MIME type em uma categoria operacional. Distingue GIF de
 * imagem normal porque GIF não pode entrar em galeria (LinkedIn renderiza
 * GIFs animados como vídeo, não dá pra misturar com fotos).
 */
export function classifyMimeType(mimeType: string | undefined | null): MediaKind {
  if (!mimeType) return 'unknown';
  const t = mimeType.toLowerCase();
  if (t === 'image/gif') return 'gif';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t === 'application/pdf') return 'pdf';
  return 'unknown';
}

export type MediaValidationItem = {
  mimeType: string;
  sizeBytes?: number; // opcional pra items já uploaded (sem File local)
};

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; reason: string };
export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Valida se um novo arquivo pode ser adicionado à lista atual.
 *
 * Regras aplicadas em ordem:
 *  1. Tamanho dentro do limite da categoria.
 *  2. Mistura de tipos: se já há mídia, só aceita se for mesma categoria
 *     (e mesmo aí, só imagens podem ter múltiplas).
 *  3. Cap de imagens: até 10.
 */
export function validateNewMedia(
  newFile: { mimeType: string; sizeBytes: number },
  currentItems: MediaValidationItem[],
): ValidationResult {
  const newKind = classifyMimeType(newFile.mimeType);

  // 1. Tamanho
  const maxBytes: Record<MediaKind, number> = {
    image: MAX_IMAGE_SIZE_MB * MB,
    gif: MAX_GIF_SIZE_MB * MB,
    pdf: MAX_PDF_SIZE_MB * MB,
    video: MAX_VIDEO_SIZE_MB * MB,
    unknown: MAX_IMAGE_SIZE_MB * MB, // conservador
  };
  if (newFile.sizeBytes > maxBytes[newKind]) {
    const limitMb = Math.round(maxBytes[newKind] / MB);
    return {
      ok: false,
      reason: `Arquivo muito grande. Limite pra ${newKind === 'video' ? 'vídeo' : newKind === 'pdf' ? 'PDF' : newKind === 'gif' ? 'GIF' : 'imagens'}: ${limitMb}MB.`,
    };
  }

  // 2. Mistura de tipos
  if (currentItems.length > 0) {
    const existingKind = classifyMimeType(currentItems[0].mimeType);

    if (newKind !== existingKind) {
      const existingLabel = existingKind === 'image' ? 'imagem(ns)'
        : existingKind === 'video' ? 'vídeo'
        : existingKind === 'pdf' ? 'PDF'
        : existingKind === 'gif' ? 'GIF'
        : 'mídia';
      return {
        ok: false,
        reason: `Remova ${existingLabel === 'imagem(ns)' ? 'as imagens' : `o ${existingLabel}`} antes de adicionar outro tipo.`,
      };
    }

    // Mesmo tipo — só imagens permitem múltiplas
    if (newKind !== 'image') {
      return {
        ok: false,
        reason: `Só pode haver um ${newKind === 'video' ? 'vídeo' : newKind === 'pdf' ? 'PDF' : 'GIF'} por post. Remova o atual primeiro.`,
      };
    }

    // 3. Cap de imagens
    if (currentItems.length >= MAX_GALLERY_IMAGES) {
      return {
        ok: false,
        reason: `Máximo de ${MAX_GALLERY_IMAGES} imagens por post.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Lista de tipos aceitos pelo input `accept` HTML. Reflete o que
 * `classifyMimeType` reconhece + extensões comuns como fallback.
 */
export const ACCEPTED_MEDIA_INPUT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
].join(',');
