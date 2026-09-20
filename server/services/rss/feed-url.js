/**
 * Normalise une URL de flux RSS pour détecter les doublons (même tracker).
 * Ne change pas les query params (apiKey, etc.).
 */
export function normalizeRssFeedUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return parsed.toString();
  } catch {
    return raw.replace(/\/+$/, '');
  }
}
