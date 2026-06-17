import { randomUUID } from 'crypto';
import { get, run } from '../core/db.js';
<<<<<<< HEAD
import logger from '../core/logger.js';
import { cleanMediaTitle } from '../media-inventory/utils.js';
=======
import { normalizeTitleForSearch } from '../media-inventory/utils.js';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

/**
 * Récupère les données du cache RSS
 * @param {string} feedId - ID du flux RSS
 * @param {string} feedUrl - URL du flux RSS (en cas d'absence d'ID)
 * @param {boolean} includeExpired - Inclure les entrées expirées
 * @returns {Promise<Object|null>} Données du cache ou null si aucune entrée trouvée
 */
export async function getRSSCache(feedId, feedUrl, includeExpired = false) {
  const now = new Date().toISOString();
  
  const sql = includeExpired
    ? 'SELECT * FROM rss_items_cache WHERE feed_id = ? OR feed_url = ? ORDER BY last_updated DESC LIMIT 1'
    : 'SELECT * FROM rss_items_cache WHERE (feed_id = ? OR feed_url = ?) AND expires_at > ? ORDER BY last_updated DESC LIMIT 1';
  
  const params = includeExpired 
    ? [feedId, feedUrl]
    : [feedId, feedUrl, now];
  
  try {
    return await get(sql, params);
  } catch (err) {
    logger.error('Erreur lors de la récupération du cache RSS:', err);
    throw err;
  }
}

/**
 * Sauvegarde les données dans le cache RSS
 * @param {string} feedId - ID du flux RSS
 * @param {string} feedUrl - URL du flux RSS
 * @param {string} itemsJson - Données des éléments au format JSON
 * @param {string|null} itemsWithTMDB - Données enrichies avec TMDB au format JSON
 * @param {Object} options - Options additionnelles
 * @returns {Promise<void>}
 */
export async function saveRSSCache(feedId, feedUrl, itemsJson, itemsWithTMDB, options = {}) {
  const cacheId = randomUUID();
  const now = new Date();
  const lastUpdated = now.toISOString();
  
  // Si expiresAt n'est pas fourni, définir par défaut à 30 minutes dans le futur
  const cacheDurationMinutes = options.cacheDurationMinutes || 30;
  const expiresAt = options.expiresAt || new Date(now.getTime() + cacheDurationMinutes * 60000).toISOString();

  try {
    await run('DELETE FROM rss_items_cache WHERE feed_url = ?', [feedUrl]);

    const sql = `INSERT INTO rss_items_cache (
      id, feed_id, feed_url, items_json, items_with_tmdb_json, tmdb_updated_at, last_updated, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      cacheId, 
      feedId, 
      feedUrl, 
      itemsJson, 
      itemsWithTMDB, 
      itemsWithTMDB ? lastUpdated : null,
      lastUpdated, 
      expiresAt
    ];
    
    await run(sql, params);
  } catch (err) {
    logger.error('Erreur lors de l\'enregistrement du cache RSS:', err);
    throw err;
  }
}

/**
 * Met à jour le cache RSS avec les données TMDB
 * @param {string} feedId - ID du flux RSS
 * @param {Array} enrichedItems - Éléments enrichis avec les données TMDB
 * @returns {Promise<void>}
 */
export async function updateRSSCacheWithTMDB(feedId, enrichedItems) {
  const now = new Date().toISOString();
  const itemsWithTMDBJson = JSON.stringify(enrichedItems);
  
  try {
    const sql = 'UPDATE rss_items_cache SET items_with_tmdb_json = ?, tmdb_updated_at = ? WHERE feed_id = ? ORDER BY last_updated DESC LIMIT 1';
    await run(sql, [itemsWithTMDBJson, now, feedId]);
  } catch (err) {
    logger.error('Erreur lors de la mise à jour du cache TMDB:', err);
    throw err;
  }
}

/**
 * Récupère les données TMDB depuis le cache par titre
 * @param {string} title - Titre pour lequel chercher des données TMDB
 * @returns {Promise<Object|null>} Données TMDB ou null si aucune entrée trouvée
 */
export async function getTMDBCacheByTitle(title) {
  const normalizedTitle = cleanMediaTitle(title);
  
  try {
    const now = new Date().toISOString();
    const row = await get(
      'SELECT * FROM tmdb_cache WHERE normalized_title = ? AND expires_at > ? LIMIT 1',
      [normalizedTitle, now]
    );
    
    if (row) {
      return JSON.parse(row.tmdb_data);
    }
    return null;
  } catch (err) {
    logger.error('Erreur lors de la récupération du cache TMDB:', err);
    throw err;
  }
}

/**
 * Sauvegarde les données TMDB dans le cache
 * @param {string} title - Titre associé aux données TMDB
 * @param {Object} tmdbData - Données TMDB à sauvegarder
 * @returns {Promise<void>}
 */
export async function saveTMDBCache(title, tmdbData) {
  const id = randomUUID();
  const normalizedTitle = cleanMediaTitle(title);
  const now = new Date().toISOString();
  
  // Cache TMDB valide 7 jours (les données ne changent pas souvent)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  try {
    await run(
      'INSERT INTO tmdb_cache (id, title, normalized_title, tmdb_data, last_updated, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, normalizedTitle, JSON.stringify(tmdbData), now, expiresAt.toISOString()]
    );
  } catch (err) {
    logger.error('Erreur lors de l\'enregistrement du cache TMDB:', err);
    throw err;
  }
}

const TV_SHOW_CACHE_DAYS = 7;

/**
 * Récupère les détails show TMDB depuis le cache persistant (par tmdb_id).
 */
export async function getTMDBTvShowCache(tmdbId) {
  if (!Number.isFinite(tmdbId)) return null;

  try {
    const now = new Date().toISOString();
    const row = await get(
      'SELECT show_data FROM tmdb_tv_show_cache WHERE tmdb_id = ? AND expires_at > ? LIMIT 1',
      [tmdbId, now]
    );
    if (!row?.show_data) return null;
    return JSON.parse(row.show_data);
  } catch (err) {
    logger.error('Erreur lors de la récupération du cache TMDB tv show:', err);
    return null;
  }
}

/**
 * Sauvegarde les détails show TMDB (genres, statut, dates) par tmdb_id.
 */
export async function saveTMDBTvShowCache(tmdbId, showData) {
  if (!Number.isFinite(tmdbId) || !showData) return;

  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TV_SHOW_CACHE_DAYS);

  try {
    await run('DELETE FROM tmdb_tv_show_cache WHERE tmdb_id = ?', [tmdbId]);
    await run(
      `INSERT INTO tmdb_tv_show_cache (tmdb_id, show_data, last_updated, expires_at)
       VALUES (?, ?, ?, ?)`,
      [tmdbId, JSON.stringify(showData), now.toISOString(), expiresAt.toISOString()]
    );
  } catch (err) {
    logger.error('Erreur lors de l\'enregistrement du cache TMDB tv show:', err);
  }
}

export default {
  getRSSCache,
  saveRSSCache,
  updateRSSCacheWithTMDB,
  getTMDBCacheByTitle,
  saveTMDBCache,
  getTMDBTvShowCache,
  saveTMDBTvShowCache,
};
