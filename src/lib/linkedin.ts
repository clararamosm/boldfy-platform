// src/lib/linkedin.ts
// LinkedIn OAuth 2.0 + OpenID Connect + Posts API (v2) utilities

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_API_VERSION = '202504';

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
};

export type LinkedInConnection = {
  linkedinId: string;
  name: string;
  email?: string;
  picture?: string;
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
 * Publish a post to LinkedIn using the Posts API v2.
 * Supports text-only or text + image.
 */
export async function publishLinkedInPost(
  accessToken: string,
  linkedinId: string,
  text: string,
  imageUrl?: string
): Promise<LinkedInPostResult> {
  const authorUrn = `urn:li:person:${linkedinId}`;

  // Upload image first if provided
  let imageUrn: string | undefined;
  if (imageUrl) {
    imageUrn = await uploadImageToLinkedIn(accessToken, linkedinId, imageUrl);
  }

  // Build post body (Posts API v2 format)
  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    lifecycleState: 'PUBLISHED',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
  };

  if (imageUrn) {
    body.content = {
      media: { title: 'Post image', id: imageUrn },
    };
  }

  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedInApiHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('LinkedIn post publish failed:', errorData);

    if (response.status === 401) throw new Error('TOKEN_EXPIRED');
    if (response.status === 403) throw new Error('Sem permissão para publicar. Verifique se o scope w_member_social está ativo.');
    if (response.status === 429) throw new Error('Limite de publicações atingido. Tente novamente mais tarde.');

    throw new Error(`Falha ao publicar: ${errorData.message || errorData.error || response.statusText}`);
  }

  const postId = response.headers.get('x-restli-id') || '';
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
 * Fetch engagement metrics (reactions + comments) for a single post.
 * Uses the socialMetadata endpoint (available with w_member_social).
 * The postId should be the activity URN returned when publishing.
 */
export async function fetchPostMetrics(
  accessToken: string,
  postId: string
): Promise<LinkedInPostMetrics> {
  // Ensure we have an activity URN format
  const activityUrn = postId.startsWith('urn:li:')
    ? postId
    : `urn:li:activity:${postId}`;

  const url = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(activityUrn)}`;

  const response = await fetch(url, {
    headers: linkedInApiHeaders(accessToken),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('LinkedIn socialMetadata failed:', err);
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

  // Build URN list
  const urns = postIds.map(id =>
    id.startsWith('urn:li:') ? id : `urn:li:activity:${id}`
  );

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
    console.error('LinkedIn socialMetadata batch failed:', err);
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
    const urn = id.startsWith('urn:li:') ? id : `urn:li:activity:${id}`;
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
