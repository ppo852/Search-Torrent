/**
 * Fusionne les snapshots RSS successifs et purge hors fenêtre de rétention.
 * Évite de perdre des releases si le tracker ne renvoie que les N derniers items.
 */

import { RSS_ITEM_RETENTION_HOURS } from '../../../shared/rss-home-hours.js';

export { RSS_ITEM_RETENTION_HOURS };

/**
 * Clé stable pour dédoublonner un item torrent.
 * Priorité : infohash → titre+taille (même release) → link → titre+date.
 * @param {Object} item
 * @returns {string}
 */
export function getRssItemKey(item) {
  if (!item || typeof item !== 'object') return '';

  const infohash = String(
    item.infohash || item.torznab_attr?.infohash || item.torznab_attr?.infoHash || ''
  )
    .trim()
    .toLowerCase();
  if (/^[a-f0-9]{40}$/.test(infohash)) return `h:${infohash}`;

  const title = String(item.title || '').trim().toLowerCase();
  const size = Number(item.size || item.torznab_attr?.size || 0);
  if (title && Number.isFinite(size) && size > 0) {
    return `s:${title}|${size}`;
  }

  const link = String(item.link || item.torrent || '').trim().toLowerCase();
  if (link) return `l:${link}`;

  const pubDate = String(item.pubDate || '').trim();
  return title ? `t:${title}|${pubDate}` : '';
}

function pubDateMs(item) {
  const ms = new Date(item?.pubDate).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function hasTmdb(item) {
  return Boolean(item?.tmdb && (item.tmdb.tmdb_id || item.tmdb.title));
}

function pickPreferred(existing, incoming) {
  const existingMs = pubDateMs(existing);
  const incomingMs = pubDateMs(incoming);
  if (incomingMs > existingMs) return incoming;
  if (incomingMs < existingMs) return existing;
  // Même date : garder celui qui a déjà le match TMDB
  if (!hasTmdb(existing) && hasTmdb(incoming)) return incoming;
  if (hasTmdb(existing) && !hasTmdb(incoming)) return existing;
  return incoming;
}

/**
 * @param {unknown} items
 * @returns {Object[]}
 */
function asItemArray(items) {
  return Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
}

/**
 * Dédoublonne une liste par getRssItemKey (sans filtre d’âge).
 * Utile à la lecture du cache déjà rempli de doublons.
 * @param {Object[]} items
 * @returns {Object[]}
 */
export function dedupeRssItems(items) {
  const byKey = new Map();
  for (const item of asItemArray(items)) {
    const key = getRssItemKey(item);
    if (!key) continue;
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferred(existing, item) : item);
  }
  const deduped = [...byKey.values()];
  deduped.sort((a, b) => pubDateMs(b) - pubDateMs(a));
  return deduped;
}

/**
 * Fusionne anciens + nouveaux items, purge ceux hors rétention.
 * Les items sans pubDate valide ne sont gardés que s’ils viennent du snapshot frais.
 *
 * @param {Object[]} previousItems
 * @param {Object[]} freshItems
 * @param {Object} [options]
 * @param {number} [options.retentionHours]
 * @param {number} [options.nowMs]
 * @returns {Object[]}
 */
export function mergeRssItemsWithRetention(previousItems, freshItems, options = {}) {
  const retentionHours = Number.isFinite(options.retentionHours)
    ? options.retentionHours
    : RSS_ITEM_RETENTION_HOURS;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const cutoffMs = nowMs - retentionHours * 60 * 60 * 1000;

  const previous = asItemArray(previousItems);
  const fresh = asItemArray(freshItems);
  const freshKeys = new Set(fresh.map(getRssItemKey).filter(Boolean));

  const byKey = new Map();

  for (const item of previous) {
    const key = getRssItemKey(item);
    if (!key) continue;
    byKey.set(key, item);
  }

  for (const item of fresh) {
    const key = getRssItemKey(item);
    if (!key) continue;
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferred(existing, item) : item);
  }

  const merged = [];
  for (const [key, item] of byKey) {
    const ms = pubDateMs(item);
    if (ms > 0) {
      if (ms >= cutoffMs) merged.push(item);
      continue;
    }
    // Sans date fiable : ne garder que s’il est encore dans le flux frais
    if (freshKeys.has(key)) merged.push(item);
  }

  merged.sort((a, b) => pubDateMs(b) - pubDateMs(a));
  return merged;
}

/**
 * Parse JSON cache en tableau (tolérant).
 * @param {string|null|undefined} json
 * @returns {Object[]}
 */
export function parseCachedRssItems(json) {
  if (!json || typeof json !== 'string') return [];
  try {
    const parsed = JSON.parse(json);
    return asItemArray(parsed);
  } catch {
    return [];
  }
}
