/**
 * Service de planification des tâches périodiques
 * Ce module centralise la gestion de toutes les tâches planifiées de l'application
 */

import cacheService from './cache.js';
import rssService from '../rss/index.js';
import autoSearchService from '../auto-search/index.js';
import mediaInventoryService from '../media-inventory/index.js';
import { updateDownloadingEpisodesStatus } from '../media-inventory/episode-status.js';
import mediaWatcherService from '../media-inventory/watcher.js';
import { getSetting } from '../settings/index.js';

let autoSearchTimeoutId = null;
let autoSearchIsRunning = false;

let mediaScanTimeoutId = null;
let mediaScanIsRunning = false;

async function refreshPopularFeedsSafe() {
  try {
    await rssService.refreshPopularRSSFeeds();
  } catch (err) {
    console.error('Erreur lors du rafraîchissement des flux RSS:', err);
  }
}

/**
 * Initialise toutes les tâches planifiées au démarrage du serveur
 * - Nettoyage des caches (quotidien à 3h du matin)
 * - Rafraîchissement périodique des flux RSS (toutes les 30 minutes)
 * - Premier rafraîchissement des flux RSS (après 5 minutes)
 */
export function initializeScheduledTasks() {
  // Lancer la programmation du nettoyage des caches
  cacheService.scheduleCacheCleanup();
  
  // Programmer le rafraîchissement périodique des flux RSS toutes les 30 minutes
  schedulePeriodicRssRefresh();
  
  // Démarrer un premier rafraîchissement des flux RSS avec un délai
  scheduleInitialRssRefresh();

  // Démarrer la recherche automatique (première exécution rapide + intervalle configurable)
  scheduleAutoSearch();

  scheduleMediaInventoryScan();

  // Watch for filesystem changes to trigger scans sooner (Linux prod)
  mediaWatcherService.startMediaWatcher().catch((err) => {
    console.error('[MediaWatcher] Failed to start:', err);
  });
}

export function scheduleMediaInventoryScan(initialDelayMinutes = 2) {
  const delayMs = initialDelayMinutes * 60 * 1000;

  if (mediaScanTimeoutId) {
    clearTimeout(mediaScanTimeoutId);
    mediaScanTimeoutId = null;
  }

  const scheduleNext = async () => {
    try {
      const intervalSetting = await getSetting('media_scan_interval_minutes');
      const intervalMinutes = typeof intervalSetting === 'number' && intervalSetting > 0 ? intervalSetting : 30;
      const intervalMs = intervalMinutes * 60 * 1000;

      mediaScanTimeoutId = setTimeout(async () => {
        if (mediaScanIsRunning) {
          await scheduleNext();
          return;
        }

        mediaScanIsRunning = true;
        try {
          const moviesPath = await getSetting('media_movies_path');
          const seriesPath = await getSetting('media_series_path');

          await mediaInventoryService.scanNow({
            moviesPath: typeof moviesPath === 'string' ? moviesPath : '/media/Films',
            seriesPath: typeof seriesPath === 'string' ? seriesPath : '/media/series'
          });

          // Update downloading episodes status after scan
          await updateDownloadingEpisodesStatus();
        } catch (err) {
          console.error('Erreur lors du scan media inventory (périodique):', err);
        } finally {
          mediaScanIsRunning = false;
        }

        await scheduleNext();
      }, intervalMs);
    } catch (err) {
      console.error('Erreur lors de la configuration de l\'intervalle de scan media:', err);
      mediaScanTimeoutId = setTimeout(() => {
        scheduleNext().catch(() => {
          // ignore
        });
      }, 30 * 60 * 1000);
    }
  };

  setTimeout(async () => {
    try {
      const moviesPath = await getSetting('media_movies_path');
      const seriesPath = await getSetting('media_series_path');

      await mediaInventoryService.scanNow({
        moviesPath: typeof moviesPath === 'string' ? moviesPath : '/media/Films',
        seriesPath: typeof seriesPath === 'string' ? seriesPath : '/media/series'
      });

      // Update downloading episodes status after initial scan
      await updateDownloadingEpisodesStatus();
    } catch (err) {
      console.error('Erreur lors du scan media inventory (initial):', err);
    }

    await scheduleNext();
  }, delayMs);
}

/**
 * Programme la recherche automatique
 * - Première exécution rapide (par défaut 1 min après le démarrage)
 * - Puis exécution périodique selon auto_search_interval_minutes (défaut 60)
 */
export function scheduleAutoSearch(initialDelayMinutes = 1) {
  const delayMs = initialDelayMinutes * 60 * 1000;

  if (autoSearchTimeoutId) {
    clearTimeout(autoSearchTimeoutId);
    autoSearchTimeoutId = null;
    console.log('[Scheduler] Auto-search précédent annulé, reprogrammation...');
  }

  const scheduleNext = async () => {
    try {
      const intervalSetting = await getSetting('auto_search_interval_minutes');
      const intervalMinutes = typeof intervalSetting === 'number' && intervalSetting > 0 ? intervalSetting : 60;
      const intervalMs = intervalMinutes * 60 * 1000;

      console.log(`[Scheduler] Prochaine recherche auto dans ${intervalMinutes} minute(s)`);

      autoSearchTimeoutId = setTimeout(async () => {
        if (autoSearchIsRunning) {
          console.log('[Scheduler] Recherche auto déjà en cours, report...');
          await scheduleNext();
          return;
        }

        autoSearchIsRunning = true;
        try {
          await autoSearchService.runAutoSearchOnce();
        } catch (err) {
          console.error('Erreur lors de la recherche auto (périodique):', err);
        } finally {
          autoSearchIsRunning = false;
        }

        await scheduleNext();
      }, intervalMs);
    } catch (err) {
      console.error('Erreur lors de la configuration de l\'intervalle de recherche auto:', err);
      autoSearchTimeoutId = setTimeout(() => {
        scheduleNext().catch(() => {
          // ignore
        });
      }, 60 * 60 * 1000);
    }
  };

  setTimeout(async () => {
    try {
      await autoSearchService.runAutoSearchOnce();
    } catch (err) {
      console.error('Erreur lors de la recherche auto (initiale):', err);
    }

    await scheduleNext();
  }, delayMs);
}

/**
 * Programme le rafraîchissement périodique des flux RSS
 * @param {number} intervalMinutes - Intervalle en minutes (par défaut 30)
 */
function schedulePeriodicRssRefresh(intervalMinutes = 30) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  setInterval(() => {
    refreshPopularFeedsSafe().catch(() => {
      // ignore
    });
  }, intervalMs);
}

/**
 * Programme un premier rafraîchissement des flux RSS après un délai
 * @param {number} delayMinutes - Délai en minutes (par défaut 5)
 */
function scheduleInitialRssRefresh(delayMinutes = 5) {
  const delayMs = delayMinutes * 60 * 1000;
  
  setTimeout(() => {
    refreshPopularFeedsSafe().catch(() => {
      // ignore
    });
  }, delayMs);
}

export default {
  initializeScheduledTasks,
  schedulePeriodicRssRefresh,
  scheduleInitialRssRefresh,
  scheduleAutoSearch,
  scheduleMediaInventoryScan
};
