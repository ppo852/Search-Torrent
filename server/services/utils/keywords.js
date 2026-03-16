/**
 * Utility functions for keyword matching in quality profiles
 */

export function normalizeForKeywordMatch(value) {
  const spaced = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return {
    spaced,
    compact: spaced.replace(/\s+/g, '')
  };
}

export function flattenKeywords(keywords) {
  return (keywords || [])
    .flatMap((k) => String(k || '').split(/[|,;]+/))
    .map((k) => k.trim())
    .filter(Boolean);
}

export function titleContainsAny(title, keywords) {
  const t = normalizeForKeywordMatch(title);
  const flat = flattenKeywords(keywords);
  return flat.some((k) => {
    const kw = normalizeForKeywordMatch(k);
    return (kw.spaced && t.spaced.includes(kw.spaced)) || (kw.compact && t.compact.includes(kw.compact));
  });
}

export function titleContainsAll(title, keywords) {
  const t = normalizeForKeywordMatch(title);
  const flat = flattenKeywords(keywords);
  if (flat.length === 0) return true;
  return flat.every((k) => {
    const kw = normalizeForKeywordMatch(k);
    return (kw.spaced && t.spaced.includes(kw.spaced)) || (kw.compact && t.compact.includes(kw.compact));
  });
}

export default {
  normalizeForKeywordMatch,
  flattenKeywords,
  titleContainsAny,
  titleContainsAll
};
