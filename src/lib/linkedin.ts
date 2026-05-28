// src/lib/linkedin.ts
// LinkedIn OAuth 2.0 + OpenID Connect + Posts API (v2) utilities

const LINKEDIN_API_VERSION = '202603';
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

export type LinkedInTokens = {
  access_token: string;
  expires_in: number; // seconds (typically 5184000 = 60 days)
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds (typically 31536000 = 365 days)
  scope: string;
};

export type LinkedInProfile = {
  sub: string; // LinkedIn member ID
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  position?: string;
};

export type LinkedInConnection = {
  linkedinId: string;
  name: string;
  email?: string;
  picture?: string;
  position?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number; // Unix timestamp in ms
  refreshTokenExpiresAt?: number; // Unix timestamp in ms
  scopes: string;
  connectedAt: number; // Unix timestamp in ms
};

function getLinkedInConfig() {
  const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'LinkedIn OAuth not configured. Set NEXT_PUBLIC_LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI.'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate the LinkedIn OAuth authorization URL.
 * Scopes: openid, profile, email (Sign In) + w_member_social (Share/Post)
 */
export function generateAuthUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedInConfig();

  const scopes = ['openid', 'profile', 'email', 'w_member_social'];

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
  const { clientId, clientSecret, redirectUri } = getLinkedInConfig();

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('LinkedIn token exchange failed:', errorData);
    throw new Error(
      `LinkedIn token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<LinkedInTokens> {
  const { clientId, clientSecret } = getLinkedInConfig();

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('LinkedIn token refresh failed:', errorData);
    throw new Error(
      `LinkedIn token refresh failed: ${errorData.error_description || errorData.error || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch LinkedIn user profile using the access token.
 */
export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('LinkedIn profile fetch failed:', errorData);
    throw new Error(
      `LinkedIn profile fetch failed: ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Build a LinkedInConnection object from tokens and profile data.
 */
export function buildConnectionData(
  tokens: LinkedInTokens,
  profile: LinkedInProfile
): LinkedInConnection {
  const now = Date.now();

  // Build base object — Firestore rejects undefined values,
  // so we only include optional fields when they have a value.
  const connection: LinkedInConnection = {
    linkedinId: profile.sub,
    name: profile.name,
    accessToken: tokens.access_token,
    tokenExpiresAt: now + tokens.expires_in * 1000,
    scopes: tokens.scope,
    connectedAt: now,
  };

  if (profile.email) connection.email = profile.email;
  if (profile.picture) connection.picture = profile.picture;
  if (profile.position) connection.position = profile.position;
  if (tokens.refresh_token) connection.refreshToken = tokens.refresh_token;
  if (tokens.refresh_token_expires_in) {
    connection.refreshTokenExpiresAt = now + tokens.refresh_token_expires_in * 1000;
  }

  return connection;
}

/**
 * Check if the access token is expired or about to expire (within 5 min buffer).
 */
export function isTokenExpired(tokenExpiresAt: number): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= tokenExpiresAt - bufferMs;
}

// ─── LinkedIn Posts API v2 (replaces deprecated UGC API) ────────

export type LinkedInPostResult = {
  postId: string;
  postUrl: string;
};

/** Common headers for LinkedIn REST API v2 */
function linkedInApiHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

/**
 * Upload an image to LinkedIn and return its image URN.
 * 3-step flow: initializeUpload → PUT binary → return URN.
 */
export async function uploadImageToLinkedIn(
  accessToken: string,
  linkedinId: string,
  imageUrl: string
): Promise<string> {
  const ownerUrn = `urn:li:person:${linkedinId}`;

  // Step 1: Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    console.error('LinkedIn image init failed:', err);
    throw new Error(`Falha ao iniciar upload de imagem: ${err.message || initRes.statusText}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new Error('LinkedIn não retornou URL de upload.');
  }

  // Step 2: Download image from Firebase Storage and upload to LinkedIn
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Não foi possível baixar a imagem para upload.');
  const imageBuffer = await imgRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    console.error('LinkedIn image upload failed:', uploadRes.statusText);
    throw new Error(`Falha no upload da imagem: ${uploadRes.statusText}`);
  }

  return imageUrn;
}

/**
 * Convert HTML content to LinkedIn-compatible plain text.
 * Handles content saved by the rich-text editor (contentEditable innerHTML).
 */
function htmlToLinkedInText(html: string): string {
  // If it doesn't contain any HTML tags, return as-is (already plain text)
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;

  let text = html;

  // Replace <br> and <br/> with newline
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Replace closing block tags with newline (these represent line breaks)
  text = text.replace(/<\/(?:div|p|li|h[1-6])>/gi, '\n');

  // Replace opening block tags (remove them)
  text = text.replace(/<(?:div|p|li|h[1-6]|ul|ol)(?:\s[^>]*)?>/gi, '');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");

  // Collapse 3+ consecutive newlines down to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace
  text = text.trim();

  return text;
}

/**
 * Escape reserved characters for LinkedIn's "little" Text Format used in
 * the Posts API `commentary` field.
 *
 * LinkedIn reserves these characters for structural syntax (mentions,
 * hashtags, formatting): ( ) [ ] { } | @ # * ~ < > \ _
 *
 * If sent unescaped, the parser tries to interpret them as syntax and
 * silently truncates the post when it gets confused — e.g. "(Ideias que Colam)"
 * looks like a malformed mention because the mention format is
 * "@[Name](urn:li:person:ID)".
 *
 * The backslash MUST be escaped first, otherwise we'd double-escape the
 * backslashes we insert for the other reserved characters.
 *
 * Note: when mentions/hashtags land in the editor, their structural tokens
 * should be inserted AFTER this function runs so they remain unescaped
 * and valid little-text syntax.
 *
 * Ref: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 */
export function escapeLittleText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/[()[\]{}|@#*~<>_]/g, '\\$&');
}

/**
 * Upload a video to LinkedIn and return its video URN.
 * 3-step flow: initializeUpload → PUT binary (single chunk) → finalizeUpload.
 * LinkedIn Videos API supports up to 200MB; we upload in a single chunk for simplicity
 * (LinkedIn handles chunking internally for files under ~200MB via single uploadUrl).
 */
export async function uploadVideoToLinkedIn(
  accessToken: string,
  linkedinId: string,
  videoUrl: string
): Promise<string> {
  const ownerUrn = `urn:li:person:${linkedinId}`;

  // Download the video from Firebase Storage first to know the size
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Não foi possível baixar o vídeo para upload.');
  const videoBuffer = await videoRes.arrayBuffer();
  const fileSizeBytes = videoBuffer.byteLength;

  // Step 1: Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    console.error('LinkedIn video init failed:', err);
    throw new Error(`Falha ao iniciar upload de vídeo: ${err.message || initRes.statusText}`);
  }

  const initData = await initRes.json();
  const uploadInstructions = initData.value?.uploadInstructions;
  const videoUrn = initData.value?.video;

  if (!uploadInstructions || !videoUrn) {
    throw new Error('LinkedIn não retornou instruções de upload de vídeo.');
  }

  // Step 2: Upload binary chunks
  // Each instruction has an uploadUrl and a range (firstByte, lastByte)
  const etags: string[] = [];
  for (const instruction of uploadInstructions) {
    const { uploadUrl, firstByte, lastByte } = instruction;
    const chunk = videoBuffer.slice(firstByte, lastByte + 1);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: chunk,
    });

    if (!uploadRes.ok) {
      console.error('LinkedIn video chunk upload failed:', uploadRes.statusText);
      throw new Error(`Falha no upload do vídeo (chunk): ${uploadRes.statusText}`);
    }

    const etag = uploadRes.headers.get('etag') || '';
    etags.push(etag);
  }

  // Step 3: Finalize upload
  const finalizeRes = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: '',
        uploadedPartIds: etags,
      },
    }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    console.error('LinkedIn video finalize failed:', err);
    throw new Error(`Falha ao finalizar upload de vídeo: ${err.message || finalizeRes.statusText}`);
  }

  return videoUrn;
}

