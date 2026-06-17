import { randomUUID } from 'crypto';
import rssService from '../../services/rss/index.js';
import cacheService from '../../services/core/cache.js';
import rssCache from '../../services/rss/cache.js';
import { deleteAppCacheByPrefix } from '../../services/core/app-cache.js';
import * as db from '../../services/core/db.js';
import { getRecentForHome } from '../../services/rss/recent-for-home.js';

/**
 * Récupère tous les flux RSS
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getAllFeeds(req, res) {
  try {
    const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');
    res.json(feeds);
  } catch (error) {
    console.error('Erreur lors de la récupération des flux RSS:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Récupère les items de tous les flux RSS en un seul appel (cache serveur).
 */
export async function getAllRssItems(req, res) {
  try {
    const forceRefresh = req.query.force_refresh === 'true';
    const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');

    if (!feeds?.length) {
      return res.json({
        itemsByFeed: {},
        tmdbAvailable: false,
        fromExpiredCache: false,
      });
    }

    const itemsByFeed = {};
    let tmdbAvailable = false;
    let fromExpiredCache = false;

    for (const feed of feeds) {
      try {
        const result = await rssService.fetchRSSFeedWithCache(feed.id, feed.feed_url, {
          forceRefresh,
          includeTMDB: true,
          invalidateHomeCache: false,
        });

        itemsByFeed[feed.id] = (result.items || []).map((item) => ({
          ...item,
          feedName: feed.feed_name,
        }));

        if (result.tmdbAvailable) tmdbAvailable = true;
        if (result.fromExpiredCache) fromExpiredCache = true;
      } catch (error) {
        console.error(`Erreur flux RSS ${feed.feed_name}:`, error);
        itemsByFeed[feed.id] = [];
      }
    }

    if (forceRefresh) {
      await deleteAppCacheByPrefix('recent-home:');
    }

    res.json({ itemsByFeed, tmdbAvailable, fromExpiredCache });
  } catch (error) {
    console.error('Erreur lors de la récupération des items RSS:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des items RSS' });
  }
}

