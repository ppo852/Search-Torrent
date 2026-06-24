export type QualityFilter = 'all' | '480p' | '720p' | '1080p' | '4k';
export type LanguageFilter = 'admin' | 'all' | 'multi' | 'vf' | 'vostfr' | 'vo';

export const QUALITY_FILTER_OPTIONS: { value: QualityFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
];

export const LANGUAGE_FILTER_OPTIONS: { value: LanguageFilter; label: string }[] = [
  { value: 'admin', label: 'Profil par défaut' },
  { value: 'all', label: 'Toutes' },
  { value: 'multi', label: 'MULTI' },
  { value: 'vf', label: 'VF' },
  { value: 'vostfr', label: 'VOSTFR' },
  { value: 'vo', label: 'VO' },
];

export function matchesQualityFilter(title: string, quality: QualityFilter): boolean {
  if (quality === 'all') return true;
  const t = title.toLowerCase();
  switch (quality) {
    case '480p':
      return t.includes('480p');
    case '720p':
      return t.includes('720p');
    case '1080p':
      return t.includes('1080p');
    case '4k':
      return /\b4k\b/i.test(title) || t.includes('2160p') || /\buhd\b/i.test(title);
    default:
      return true;
  }
}

const LANGUAGE_MARKERS_RE = /\b(multi|vff|vfq|vfi|vf|vostfr|vost|french|truefrench|subfrench|vo)\b/i;
const TAGGED_FRENCH_OR_MULTI_RE = /\b(multi|vff|vfq|vfi|vf|vostfr|vost|french|truefrench|subfrench)\b/i;

function hasLanguageMarker(title: string): boolean {
  return LANGUAGE_MARKERS_RE.test(title) || /[.\-_](multi|vff|vf|vostfr|vost|vo)[.\-_]/i.test(title);
}

export function matchesLanguageFilter(title: string, language: LanguageFilter): boolean {
  if (language === 'all') return true;
  switch (language) {
    case 'multi':
      return /\bmulti\b/i.test(title);
    case 'vf':
      return /\b(truefrench|vff|vf|french)\b/i.test(title);
    case 'vostfr':
      return /\b(vostfr|vost)\b/i.test(title);
    case 'vo':
      if (TAGGED_FRENCH_OR_MULTI_RE.test(title)) return false;
      if (/\bvo\b/i.test(title) || /[.\-_]vo[.\-_]/i.test(title)) return true;
      return !hasLanguageMarker(title);
    default:
      return true;
  }
}
