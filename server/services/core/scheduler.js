/**
 * Service de planification des tâches périodiques
 * Ce module centralise la gestion de toutes les tâches planifiées de l'application
 */

import cacheService from './cache.js';
import rssService from '../rss/index.js';

/**
 * Initialise toutes les tâches planifiées au démarrage du serveur
 * - Nettoyage des caches (quotidien à 3h du matin)
 * - Rafraîchissement périodique des flux RSS (toutes les 30 minutes)
 * - Premier rafraîchissement des flux RSS (après 5 minutes)
 */
export function initializeScheduledTasks() {
  console.log('Initialisation des tâches planifiées...');
  
  // Lancer la programmation du nettoyage des caches
  cacheService.scheduleCacheCleanup();
  
  // Programmer le rafraîchissement périodique des flux RSS toutes les 30 minutes
  schedulePeriodicRssRefresh();
  
  // Démarrer un premier rafraîchissement des flux RSS avec un délai
  scheduleInitialRssRefresh();
  
  console.log('Tâches planifiées initialisées avec succès');
}

/**
 * Programme le rafraîchissement périodique des flux RSS
 * @param {number} intervalMinutes - Intervalle en minutes (par défaut 30)
 */
function schedulePeriodicRssRefresh(intervalMinutes = 30) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`Programmation du rafraîchissement des flux RSS toutes les ${intervalMinutes} minutes`);
  
  setInterval(() => {
    rssService.refreshPopularRSSFeeds()
      .then(() => console.log('Rafraîchissement périodique des flux RSS terminé'))
      .catch(err => console.error('Erreur lors du rafraîchissement périodique des flux RSS:', err));
  }, intervalMs);
}

/**
 * Programme un premier rafraîchissement des flux RSS après un délai
 * @param {number} delayMinutes - Délai en minutes (par défaut 5)
 */
function scheduleInitialRssRefresh(delayMinutes = 5) {
  const delayMs = delayMinutes * 60 * 1000;
  
  console.log(`Premier rafraîchissement des flux RSS programmé dans ${delayMinutes} minutes`);
  
  setTimeout(() => {
    rssService.refreshPopularRSSFeeds()
      .then(() => console.log('Premier rafraîchissement des flux RSS terminé'))
      .catch(err => console.error('Erreur lors du premier rafraîchissement des flux RSS:', err));
  }, delayMs);
}

export default {
  initializeScheduledTasks,
  schedulePeriodicRssRefresh,
  scheduleInitialRssRefresh
};
