/**
 * Détection et catégorisation torrents (UI + qBittorrent).
 * normalize / infer / resolve : shared/qbit-categories.js
 * getCategoryLabel : détection Prowlarr / nom de fichier (UI uniquement).
 */

import qbitConfig from '../../shared/qbit-categories.json';
import {
  QBIT_CATEGORIES,
  normalizeQbitCategory,
  inferQbitCategoryFromMediaType,
  resolveQbitCategory,
} from '../../shared/qbit-categories.js';

export {
  QBIT_CATEGORIES,
  normalizeQbitCategory,
  inferQbitCategoryFromMediaType,
  resolveQbitCategory,
};

export type CategoryResult = (typeof qbitConfig.canonical)[keyof typeof qbitConfig.canonical];

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
    if (fromForced) return fromForced as CategoryResult;
  }

  if (categoryId) {
    if (categoryId === 5070) return QBIT_CATEGORIES.ANIME as CategoryResult;
    if (categoryId >= 2000 && categoryId < 3000) return QBIT_CATEGORIES.MOVIES as CategoryResult;
    if (categoryId >= 5000 && categoryId < 6000) return QBIT_CATEGORIES.TV as CategoryResult;
    if (categoryId >= 3000 && categoryId < 4000) return QBIT_CATEGORIES.MUSIC as CategoryResult;
    if (isGameCategoryId(categoryId)) return QBIT_CATEGORIES.GAMES as CategoryResult;
    if (categoryId >= 4000 && categoryId < 5000) return QBIT_CATEGORIES.SOFTWARE as CategoryResult;
    if (categoryId >= 7000 && categoryId < 8000) return QBIT_CATEGORIES.BOOKS as CategoryResult;
  }

  const catStr = (categoryDesc || '').toLowerCase();
  const nameStr = (fileName || '').toLowerCase();

  if (/\banime\b/i.test(catStr)) {
    return QBIT_CATEGORIES.ANIME as CategoryResult;
  }

  if (/\banimation\b|\banimated\b/i.test(catStr)) {
    return QBIT_CATEGORIES.ANIMATION as CategoryResult;
  }

  if (/music|musique|audio|flac|mp3|album|lossless|soundtrack/i.test(catStr) ||
      (/\.mp3|-mp3|flac|lossless/i.test(nameStr))) {
    return QBIT_CATEGORIES.MUSIC as CategoryResult;
  }

  if (/movie|film|cinéma|cinema/i.test(catStr)) {
    return QBIT_CATEGORIES.MOVIES as CategoryResult;
  }

  if (/tv|série|serie|show|episode|saison|season/i.test(catStr) ||
      (/\bs\d{2}e\d{2}\b|saison \d+|season \d+/i.test(nameStr))) {
    return QBIT_CATEGORIES.TV as CategoryResult;
  }

  if (/game|jeu|jeux|pc-game|gog|steam|ps4|ps5|xbox|switch|nintendo/i.test(catStr) ||
      /\b(game|games|jeu|jeux|gog|steam|fitgirl|codex|empress)\b/i.test(nameStr)) {
    return QBIT_CATEGORIES.GAMES as CategoryResult;
  }

  if (/software|logiciel|logiciels|application|applications|app|utility|tool|pc\/|\/pc|windows|macos|linux|0day|osx/i.test(catStr)) {
    return QBIT_CATEGORIES.SOFTWARE as CategoryResult;
  }

  if (/book|livre|ebook|magazine|epub|pdf|comics|bd/i.test(catStr) ||
      (/\.epub|\.pdf|comics|mobi/i.test(nameStr))) {
    return QBIT_CATEGORIES.BOOKS as CategoryResult;
  }

  if (categoryDesc) {
    const normalized = normalizeQbitCategory(categoryDesc);
    if (normalized) return normalized as CategoryResult;
  }

  if (searchContext === 'software') {
    if (isGameCategoryId(categoryId) || isLikelyGameText(categoryDesc, fileName)) {
      return QBIT_CATEGORIES.GAMES as CategoryResult;
    }
    return QBIT_CATEGORIES.SOFTWARE as CategoryResult;
  }

  return QBIT_CATEGORIES.OTHER as CategoryResult;
}
