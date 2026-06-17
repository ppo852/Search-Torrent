import { get, run } from './db.js';
import logger from './logger.js';
import { deleteAppCacheByPrefix } from './app-cache.js';

/**
 * Nettoie les entrées expirées des caches (RSS et TMDB)
 * @returns {Promise<Object>} Nombre d'entrées supprimées par type de cache
 */
export async function cleanupCaches() {
  const now = new Date().toISOString();
  
  try {
    logger.info('Début du nettoyage des caches...');
    
    // Nettoyer le cache RSS
    const rssDeleteResult = await run(
      'DELETE FROM rss_items_cache WHERE expires_at < ?',
      [now]
    );
    
    // Nettoyer le cache TMDB
    const tmdbDeleteResult = await run(
      'DELETE FROM tmdb_cache WHERE expires_at < ?',
      [now]
    );

    const tmdbTvShowDeleteResult = await run(
      'DELETE FROM tmdb_tv_show_cache WHERE expires_at < ?',
      [now]
    );

    const appCacheDeleteResult = await run(
      'DELETE FROM app_cache WHERE expires_at < ?',
      [now]
    );
    
    logger.info(`Nettoyage terminé: ${rssDeleteResult.changes} RSS, ${tmdbDeleteResult.changes} TMDB titre, ${tmdbTvShowDeleteResult.changes} TMDB tv, ${appCacheDeleteResult.changes} app_cache`);
    
    return {
      rssEntriesDeleted: rssDeleteResult.changes,
      tmdbEntriesDeleted: tmdbDeleteResult.changes,
      tmdbTvShowEntriesDeleted: tmdbTvShowDeleteResult.changes,
      appCacheEntriesDeleted: appCacheDeleteResult.changes,
    };
  } catch (error) {
    logger.error('Erreur lors du nettoyage des caches:', error);
    throw error;
  }
}

/**
 * Récupère des statistiques sur les caches actuels
 * @returns {Promise<Object>} Statistiques des caches
 */
export async function getCacheStats() {
  try {
    // Nombre total d'entrées RSS
    const rssCount = await get('SELECT COUNT(*) as count FROM rss_items_cache');
    
    // Nombre total d'entrées TMDB
    const tmdbCount = await get('SELECT COUNT(*) as count FROM tmdb_cache');
    const tmdbTvShowCount = await get('SELECT COUNT(*) as count FROM tmdb_tv_show_cache');
    const appCacheCount = await get('SELECT COUNT(*) as count FROM app_cache');
    
    // Taille approximative des données RSS (en comptant les caractères JSON)
    const rssSizeQuery = await get('SELECT SUM(LENGTH(items_json) + LENGTH(COALESCE(items_with_tmdb_json, ""))) as total_size FROM rss_items_cache');
    
    // Taille approximative des données TMDB
    const tmdbSizeQuery = await get('SELECT SUM(LENGTH(tmdb_data)) as total_size FROM tmdb_cache');
    const tmdbTvShowSizeQuery = await get('SELECT SUM(LENGTH(show_data)) as total_size FROM tmdb_tv_show_cache');
    const appCacheSizeQuery = await get('SELECT SUM(LENGTH(payload_json)) as total_size FROM app_cache');
    
    // Nombre d'entrées RSS expirées
    const now = new Date().toISOString();
    const rssExpiredCount = await get('SELECT COUNT(*) as count FROM rss_items_cache WHERE expires_at < ?', [now]);
    
    // Nombre d'entrées TMDB expirées
    const tmdbExpiredCount = await get('SELECT COUNT(*) as count FROM tmdb_cache WHERE expires_at < ?', [now]);
    const tmdbTvShowExpiredCount = await get('SELECT COUNT(*) as count FROM tmdb_tv_show_cache WHERE expires_at < ?', [now]);
    const appCacheExpiredCount = await get('SELECT COUNT(*) as count FROM app_cache WHERE expires_at < ?', [now]);
    
    return {
      rss: {
        totalEntries: rssCount?.count || 0,
        expiredEntries: rssExpiredCount?.count || 0,
        approximateSizeBytes: rssSizeQuery?.total_size || 0,
      },
      tmdb: {
        totalEntries: tmdbCount?.count || 0,
        expiredEntries: tmdbExpiredCount?.count || 0,
        approximateSizeBytes: tmdbSizeQuery?.total_size || 0,
      },
      tmdbTvShow: {
        totalEntries: tmdbTvShowCount?.count || 0,
        expiredEntries: tmdbTvShowExpiredCount?.count || 0,
        approximateSizeBytes: tmdbTvShowSizeQuery?.total_size || 0,
      },
      appCache: {
        totalEntries: appCacheCount?.count || 0,
        expiredEntries: appCacheExpiredCount?.count || 0,
        approximateSizeBytes: appCacheSizeQuery?.total_size || 0,
      },
    };
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques de cache:', error);
    throw error;
  }
}

