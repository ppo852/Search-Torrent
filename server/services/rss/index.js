import parser from './parser.js';
import cache from './cache.js';
import tmdb from './tmdb.js';
import * as db from '../core/db.js';
import logger from '../core/logger.js';
import { deleteAppCacheByPrefix } from '../core/app-cache.js';
import {
  mergeRssItemsWithRetention,
  parseCachedRssItems,
  dedupeRssItems,
  RSS_ITEM_RETENTION_HOURS,
} from './merge-retention.js';

/**
 * Charge le snapshot précédent (même expiré) pour fusionner selon RSS_ITEM_RETENTION_HOURS.
 */
async function loadPreviousRssItems(feedId, url) {
  const previous = await cache.getRSSCache(feedId, url, true);
  if (!previous) {
    return { raw: [], enriched: [] };
  }
  return {
    raw: parseCachedRssItems(previous.items_json),
    enriched: parseCachedRssItems(previous.items_with_tmdb_json),
  };
}

/**
 * Récupère un flux RSS avec gestion du cache
 * @param {string} feedId - ID du flux RSS
 * @param {string} url - URL du flux RSS
 * @param {Object} options - Options additionnelles
 * @returns {Promise<Object>} Éléments du flux RSS
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
            items: dedupeRssItems(parseCachedRssItems(cachedData.items_with_tmdb_json)),
            tmdbAvailable: true,
            fromExpiredCache: false,
          };
        }
        if (cachedData.items_json) {
          return {
            items: dedupeRssItems(parseCachedRssItems(cachedData.items_json)),
            tmdbAvailable: false,
            fromExpiredCache: false,
          };
        }
      }
    }

    // Snapshot précédent (rétention RSS_ITEM_RETENTION_HOURS) + flux frais tracker
    const previous = await loadPreviousRssItems(feedId, url);
    logger.debug('rss', `Récupération du flux RSS ${url} (ID: ${feedId})`);
    const freshItems = await parser.parseRSSFeed(url);

    let enrichedFresh = freshItems;
    if (includeTMDB) {
      enrichedFresh = await tmdb.enrichItemsWithTMDB(freshItems);
      tmdbAvailable = true;
    }

    const mergedRaw = mergeRssItemsWithRetention(previous.raw, freshItems, {
      retentionHours: RSS_ITEM_RETENTION_HOURS,
    });
    const mergedEnriched = includeTMDB
      ? mergeRssItemsWithRetention(
          previous.enriched.length ? previous.enriched : previous.raw,
          enrichedFresh,
          { retentionHours: RSS_ITEM_RETENTION_HOURS }
        )
      : mergedRaw;

    items = includeTMDB ? mergedEnriched : mergedRaw;

    await cache.saveRSSCache(
      feedId,
      url,
      JSON.stringify(mergedRaw),
      includeTMDB ? JSON.stringify(mergedEnriched) : null
    );
    if (invalidateHomeCache) {
      await deleteAppCacheByPrefix('recent-home:');
    }

    return {
      items,
      tmdbAvailable,
      fromExpiredCache,
    };
  } catch (error) {
    logger.error(`Erreur lors de la récupération du flux RSS ${feedId}:`, error);

    const expiredCache = await cache.getRSSCache(feedId, url, true);

    if (expiredCache) {
      logger.debug('rss', `Utilisation du cache expiré pour le flux ${feedId} suite à une erreur`);

      if (includeTMDB && expiredCache.items_with_tmdb_json) {
        return {
          items: dedupeRssItems(parseCachedRssItems(expiredCache.items_with_tmdb_json)),
          tmdbAvailable: true,
          fromExpiredCache: true,
        };
      }
      if (expiredCache.items_json) {
        return {
          items: dedupeRssItems(parseCachedRssItems(expiredCache.items_json)),
          tmdbAvailable: false,
          fromExpiredCache: true,
        };
      }
    }

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

    const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');

    if (!feeds || feeds.length === 0) {
      logger.debug('rss', 'Aucun flux RSS trouvé à rafraîchir');
      return;
    }

    logger.debug('rss', `Rafraîchissement de ${feeds.length} flux RSS...`);

    for (const feed of feeds) {
      try {
        await fetchRSSFeedWithCache(feed.id, feed.feed_url, {
          forceRefresh: true,
          invalidateHomeCache: false,
        });
        logger.debug('rss', `Flux ${feed.feed_name} (${feed.id}) rafraîchi avec succès`);
      } catch (error) {
        logger.error(`Erreur lors du rafraîchissement du flux ${feed.feed_name} (${feed.id}):`, error);
      }
    }

    await deleteAppCacheByPrefix('recent-home:');
    logger.debug('rss', 'Cache accueil trackers invalidé après resync RSS');
  } catch (error) {
    logger.error('Erreur lors du rafraîchissement des flux RSS populaires:', error);
  }
}

export default {
  fetchRSSFeedWithCache,
  refreshPopularRSSFeeds,
  parser,
  cache,
  tmdb,
};
