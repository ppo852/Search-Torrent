import parser from './parser.js';
import cache from './cache.js';
import tmdb from './tmdb.js';
import * as db from '../core/db.js';
import logger from '../core/logger.js';
import { deleteAppCacheByPrefix } from '../core/app-cache.js';

/**
 * Récupère un flux RSS avec gestion du cache
 * @param {string} feedId - ID du flux RSS
 * @param {string} url - URL du flux RSS
 * @param {Object} options - Options additionnelles
 * @returns {Promise<Array>} Éléments du flux RSS
 */
export async function fetchRSSFeedWithCache(feedId, url, options = {}) {
  const {
    forceRefresh = false,
    includeTMDB = true,
    invalidateHomeCache = true,
  } = options;
  
  try {
    let items = [];
    let fromExpiredCache = false;
    let tmdbAvailable = false;
    
    // Vérifier si une entrée de cache valide existe
    if (!forceRefresh) {
      const cachedData = await cache.getRSSCache(feedId, url);
      
      if (cachedData) {
        logger.debug('rss', `Cache trouvé pour le flux ${feedId}`);
        
        if (includeTMDB && cachedData.items_with_tmdb_json) {
          return {
            items: JSON.parse(cachedData.items_with_tmdb_json),
            tmdbAvailable: true,
            fromExpiredCache: false
          };
        } else if (cachedData.items_json) {
          return {
            items: JSON.parse(cachedData.items_json),
            tmdbAvailable: false,
            fromExpiredCache: false
          };
        }
      }
    }
    
    // Si aucun cache valide ou forceRefresh demandé, récupérer les nouvelles données
    logger.debug('rss', `Récupération du flux RSS ${url} (ID: ${feedId})`);
    items = await parser.parseRSSFeed(url);
    
    // Sauvegarder les données brutes
    const itemsJson = JSON.stringify(items);
    let itemsWithTMDBJson = null;
    
    // Enrichir avec TMDB si demandé
    if (includeTMDB) {
      const enrichedItems = await tmdb.enrichItemsWithTMDB(items);
      itemsWithTMDBJson = JSON.stringify(enrichedItems);
      items = enrichedItems;
      tmdbAvailable = true;
    }
    
    // Sauvegarder dans le cache
    await cache.saveRSSCache(feedId, url, itemsJson, itemsWithTMDBJson);
    if (invalidateHomeCache) {
      await deleteAppCacheByPrefix('recent-home:');
    }
    
    return {
      items,
      tmdbAvailable,
      fromExpiredCache
    };
  } catch (error) {
    logger.error(`Erreur lors de la récupération du flux RSS ${feedId}:`, error);
    
    // En cas d'erreur, essayer de récupérer depuis le cache même s'il est expiré
    const expiredCache = await cache.getRSSCache(feedId, url, true);
    
    if (expiredCache) {
      logger.debug('rss', `Utilisation du cache expiré pour le flux ${feedId} suite à une erreur`);
      
      if (includeTMDB && expiredCache.items_with_tmdb_json) {
        return {
          items: JSON.parse(expiredCache.items_with_tmdb_json),
          tmdbAvailable: true,
          fromExpiredCache: true
        };
      } else if (expiredCache.items_json) {
        return {
          items: JSON.parse(expiredCache.items_json),
          tmdbAvailable: false,
          fromExpiredCache: true
        };
      }
    }
    
    // Si pas de cache du tout, propager l'erreur
    throw error;
  }
}

/**
 * Rafraîchit les flux RSS populaires du système
 * @returns {Promise<void>}
 */
export async function refreshPopularRSSFeeds() {
  try {
    logger.debug('rss', 'Début du rafraîchissement des flux RSS populaires...');
    
    // Récupérer les flux RSS globaux
    const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');
    
    if (!feeds || feeds.length === 0) {
      logger.debug('rss', 'Aucun flux RSS trouvé à rafraîchir');
      return;
    }
    
    logger.debug('rss', `Rafraîchissement de ${feeds.length} flux RSS...`);
    
    // Rafraîchir chaque flux en forçant la mise à jour du cache
    for (const feed of feeds) {
      try {
        await fetchRSSFeedWithCache(feed.id, feed.feed_url, {
          forceRefresh: true,
          invalidateHomeCache: false,
        });
        logger.debug('rss', `Flux ${feed.feed_name} (${feed.id}) rafraîchi avec succès`);
      } catch (error) {
        logger.error(`Erreur lors du rafraîchissement du flux ${feed.feed_name} (${feed.id}):`, error);
        // Continuer avec les autres flux même en cas d'erreur
      }
    }
    
    await deleteAppCacheByPrefix('recent-home:');
    logger.debug('rss', 'Cache accueil trackers invalidé après resync RSS');
  } catch (error) {
    logger.error('Erreur lors du rafraîchissement des flux RSS populaires:', error);
  }
}

// Exporter toutes les fonctionnalités des sous-modules
export default {
  // Fonctions principales
  fetchRSSFeedWithCache,
  refreshPopularRSSFeeds,
  
  // Sous-modules pour un accès granulaire
  parser,
  cache,
  tmdb
};
