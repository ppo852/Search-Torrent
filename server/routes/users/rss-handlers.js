// Handlers pour les routes RSS des utilisateurs
import { randomUUID } from 'crypto';
import { get, run, query } from '../../services/core/db.js';

/**
 * Récupère les flux RSS d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} Liste des flux RSS de l'utilisateur
 */
export async function getRssFeedsForUser(userId) {
  try {
    const feeds = await query(
      'SELECT * FROM user_rss_feeds WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return feeds;
  } catch (err) {
    console.error('Erreur lors de la récupération des flux RSS utilisateur:', err);
    throw err;
  }
}

/**
 * Ajoute un flux RSS pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} feedName - Nom du flux RSS
 * @param {string} feedUrl - URL du flux RSS
 * @returns {Promise<Object>} Détails du flux RSS ajouté
 */
export async function addRssFeedForUser(userId, feedName, feedUrl) {
  try {
    // Vérifier que l'utilisateur existe
    const user = await get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Vérifier que le flux fonctionne
    const testResponse = await fetch(feedUrl);
    if (!testResponse.ok) {
      throw new Error('URL de flux RSS invalide');
    }

    const feed = {
      id: randomUUID(),
      user_id: userId,
      feed_name: feedName,
      feed_url: feedUrl,
      created_at: new Date().toISOString()
    };

    await run(
      'INSERT INTO user_rss_feeds (id, user_id, feed_name, feed_url, created_at) VALUES (?, ?, ?, ?, ?)',
      [feed.id, feed.user_id, feed.feed_name, feed.feed_url, feed.created_at]
    );

    console.log('Flux RSS ajouté avec succès:', feed);
    return feed;
  } catch (err) {
    console.error('Erreur lors de l\'ajout du flux RSS:', err);
    throw err;
  }
}

/**
 * Supprime un flux RSS d'un utilisateur
 * @param {string} feedId - ID du flux RSS à supprimer
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<boolean>} True si suppression réussie
 */
export async function deleteRssFeedForUser(feedId, userId) {
  try {
    const result = await run(
      'DELETE FROM user_rss_feeds WHERE id = ? AND user_id = ?',
      [feedId, userId]
    );
    
    if (result && result.changes > 0) {
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erreur lors de la suppression du flux RSS:', err);
    throw err;
  }
}

export default {
  getRssFeedsForUser,
  addRssFeedForUser,
  deleteRssFeedForUser
};
