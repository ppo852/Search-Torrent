import { normalizeForKeywordMatch } from './keywords.js';

const MAKING_OF_PATTERN = /\bmaking[\s._-]*of\b/i;
const BEHIND_SCENES_PATTERN = /\bbehind[\s._-]*the[\s._-]*scenes\b/i;
const FEATURETTE_PATTERN = /\bfeaturette\b/i;
const BONUS_PATTERN = /\bbonus\b/i;
const EXTRAS_PATTERN = /\bextras?\b/i;
const DOC_RELEASE_PATTERN = /\.doc\./i;
const DOCUMENTARY_WORD_PATTERN = /\b(documentary|documentaire|docu)\b/i;

/** Titre de demande = making-of / doc / BTS → pas de filtre extras. */
const EXTRA_REQUEST_TITLE_PATTERNS = [
  MAKING_OF_PATTERN,
  /\bdocumentaire\b/i,
  /\bdocumentary\b/i,
  BEHIND_SCENES_PATTERN,
  FEATURETTE_PATTERN,
];

/** Filtre extras : off pour documentaires / titres making-of, BTS, etc. */
export function shouldApplyMovieExtraFilter({ isDocumentary = false, titleVariants = [] } = {}) {
  if (isDocumentary) return false;
  const titles = (titleVariants || []).map(String).filter(Boolean);
  return !titles.some((title) =>
    EXTRA_REQUEST_TITLE_PATTERNS.some((pattern) => pattern.test(title))
  );
}

/** « The Odyssey: The Making of an Epic » → « The Odyssey » */
export function stripExtraContentSuffix(title) {
  let s = String(title || '').trim();
  if (!s) return '';

  const prefix = s.match(
    /^(?:the\s+)?(?:making[\s._-]*of|behind[\s._-]*the[\s._-]*scenes)\s*:?\s*(.+)$/i
  );
  if (prefix?.[1]) return prefix[1].replace(/[\s:.\-_]+$/g, '').trim();

  return s
    .replace(
      /(?::|\s)+(?:the\s+)?(?:making[\s._-]*of|behind[\s._-]*the[\s._-]*scenes|(?:a\s+)?(?:documentary|documentaire|featurette))\b.*$/i,
      ''
    )
    .replace(/[\s:.\-_]+$/g, '')
    .trim();
}

/** Ajoute le titre cœur pour pertinence (making-of / docu / BTS uniquement). */
export function expandTitleVariantsForRelevance(titleVariants, { isDocumentary = false } = {}) {
  const base = [...new Set((titleVariants || []).map(String).filter(Boolean))];
  const expand =
    isDocumentary
    || base.some((t) => EXTRA_REQUEST_TITLE_PATTERNS.some((p) => p.test(t)));
  if (!expand) return base;

  const cores = [];
  for (const t of base) {
    const core = stripExtraContentSuffix(t);
    if (core.length >= 3 && core.toLowerCase() !== t.toLowerCase()) cores.push(core);
  }
  return [...new Set([...base, ...cores])];
}

function normalizedWords(value) {
  return normalizeForKeywordMatch(value).spaced.split(/\s+/).filter(Boolean);
}

function titleContainsToken(titleVariants, token) {
  const tok = String(token || '').toLowerCase();
  if (!tok) return false;
  return (titleVariants || []).some((title) => normalizedWords(title).includes(tok));
}

/** Making-of / bonus / doc parasite sur une demande de long-métrage classique. */
export function isMovieExtraTorrent(torrentName, { titleVariants = [] } = {}) {
  const raw = String(torrentName || '');
  if (!raw.trim()) return false;

  const { spaced } = normalizeForKeywordMatch(raw);

  if (MAKING_OF_PATTERN.test(spaced) || MAKING_OF_PATTERN.test(raw)) return true;
  if (BEHIND_SCENES_PATTERN.test(spaced) || BEHIND_SCENES_PATTERN.test(raw)) return true;
  if (FEATURETTE_PATTERN.test(spaced)) return true;
  if (BONUS_PATTERN.test(spaced)) return true;
  if (EXTRAS_PATTERN.test(spaced)) return true;

  if (DOCUMENTARY_WORD_PATTERN.test(spaced)) {
    const allowed =
      titleContainsToken(titleVariants, 'documentary')
      || titleContainsToken(titleVariants, 'documentaire')
      || titleContainsToken(titleVariants, 'docu');
    if (!allowed) return true;
  }

  if (DOC_RELEASE_PATTERN.test(raw) && !titleContainsToken(titleVariants, 'doc')) {
    return true;
  }

  return false;
}
