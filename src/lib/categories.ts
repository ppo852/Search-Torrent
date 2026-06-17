/**
 * Détection et catégorisation torrents (UI + qBittorrent).
 * Noms officiels qBit : shared/qbit-categories.json
 */

import qbitConfig from '../../shared/qbit-categories.json';

export const QBIT_CATEGORIES = qbitConfig.canonical;

export type CategoryResult = typeof QBIT_CATEGORIES[keyof typeof QBIT_CATEGORIES];

const CANONICAL = new Set<string>(Object.values(QBIT_CATEGORIES));

const ALIASES = new Map<string, CategoryResult>(
  Object.entries(qbitConfig.aliases).map(([alias, key]) => [
    alias,
    QBIT_CATEGORIES[key as keyof typeof QBIT_CATEGORIES],
  ])
);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeQbitCategory(value?: string | null): CategoryResult | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CANONICAL.has(trimmed)) return trimmed as CategoryResult;

  const key = normalizeKey(trimmed);
  return ALIASES.get(key) ?? null;
}

export function inferQbitCategoryFromMediaType(mediaType?: string | null): CategoryResult | null {
  if (mediaType === 'movie') return QBIT_CATEGORIES.MOVIES;
  if (mediaType === 'anime') return QBIT_CATEGORIES.ANIME;
  if (mediaType === 'tv') return QBIT_CATEGORIES.TV;
  if (mediaType === 'music') return QBIT_CATEGORIES.MUSIC;
  if (mediaType === 'software') return QBIT_CATEGORIES.SOFTWARE;
  if (mediaType === 'books' || mediaType === 'book') return QBIT_CATEGORIES.BOOKS;
  if (mediaType === 'game' || mediaType === 'games') return QBIT_CATEGORIES.GAMES;
  return null;
}

export function resolveQbitCategory(value?: string | null, mediaType?: string | null): CategoryResult | null {
  return normalizeQbitCategory(value) || inferQbitCategoryFromMediaType(mediaType) || null;
}

export function isGameCategoryId(categoryId?: number): boolean {
  if (!categoryId) return false;
  return categoryId === 4070 || (categoryId >= 1000 && categoryId < 2000);
}

function isLikelyGameText(categoryDesc?: string, fileName?: string): boolean {
  const text = `${categoryDesc || ''} ${fileName || ''}`.toLowerCase();
  return /\b(game|games|jeu|jeux|gog|steam|ps4|ps5|xbox|switch|nintendo|fitgirl|codex|empress)\b/i.test(text);
}

/**
 * Détermine la catégorie d'un torrent en fonction de son ID Prowlarr,
 * de sa description textuelle, de son nom de fichier ou d'un type forcé.
 */
export function getCategoryLabel(
  categoryId?: number,
  categoryDesc?: string,
  fileName?: string,
  forcedType?: string,
  searchContext?: string
): CategoryResult {
  if (forcedType) {
    const fromForced = inferQbitCategoryFromMediaType(forcedType);
    if (fromForced) return fromForced;
  }

  if (categoryId) {
    if (categoryId === 5070) return QBIT_CATEGORIES.ANIME;
    if (categoryId >= 2000 && categoryId < 3000) return QBIT_CATEGORIES.MOVIES;
    if (categoryId >= 5000 && categoryId < 6000) return QBIT_CATEGORIES.TV;
    if (categoryId >= 3000 && categoryId < 4000) return QBIT_CATEGORIES.MUSIC;
    if (isGameCategoryId(categoryId)) return QBIT_CATEGORIES.GAMES;
    if (categoryId >= 4000 && categoryId < 5000) return QBIT_CATEGORIES.SOFTWARE;
    if (categoryId >= 7000 && categoryId < 8000) return QBIT_CATEGORIES.BOOKS;
  }

  const catStr = (categoryDesc || '').toLowerCase();
  const nameStr = (fileName || '').toLowerCase();

  if (/anime|animation/i.test(catStr)) {
    return QBIT_CATEGORIES.ANIME;
  }

  if (/music|musique|audio|flac|mp3|album|lossless|soundtrack/i.test(catStr) ||
      (/\.mp3|-mp3|flac|lossless/i.test(nameStr))) {
    return QBIT_CATEGORIES.MUSIC;
  }

  if (/movie|film|cinéma|cinema/i.test(catStr)) {
    return QBIT_CATEGORIES.MOVIES;
  }

  if (/tv|série|serie|show|episode|saison|season/i.test(catStr) ||
      (/\bs\d{2}e\d{2}\b|saison \d+|season \d+/i.test(nameStr))) {
    return QBIT_CATEGORIES.TV;
  }

  if (/game|jeu|jeux|pc-game|gog|steam|ps4|ps5|xbox|switch|nintendo/i.test(catStr) ||
      /\b(game|games|jeu|jeux|gog|steam|fitgirl|codex|empress)\b/i.test(nameStr)) {
    return QBIT_CATEGORIES.GAMES;
  }

  if (/software|logiciel|logiciels|application|applications|app|utility|tool|pc\/|\/pc|windows|macos|linux|0day|osx/i.test(catStr)) {
    return QBIT_CATEGORIES.SOFTWARE;
  }

  if (/book|livre|ebook|magazine|epub|pdf|comics|bd/i.test(catStr) ||
      (/\.epub|\.pdf|comics|mobi/i.test(nameStr))) {
    return QBIT_CATEGORIES.BOOKS;
  }

  if (categoryDesc) {
    const normalized = normalizeQbitCategory(categoryDesc);
    if (normalized) return normalized;
  }

  if (searchContext === 'software') {
    if (isGameCategoryId(categoryId) || isLikelyGameText(categoryDesc, fileName)) {
      return QBIT_CATEGORIES.GAMES;
    }
    return QBIT_CATEGORIES.SOFTWARE;
  }

  return QBIT_CATEGORIES.OTHER;
}
