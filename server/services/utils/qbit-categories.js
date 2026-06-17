/**
 * Noms canoniques qBittorrent — source unique : shared/qbit-categories.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(path.join(__dirname, '../../../shared/qbit-categories.json'), 'utf8')
);

export const QBIT_CATEGORIES = Object.freeze({ ...config.canonical });

const CANONICAL = new Set(Object.values(QBIT_CATEGORIES));

const ALIASES = new Map(
  Object.entries(config.aliases).map(([alias, key]) => [alias, QBIT_CATEGORIES[key]])
);

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeQbitCategory(value) {
  if (value == null || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CANONICAL.has(trimmed)) return trimmed;

  const key = normalizeKey(trimmed);
  if (ALIASES.has(key)) return ALIASES.get(key);

  return null;
}

/**
 * @param {string|null|undefined} mediaType
 * @returns {string|null}
 */
export function inferQbitCategoryFromMediaType(mediaType) {
  if (mediaType === 'movie') return QBIT_CATEGORIES.MOVIES;
  if (mediaType === 'anime') return QBIT_CATEGORIES.ANIME;
  if (mediaType === 'tv') return QBIT_CATEGORIES.TV;
  if (mediaType === 'music') return QBIT_CATEGORIES.MUSIC;
  if (mediaType === 'software') return QBIT_CATEGORIES.SOFTWARE;
  if (mediaType === 'books' || mediaType === 'book') return QBIT_CATEGORIES.BOOKS;
  if (mediaType === 'game' || mediaType === 'games') return QBIT_CATEGORIES.GAMES;
  return null;
}

/**
 * @param {string|null|undefined} value
 * @param {string|null|undefined} [mediaType]
 * @returns {string|null}
 */
export function resolveQbitCategory(value, mediaType) {
  return normalizeQbitCategory(value) || inferQbitCategoryFromMediaType(mediaType) || null;
}
