/**
 * Substitui {placeholders} numa string de tradução.
 *
 * @example
 * interpolate('Olá, {name}!', { name: 'Clara' })
 * // → 'Olá, Clara!'
 *
 * interpolate('{count} missão(ões)', { count: 3 })
 * // → '3 missão(ões)'
 */
export function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => String(params[key] ?? `{${key}}`),
  );
}