/**
 * Vide complètement un type de cache spécifié
 * @param {string} cacheType - Type de cache à vider ('rss', 'tmdb' ou 'all')
 * @returns {Promise<Object>} Nombre d'entrées supprimées par type
 */
export async function clearCache(cacheType = 'all') {
  try {
    let rssDeleted = 0;
    let tmdbDeleted = 0;
    let tmdbTvShowDeleted = 0;
    let appCacheDeleted = 0;
    
    if (cacheType === 'all' || cacheType === 'rss') {
      const result = await run('DELETE FROM rss_items_cache');
      rssDeleted = result.changes;
      await deleteAppCacheByPrefix('recent-home:');
    }
    
    if (cacheType === 'all' || cacheType === 'tmdb') {
      const result = await run('DELETE FROM tmdb_cache');
      tmdbDeleted = result.changes;
      const tvShowResult = await run('DELETE FROM tmdb_tv_show_cache');
      tmdbTvShowDeleted = tvShowResult.changes;
      const appResult = await run('DELETE FROM app_cache');
      appCacheDeleted = appResult.changes;
    }
    
    return {
      rssEntriesDeleted: rssDeleted,
      tmdbEntriesDeleted: tmdbDeleted,
      tmdbTvShowEntriesDeleted: tmdbTvShowDeleted,
      appCacheEntriesDeleted: appCacheDeleted,
    };
  } catch (error) {
    logger.error(`Erreur lors de la suppression du cache ${cacheType}:`, error);
    throw error;
  }
}

/**
 * Programme le nettoyage quotidien des caches à 3h du matin
 * @returns {void}
 */
export function scheduleCacheCleanup() {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(3, 0, 0, 0);
  
  // Si l'heure actuelle est après 3h du matin, programmer pour le lendemain
  if (now >= nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const delay = nextRun.getTime() - now.getTime();
  
  setTimeout(() => {
    // Nettoyer les caches
    cleanupCaches()
      .then(result => {
        logger.info(`Nettoyage des caches réalisé: ${result.rssEntriesDeleted} RSS, ${result.tmdbEntriesDeleted} TMDB titre, ${result.tmdbTvShowEntriesDeleted} TMDB tv, ${result.appCacheEntriesDeleted} app_cache`);
      })
      .catch(error => {
        logger.error('Erreur lors du nettoyage programmé des caches:', error);
      });
      
    // Programmer le prochain nettoyage pour le lendemain
    setInterval(() => {
      cleanupCaches()
        .then(result => {
          logger.info(`Nettoyage quotidien des caches: ${result.rssEntriesDeleted} RSS, ${result.tmdbEntriesDeleted} TMDB titre, ${result.tmdbTvShowEntriesDeleted} TMDB tv, ${result.appCacheEntriesDeleted} app_cache`);
        })
        .catch(error => {
          logger.error('Erreur lors du nettoyage quotidien des caches:', error);
        });
    }, 24 * 60 * 60 * 1000);
  }, delay);
  
  logger.info(`Nettoyage des caches programmé pour ${nextRun.toLocaleString()}`);
}

export default {
  cleanupCaches,
  getCacheStats,
  clearCache,
  scheduleCacheCleanup
};