/**
 * Ajoute un nouveau flux RSS
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function addFeed(req, res) {

  const { feed_name, feed_url } = req.body;
  
  if (!feed_name || !feed_url) {
    return res.status(400).json({ error: 'Le nom et l\'URL du flux sont requis' });
  }

  try {
    const id = randomUUID();
    await db.run(
      'INSERT INTO global_rss_feeds (id, feed_name, feed_url, created_at) VALUES (?, ?, ?, ?)',
      [id, feed_name, feed_url, new Date().toISOString()]
    );
    
    res.status(201).json({ id, feed_name, feed_url });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du flux RSS:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Supprime un flux RSS
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function deleteFeed(req, res) {

  try {
    await db.run('DELETE FROM global_rss_feeds WHERE id = ?', [req.params.id]);
    res.json({ message: 'Flux RSS supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du flux RSS:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Récupère les éléments d'un flux RSS
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getFeedItems(req, res) {
  try {
    const feedId = req.params.id;
    const { forceRefresh, includeTMDB } = req.query;

    // Récupérer l'URL du flux à partir de l'ID
    const feed = await db.get('SELECT feed_url FROM global_rss_feeds WHERE id = ?', [feedId]);
    
    if (!feed) {
      return res.status(404).json({ error: 'Flux RSS non trouvé' });
    }
    
    const options = {
      forceRefresh: forceRefresh === 'true',
      includeTMDB: includeTMDB !== 'false', // par défaut true si non spécifié
    };
    
    const result = await rssService.fetchRSSFeedWithCache(feedId, feed.feed_url, options);
    res.json({
      items: result.items,
      tmdbAvailable: result.tmdbAvailable,
      fromExpiredCache: result.fromExpiredCache || false
    });
  } catch (error) {
    console.error(`Erreur lors de la récupération des éléments du flux RSS:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération des éléments du flux RSS' });
  }
}

/**
 * Gère les opérations de cache (clear, refresh)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function manageCache(req, res) {

  try {
    const { action, type } = req.body;

    if (action === 'clear') {
      const result = await cacheService.clearCache(type || 'all');
      res.json({ 
        message: 'Cache vidé avec succès', 
        details: result 
      });
    } else if (action === 'refresh') {
      if (type === 'expired') {
        const result = await cacheService.cleanupCaches();
        res.json({ 
          message: 'Nettoyage des caches expirés effectué avec succès', 
          details: result 
        });
      } else if (type === 'rss') {
        const { feedId } = req.body;
        
        if (!feedId) {
          return res.status(400).json({ error: 'ID de flux requis pour le rafraîchissement' });
        }
        
        try {
          // Récupérer l'URL du flux
          const feed = await db.get('SELECT feed_url FROM global_rss_feeds WHERE id = ?', [feedId]);
          
          if (!feed) {
            return res.status(404).json({ error: 'Flux RSS non trouvé' });
          }
          
          // Forcer le rafraîchissement
          const result = await rssService.fetchRSSFeedWithCache(feedId, feed.feed_url, { 
            forceRefresh: true 
          });
          
          res.json({ 
            message: 'Flux RSS rafraîchi avec succès',
            details: { feedId, itemCount: result.items.length }
          });
        } catch (err) {
          console.error(`Erreur lors du rafraîchissement du flux ${feedId}:`, err);
          return res.status(500).json({ error: 'Erreur lors du rafraîchissement du flux RSS' });
        }
      } else {
        res.status(400).json({ error: 'Type de rafraîchissement invalide' });
      }
    } else {
      res.status(400).json({ error: 'Action invalide' });
    }
  } catch (err) {
    console.error('Erreur lors de la gestion du cache:', err);
    res.status(500).json({ error: 'Erreur lors de la gestion du cache' });
  }
}

/**
 * Récupère les statistiques des caches et les combine avec les flux RSS
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getCacheStats(req, res) {
  try {
    const summary = await cacheService.getCacheStats();
    const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');
    const now = new Date().toISOString();

    const feedsWithCache = await Promise.all(feeds.map(async (feed) => {
      const cached = await rssCache.getRSSCache(feed.id, feed.feed_url, true);
      let cache = null;

      if (cached) {
        cache = {
          lastUpdated: cached.last_updated,
          expiresAt: cached.expires_at,
          isFresh: cached.expires_at > now,
        };
      }

      return { ...feed, cache };
    }));

    res.json({ summary, feeds: feedsWithCache });
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques de cache:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques de cache' });
  }
}

/**
 * Médias récents des trackers pour la page d'accueil (films, séries, anime)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getRecentHome(req, res) {
  try {
    const parsedHours = parseInt(req.query.hours, 10);
    const hours = Number.isFinite(parsedHours)
      ? Math.min(168, Math.max(1, parsedHours))
      : 72;

    const result = await getRecentForHome({ hours });
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des médias récents pour l\'accueil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des médias récents' });
  }
}

/**
 * Parse un flux RSS à partir d'une URL
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function parseRssUrl(req, res) {
  const { url } = req.query;
  const forceRefresh = req.query.force_refresh === 'true';
  const skipTMDB = req.query.skip_tmdb === 'true';
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    // Générer un ID unique pour le cache
    const feedId = randomUUID();
    
    // Utiliser la fonction pour récupérer et parser le flux RSS
    // [DEBUG ONLY] console.log(`Utilisation de la fonction pour parser ${url}`);
    const result = await rssService.fetchRSSFeedWithCache(feedId, url, {
      forceRefresh,
      includeTMDB: !skipTMDB,
      forceTMDBRefresh: forceRefresh
    });
    
    // Tri et limitation
    const sortedItems = [...result.items].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const limitedItems = sortedItems.slice(0, 200); // Augmentation de la limite à 200 éléments
    
    res.json({
      items: limitedItems,
      tmdbAvailable: result.tmdbAvailable,
      fromExpiredCache: result.fromExpiredCache || false
    });
  } catch (err) {
    console.error('Error parsing RSS feed:', err);
    res.status(500).json({ 
      error: 'Error parsing RSS feed',
      details: err.message
    });
  }
}
