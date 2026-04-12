/**
 * Generate a URL-friendly slug from a name.
 * "Boldfy Cliente" → "boldfy-cliente"
 * "Mônica Araújo" → "monica-araujo"
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')                    // decompose accents: é → e + ́
    .replace(/[\u0300-\u036f]/g, '')     // remove diacritic marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')       // remove non-alphanumeric
    .replace(/[\s_]+/g, '-')            // spaces/underscores → hyphens
    .replace(/-+/g, '-')               // collapse multiple hyphens
    .replace(/^-|-$/g, '');            // trim leading/trailing hyphens
}

/**
 * Generate a unique slug by appending a short suffix from the Firestore ID.
 * This ensures uniqueness without needing to query for collisions.
 *
 * "Boldfy Cliente" + "EAtDmaPb8O3Ril8T1Gp5" → "boldfy-cliente-eatdm"
 * "Monica" + "cx0UQsn7qIONgPztHilaVJU76fm1" → "monica-cx0uq"
 */
export function generateSlug(name: string, firestoreId: string): string {
  const base = slugify(name);
  // Use first 5 chars of the Firestore ID (lowercased) as disambiguator
  const suffix = firestoreId.slice(0, 5).toLowerCase();
  return base ? `${base}-${suffix}` : suffix;
}
