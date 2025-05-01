import { randomUUID } from 'crypto';
import cacheService from '../../services/core/cache.js';

/**
 * Récupère tous les flux RSS globaux
 */
export async function getAllFeeds(req, res) {
  const db = req.app.locals.db;
  
  try {
    db.all('SELECT * FROM global_rss_feeds ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des flux RSS:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS' });
      }
      
      return res.json(rows || []);
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des flux RSS:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS' });
  }
}

/**
 * Ajoute un nouveau flux RSS global
 */
export async function addFeed(req, res) {
  const db = req.app.locals.db;
  
  // Vérifier que l'utilisateur est admin
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  const { feed_name, feed_url } = req.body;
  
  // Validation des données
  if (!feed_name || !feed_url) {
    return res.status(400).json({ error: 'Le nom et \'URL du flux sont requis' });
  }
  
  try {
    // Vérifier si le flux existe déjà
    db.get('SELECT * FROM global_rss_feeds WHERE feed_url = ?', [feed_url], (err, row) => {
      if (err) {
        console.error('Erreur lors de la vérification du flux RSS:', err);
        return res.status(500).json({ error: 'Erreur lors de \'ajout du flux RSS' });
      }
      
      if (row) {
        return res.status(409).json({ error: 'Ce flux RSS existe déjà' });
      }
      
      // Créer un nouveau flux RSS
      const id = randomUUID();
      const created_at = new Date().toISOString();
      
      db.run(
        'INSERT INTO global_rss_feeds (id, feed_name, feed_url, created_at) VALUES (?, ?, ?, ?)',
        [id, feed_name, feed_url, created_at],
        (err) => {
          if (err) {
            console.error('Erreur lors de \'insertion en base de données:', err);
            return res.status(500).json({ error: 'Erreur lors de \'ajout du flux RSS' });
          }
          
          return res.status(201).json({ id, feed_name, feed_url, created_at });
        }
      );
    });
  } catch (error) {
    console.error('Erreur lors de \'ajout du flux RSS:', error);
    return res.status(500).json({ error: 'Erreur lors de \'ajout du flux RSS' });
  }
}

/**
 * Supprime un flux RSS global
 */
export async function deleteFeed(req, res) {
  const db = req.app.locals.db;
  
  // Vérifier que l'utilisateur est admin
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: 'L\'ID du flux est requis' });
  }
  
  try {
    // Vérifier si le flux existe
    db.get('SELECT * FROM global_rss_feeds WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Erreur lors de la vérification du flux RSS:', err);
        return res.status(500).json({ error: 'Erreur lors de la suppression du flux RSS' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Flux RSS non trouvé' });
      }
      
      // Supprimer le flux
      db.run('DELETE FROM global_rss_feeds WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Erreur lors de la suppression du flux RSS:', err);
          return res.status(500).json({ error: 'Erreur lors de la suppression du flux RSS' });
        }
        
        // Supprimer également les éléments en cache associés à ce flux
        db.run('DELETE FROM rss_items_cache WHERE feed_id = ?', [id], (err) => {
          if (err) {
            console.error('Erreur lors de la suppression des éléments en cache:', err);
            // Ne pas échouer si la suppression du cache échoue
          }
          
          return res.json({ success: true, message: 'Flux RSS supprimé avec succès' });
        });
      });
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du flux RSS:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression du flux RSS' });
  }
}

/**
 * Récupère tous les flux RSS avec leurs informations de cache
 */
export async function getAllFeedsWithCache(req, res) {
  const db = req.app.locals.db;
  
  try {
    // Vérifier que l'utilisateur est admin
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    // Récupérer tous les flux RSS
    db.all('SELECT * FROM global_rss_feeds ORDER BY created_at DESC', async (err, feeds) => {
      if (err) {
        console.error('Erreur lors de la récupération des flux RSS:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS' });
      }
      
      if (!feeds || feeds.length === 0) {
        return res.json([]);
      }
      
      try {
        // Récupérer les informations de cache pour chaque flux
        const feedsWithCache = [];
        
        for (const feed of feeds) {
          // Vérifier si le flux a des données en cache
          db.get('SELECT * FROM rss_items_cache WHERE feed_id = ?', [feed.id], (err, cacheEntry) => {
            const now = new Date().toISOString();
            
            if (cacheEntry) {
              // Ajouter les informations de cache au flux
              feed.cache = {
                lastUpdated: cacheEntry.created_at,
                expiresAt: cacheEntry.expires_at,
                isFresh: cacheEntry.expires_at > now
              };
            } else {
              feed.cache = null;
            }
            
            feedsWithCache.push(feed);
            
            // Quand tous les flux ont été traités, renvoyer le résultat
            if (feedsWithCache.length === feeds.length) {
              return res.json(feedsWithCache);
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des informations de cache:', error);
        // En cas d'erreur avec le cache, renvoyer quand même les flux sans info de cache
        return res.json(feeds);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des flux RSS avec cache:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS avec cache' });
  }
}