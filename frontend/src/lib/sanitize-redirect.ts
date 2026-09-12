/**
 * Restrict redirect targets to same-origin relative paths.
 *
 * Rejects: absolute URLs (https://evil.com), protocol-relative URLs
 * (//evil.com), scheme-relative (\\evil.com), and anything with a
 * scheme. Only `/path`-style targets pass; anything else falls back
 * to the provided default.
 */
export function sanitizeRedirect(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // protocol-relative (//host) and backslash variants
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (raw.includes('\\')) return fallback;
  // control characters can smuggle headers/URLs
  if (/[\r\n\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
