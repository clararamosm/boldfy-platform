// src/lib/apify.ts
// Apify API client for fetching LinkedIn post engagers (likers + commenters).
// Uses the "no cookies" actor — no LinkedIn session required.

export type LinkedInLead = {
  profileId: string;
  name: string;
  headline: string;
  profileUrl: string;
  photoUrl?: string;
  reactionType: string; // LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, FUNNY, or COMMENT
};

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';

/**
 * Fetch all engagers (likers + commenters) for a LinkedIn post URL.
 * Uses Apify's sync endpoint — returns data directly.
 *
 * @param postUrl - Full LinkedIn post URL (e.g. https://www.linkedin.com/feed/update/urn:li:share:123/)
 * @returns Array of leads with profile data and reaction type
 */
export async function fetchPostEngagers(postUrl: string): Promise<LinkedInLead[]> {
  if (!APIFY_TOKEN) {
    console.error('APIFY_TOKEN not configured — skipping lead collection');
    return [];
  }

  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [postUrl],
    }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`Apify request failed (${response.status}):`, errText);
    return [];
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    console.error('Apify returned unexpected format:', typeof data);
    return [];
  }

  // Map Apify output to our schema
  const leads: LinkedInLead[] = [];

  for (const item of data) {
    // Skip items without a profile URL
    const profileUrl = item.profileUrl || item.profile_url || '';
    if (!profileUrl) continue;

    leads.push({
      profileId: item.profileId || extractProfileId(profileUrl),
      name: item.name || item.firstName && item.lastName
        ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
        : 'Desconhecido',
      headline: item.headline || item.title || '',
      profileUrl,
      photoUrl: item.photoUrl || item.photo_url || item.profilePicture || undefined,
      reactionType: (item.reactionType || item.reaction_type || item.type || 'LIKE').toUpperCase(),
    });
  }

  return leads;
}

/**
 * Extract a stable profile ID from a LinkedIn profile URL.
 * e.g. "https://www.linkedin.com/in/john-doe-123/" → "john-doe-123"
 */
function extractProfileId(profileUrl: string): string {
  try {
    const url = new URL(profileUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    // /in/john-doe → "john-doe"
    if (parts[0] === 'in' && parts[1]) {
      return parts[1];
    }
    return parts.join('-') || profileUrl;
  } catch {
    return profileUrl.replace(/[^a-zA-Z0-9-]/g, '-');
  }
}

/**
 * Generate a stable Firestore document ID from a LinkedIn profile URL.
 * Uses the profile slug to create a deterministic ID.
 */
export function profileUrlToLeadId(profileUrl: string): string {
  return extractProfileId(profileUrl);
}