/**
 * Upload a PDF (document/carousel) to LinkedIn and return its document URN.
 * O "carrossel" do LinkedIn é, na prática, um PDF renderizado como deck na
 * timeline — vai pela Documents API (`/rest/documents`), não pela Images.
 * Fluxo: initializeUpload → PUT binary → return URN.
 *
 * Importante: o LinkedIn aceita PDFs de até ~100MB e até 300 páginas, mas a
 * nossa regra interna (media-rules.ts) limita em 5MB pra evitar o mesmo tipo
 * de "falso sucesso" que aconteceu com GIF — uploads que passam no PUT mas
 * a criação do post depois falha silenciosamente.
 */
export async function uploadDocumentToLinkedIn(
  accessToken: string,
  linkedinId: string,
  documentUrl: string
): Promise<string> {
  const ownerUrn = `urn:li:person:${linkedinId}`;

  // Step 1: Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/documents?action=initializeUpload', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    console.error('LinkedIn document init failed:', err);
    throw new Error(`Falha ao iniciar upload do PDF: ${err.message || initRes.statusText}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const documentUrn = initData.value?.document;

  if (!uploadUrl || !documentUrn) {
    throw new Error('LinkedIn não retornou URL de upload para o PDF.');
  }

  // Step 2: Download PDF from Firebase Storage and upload to LinkedIn
  const docRes = await fetch(documentUrl);
  if (!docRes.ok) throw new Error('Não foi possível baixar o PDF para upload.');
  const docBuffer = await docRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: docBuffer,
  });

  if (!uploadRes.ok) {
    console.error('LinkedIn document upload failed:', uploadRes.statusText);
    throw new Error(`Falha no upload do PDF: ${uploadRes.statusText}`);
  }

  return documentUrn;
}

/**
 * Determine media category from MIME type or explicit mediaType label.
 * Returns: 'image' | 'gif' | 'video' | 'pdf' | undefined
 */
export function classifyMediaType(mediaType?: string): 'image' | 'gif' | 'video' | 'pdf' | undefined {
  if (!mediaType) return undefined;
  const mt = mediaType.toLowerCase();
  if (mt === 'video' || mt.startsWith('video/')) return 'video';
  if (mt === 'gif' || mt === 'image/gif') return 'gif';
  if (mt === 'pdf' || mt === 'application/pdf') return 'pdf';
  if (mt === 'image' || mt.startsWith('image/')) return 'image';
  return undefined;
}

/**
 * Publish a post to LinkedIn using the Posts API v2.
 * Supports text-only, text + image/GIF, text + video, or text + multi-image gallery.
 *
 * @param mediaUrls - Array de URLs Firebase Storage. Single = imagem/video/gif/pdf normal.
 *                   Array com 2+ items = galeria multi-image (sÃ³ JPG/PNG/WEBP).
 * @param mediaTypes - MIME types paralelos a `mediaUrls`. Mesma ordem, mesmo tamanho.
 *
 * Retrocompat: aceita tambÃ©m a forma antiga `(text, mediaUrl: string, mediaType: string)`
 * via wrapper `publishLinkedInPostLegacy` mais abaixo â callers nÃ£o migrados
 * podem continuar a chamÃ¡-lo. NOVOS callers devem usar a forma array.
 */
export async function publishLinkedInPost(
  accessToken: string,
  linkedinId: string,
  text: string,
  mediaUrls?: string[],
  mediaTypes?: string[]
): Promise<LinkedInPostResult> {
  const authorUrn = `urn:li:person:${linkedinId}`;

  // Sanitize: convert any HTML to plain text for LinkedIn API
  const cleanText = htmlToLinkedInText(text);

  // Normaliza: arrays paralelos com nÃºmeros iguais de items.
  const urls = (mediaUrls ?? []).filter(Boolean);
  const types = (mediaTypes ?? []).slice(0, urls.length);
  while (types.length < urls.length) types.push('');

  // Upload media if provided
  let mediaUrns: string[] = [];
  const primaryCategory = urls.length > 0 ? classifyMediaType(types[0]) : null;
  const isMultiImage = urls.length > 1 && primaryCategory === 'image';

  if (isMultiImage) {
    // MULTI_IMAGE gallery: upload sequencial de cada imagem.
    // Sequencial (em vez de Promise.all) pra evitar rate-limit do LinkedIn
    // e dar oportunidade de retry granular se uma falhar.
    for (let i = 0; i < urls.length; i++) {
      const urn = await uploadImageToLinkedIn(accessToken, linkedinId, urls[i]);
      if (urn) mediaUrns.push(urn);
    }
  } else if (urls.length > 0) {
    // Single media (image, video, gif, pdf, or unknown fallback).
    const url = urls[0];
    const cat = classifyMediaType(types[0]);
    let urn: string | undefined;
    if (cat === 'video') {
      urn = await uploadVideoToLinkedIn(accessToken, linkedinId, url);
    } else if (cat === 'pdf') {
      // PDF/carrossel vai pela Documents API (não pela Images).
      // Sem isso, o post ia pro LinkedIn como texto puro e o "carrossel"
      // simplesmente desaparecia — bug reportado em maio/2026.
      urn = await uploadDocumentToLinkedIn(accessToken, linkedinId, url);
    } else if (cat === 'image' || cat === 'gif' || !cat) {
      // GIF e fallback usam a mesma Images API
      urn = await uploadImageToLinkedIn(accessToken, linkedinId, url);
    }
    if (urn) mediaUrns = [urn];
  }

  // Build post body (Posts API v2 format)
  // IMPORTANT: commentary goes through escapeLittleText to prevent LinkedIn's
  // parser from silently truncating the post when it encounters unescaped
  // reserved characters like parentheses, brackets, etc.
  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: escapeLittleText(cleanText),
    visibility: 'PUBLIC',
    lifecycleState: 'PUBLISHED',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
  };

  if (mediaUrns.length > 1) {
    // MULTI_IMAGE shape: content.multiImage.images: [{ id: urn }, ...]
    body.content = {
      multiImage: {
        images: mediaUrns.map((urn) => ({ id: urn })),
      },
    };
  } else if (mediaUrns.length === 1) {
    // Para PDF/documento, o `title` é o título visível do carrossel na timeline
    // do LinkedIn — então cai pra um nome neutro só se não houver texto. Pra
    // imagem/vídeo o título é ignorado pelo cliente, mas mantemos por consistência.
    const mediaTitle =
      primaryCategory === 'pdf'
        ? 'Documento'
        : primaryCategory === 'video'
          ? 'Post video'
          : 'Post image';
    body.content = {
      media: {
        title: mediaTitle,
        id: mediaUrns[0],
      },
    };
  }

  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('LinkedIn post publish failed:', JSON.stringify({ status: response.status, errorData }));

    if (response.status === 401) throw new Error('TOKEN_EXPIRED');
    if (response.status === 403) throw new Error('Sem permissão para publicar. Verifique se o scope w_member_social está ativo.');
    if (response.status === 422) throw new Error(`Conteúdo rejeitado pelo LinkedIn: ${errorData.message || 'verifique o texto e tente novamente.'}`);
    if (response.status === 429) throw new Error('Limite de publicações atingido. Tente novamente mais tarde.');

    throw new Error(`Falha ao publicar (${response.status}): ${errorData.message || errorData.error || response.statusText}`);
  }

  // Validação anti "falso sucesso": o LinkedIn pode responder 2xx mas sem o
  // header `x-restli-id` (raro, mas já aconteceu — ex: post da Clara Ramos
  // em maio/2026 ficou marcado como published com linkedinPostId vazio e
  // linkedinPostUrl quebrada → aba em branco quando o user clicava "Ver no
  // LinkedIn"). Sem o postId não dá pra confirmar a publicação nem buscar
  // métricas depois, então tratamos como falha explícita pro caller marcar
  // o post como `failed` em vez de gravar URL inútil. Logamos toda a resposta
  // (headers + body) pra investigação futura — o LinkedIn às vezes manda
  // info útil aqui mesmo quando o status é 2xx.
  const postId = response.headers.get('x-restli-id') || '';

  if (!postId) {
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    const responseBody = await response.text().catch(() => '');
    console.error('LinkedIn post publish: 2xx response without x-restli-id header', JSON.stringify({
      status: response.status,
      headers: responseHeaders,
      body: responseBody.slice(0, 500),
    }));
    throw new Error('LINKEDIN_NO_POST_ID');
  }

  const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`;

  return { postId, postUrl };
}

// ─── LinkedIn Post Metrics (socialMetadata API) ─────────────────


export type LinkedInReactionSummary = {
  LIKE?: number;
  PRAISE?: number;
  CELEBRATION?: number;
  LOVE?: number;
  INSIGHTFUL?: number;
  CURIOUS?: number;
};

export type LinkedInPostMetrics = {
  postId: string;
  reactions: LinkedInReactionSummary;
  totalReactions: number;
  comments: number;
  topLevelComments: number;
};

/**
 * Normalise a LinkedIn post ID to a valid URN for the socialMetadata API.
 * The socialMetadata endpoint accepts urn:li:share or urn:li:ugcPost — NOT urn:li:activity.
 * The Posts API v2 returns urn:li:share:{id} in the x-restli-id header.
 */
function toSocialMetadataUrn(postId: string): string {
  if (postId.startsWith('urn:li:share:') || postId.startsWith('urn:li:ugcPost:')) {
    return postId;
  }
  if (postId.startsWith('urn:li:activity:')) {
    // activity URNs share the same numeric ID as share URNs
    const numericId = postId.replace('urn:li:activity:', '');
    return `urn:li:share:${numericId}`;
  }
  // Bare numeric ID — default to share URN (Posts API v2 creates shares)
  return `urn:li:share:${postId}`;
}

/**
 * Fetch engagement metrics (reactions + comments) for a single post.
 * Uses the socialMetadata endpoint (available with w_member_social).
 * The postId should be the share/ugcPost URN returned when publishing.
 */
export async function fetchPostMetrics(
  accessToken: string,
  postId: string
): Promise<LinkedInPostMetrics> {
  const urn = toSocialMetadataUrn(postId);

  const url = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(urn)}`;

  const response = await fetch(url, {
    headers: linkedInApiHeaders(accessToken),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('LinkedIn socialMetadata failed:', { urn, status: response.status, err });
    // Return zeros instead of throwing — post may not have metrics yet
    return {
      postId,
      reactions: {},
      totalReactions: 0,
      comments: 0,
      topLevelComments: 0,
    };
  }

  const data = await response.json();

  // Parse reaction summaries
  const reactions: LinkedInReactionSummary = {};
  let totalReactions = 0;

  if (data.reactionSummaries) {
    for (const [type, summary] of Object.entries(data.reactionSummaries)) {
      const count = (summary as { count?: number }).count || 0;
      reactions[type as keyof LinkedInReactionSummary] = count;
      totalReactions += count;
    }
  }

  const comments = data.commentSummary?.count || 0;
  const topLevelComments = data.commentSummary?.topLevelCount || 0;

  return {
    postId,
    reactions,
    totalReactions,
    comments,
    topLevelComments,
  };
}

/**
 * Batch fetch metrics for multiple posts at once.
 * Uses socialMetadata BATCH_GET with ids=List(...).
 */
export async function fetchPostMetricsBatch(
  accessToken: string,
  postIds: string[]
): Promise<LinkedInPostMetrics[]> {
  if (postIds.length === 0) return [];

  // Build URN list using share/ugcPost format (NOT activity)
  const urnMap = new Map<string, string>(); // original id → socialMetadata URN
  for (const id of postIds) {
    urnMap.set(id, toSocialMetadataUrn(id));
  }

  const urns = Array.from(urnMap.values());
  const urnList = urns.map(u => encodeURIComponent(u)).join(',');
  const url = `https://api.linkedin.com/rest/socialMetadata?ids=List(${urnList})`;

  const response = await fetch(url, {
    headers: {
      ...linkedInApiHeaders(accessToken),
      'X-RestLi-Method': 'BATCH_GET',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('LinkedIn socialMetadata batch failed:', { urns, status: response.status, err });
    // Return empty metrics for all posts
    return postIds.map(id => ({
      postId: id,
      reactions: {},
      totalReactions: 0,
      comments: 0,
      topLevelComments: 0,
    }));
  }

  const data = await response.json();
  const results: LinkedInPostMetrics[] = [];

  for (const id of postIds) {
    const urn = urnMap.get(id)!;
    const entry = data.results?.[urn];

    if (!entry) {
      results.push({
        postId: id,
        reactions: {},
        totalReactions: 0,
        comments: 0,
        topLevelComments: 0,
      });
      continue;
    }

    const reactions: LinkedInReactionSummary = {};
    let totalReactions = 0;

    if (entry.reactionSummaries) {
      for (const [type, summary] of Object.entries(entry.reactionSummaries)) {
        const count = (summary as { count?: number }).count || 0;
        reactions[type as keyof LinkedInReactionSummary] = count;
        totalReactions += count;
      }
    }

    results.push({
      postId: id,
      reactions,
      totalReactions,
      comments: entry.commentSummary?.count || 0,
      topLevelComments: entry.commentSummary?.topLevelCount || 0,
    });
  }

  return results;
}
