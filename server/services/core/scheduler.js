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
import embyService from '../emby/index.js';
import { getSetting } from '../settings/index.js';
import logger from './logger.js';
import {
  INVENTORY_JOB_DISK_SCAN,
  releaseInventoryJob,
  tryAcquireInventoryJob,
} from './inventory-job-lock.js';

let autoSearchTimeoutId = null;
let autoSearchIsRunning = false;

let mediaScanTimeoutId = null;
let mediaScanIsRunning = false;

let embySyncTimeoutId = null;

let rssRefreshIntervalId = null;
let rssInitialTimeoutId = null;

async function refreshPopularFeedsSafe() {
  try {
    await rssService.refreshPopularRSSFeeds();
  } catch (err) {
    logger.error('Erreur lors du rafraîchissement des flux RSS:', err);
  }
}

/**
 * Initialise toutes les tâches planifiées au démarrage du serveur
 */
export function initializeScheduledTasks() {
  // Lancer la programmation du nettoyage des caches
  cacheService.scheduleCacheCleanup();
  
  // Programmer le rafraîchissement périodique des flux RSS
  schedulePeriodicRssRefresh();
  
  // Démarrer un premier rafraîchissement des flux RSS
  scheduleInitialRssRefresh();

  // Démarrer la recherche automatique
  scheduleAutoSearch();

  // Inventaire disque + Emby : périodique seulement (pas de scan/sync au démarrage)
  scheduleMediaInventoryScan(0, { skipInitial: true });
  scheduleEmbySync();

  // Watch for filesystem changes
  mediaWatcherService.startMediaWatcher().catch((err) => {
    logger.error('[MediaWatcher] Failed to start:', err);
  });
}

/**
 * Arrête toutes les tâches planifiées et le watcher
 */
export async function stopAllTasks() {
  console.log('[Scheduler] Arrêt des tâches planifiées...');
  
  if (autoSearchTimeoutId) clearTimeout(autoSearchTimeoutId);
  if (mediaScanTimeoutId) clearTimeout(mediaScanTimeoutId);
  if (embySyncTimeoutId) clearTimeout(embySyncTimeoutId);
  if (rssRefreshIntervalId) clearInterval(rssRefreshIntervalId);
  if (rssInitialTimeoutId) clearTimeout(rssInitialTimeoutId);
  
  await mediaWatcherService.stopMediaWatcher();
  console.log('[Scheduler] Toutes les tâches ont été arrêtées.');
}

// --- Fin des fonctions de gestion ---


/**
 * Programme le scan inventaire disque.
 * @param {number} initialDelayMinutes
 * @param {{ skipInitial?: boolean }} options — skipInitial=true : pas de scan immédiat (démarrage / replanif)
 */
export function scheduleMediaInventoryScan(initialDelayMinutes = 2, options = {}) {
  const delayMs = Math.max(0, Number(initialDelayMinutes) || 0) * 60 * 1000;
  const skipInitial = Boolean(options.skipInitial);

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

        try {
          tryAcquireInventoryJob(INVENTORY_JOB_DISK_SCAN);
        } catch (lockErr) {
          if (lockErr?.status === 409) {
            logger.info(
              `Scan inventaire reporté : ${lockErr.message}`
            );
            await scheduleNext();
            return;
          }
          throw lockErr;
        }

        mediaScanIsRunning = true;
        try {
          await mediaInventoryService.scanNow();
          await updateDownloadingEpisodesStatus();
        } catch (err) {
          logger.error('Erreur lors du scan media inventory (périodique):', err);
        } finally {
          mediaScanIsRunning = false;
          releaseInventoryJob(INVENTORY_JOB_DISK_SCAN);
        }

        await scheduleNext();
      }, intervalMs);
    } catch (err) {
      logger.error('Erreur lors de la configuration de l\'intervalle de scan media:', err);
      mediaScanTimeoutId = setTimeout(() => {
        scheduleNext().catch(() => {
          // ignore
        });
      }, 30 * 60 * 1000);
    }
  };

  if (skipInitial) {
    scheduleNext().catch(() => {});
    return;
  }

  mediaScanTimeoutId = setTimeout(async () => {
    try {
      tryAcquireInventoryJob(INVENTORY_JOB_DISK_SCAN);
    } catch (lockErr) {
      if (lockErr?.status === 409) {
        logger.info(`Scan inventaire initial reporté : ${lockErr.message}`);
        await scheduleNext();
        return;
      }
      logger.error('Erreur lors du scan media inventory (initial):', lockErr);
      await scheduleNext();
      return;
    }

    try {
      await mediaInventoryService.scanNow();
      await updateDownloadingEpisodesStatus();
    } catch (err) {
      logger.error('Erreur lors du scan media inventory (initial):', err);
    } finally {
      releaseInventoryJob(INVENTORY_JOB_DISK_SCAN);
    }

    await scheduleNext();
  }, delayMs);
}

/**
 * Programme la sync Emby périodique uniquement (jamais de sync immédiat au démarrage / save).
 * @param {number} _initialDelayMinutes — ignoré (compat appels existants)
 * @param {{ skipInitial?: boolean }} _options — ignoré (compat ; toujours périodique only)
 */
export function scheduleEmbySync(_initialDelayMinutes = 3, _options = {}) {
  if (embySyncTimeoutId) {
    clearTimeout(embySyncTimeoutId);
    embySyncTimeoutId = null;
  }

  const scheduleNext = async () => {
    try {
      const intervalSetting = await getSetting('emby_sync_interval_minutes');
      const parsed = Number(intervalSetting);
      const intervalMinutes = Number.isFinite(parsed) && parsed >= 5 ? parsed : 60;
      const intervalMs = intervalMinutes * 60 * 1000;

      embySyncTimeoutId = setTimeout(async () => {
        try {
          if (embyService.getSyncJobStatus().running) {
            await scheduleNext();
            return;
          }
          const { url, apiKey } = await embyService.getEmbyCredentials();
          const libs = await getSetting('emby_library_ids');
          const hasLibs = Array.isArray(libs) && libs.length > 0;
          if (embyService.isEmbyConfigured(url, apiKey) && hasLibs) {
            await embyService.syncNow();
          }
        } catch (err) {
          if (err?.status !== 409) {
            logger.error('Erreur lors du sync Emby (périodique):', err);
          }
        }

        await scheduleNext();
      }, intervalMs);
    } catch (err) {
      logger.error('Erreur lors de la configuration de l\'intervalle sync Emby:', err);
      embySyncTimeoutId = setTimeout(() => {
        scheduleNext().catch(() => {});
      }, 60 * 60 * 1000);
    }
  };

  scheduleNext().catch(() => {});
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
          logger.error('Erreur lors de la recherche auto (périodique):', err);
        } finally {
          autoSearchIsRunning = false;
        }

        await scheduleNext();
      }, intervalMs);
    } catch (err) {
      logger.error('Erreur lors de la configuration de l\'intervalle de recherche auto:', err);
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
      logger.error('Erreur lors de la recherche auto (initiale):', err);
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
  
  rssRefreshIntervalId = setInterval(() => {
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
  
  rssInitialTimeoutId = setTimeout(() => {
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
  scheduleMediaInventoryScan,
  scheduleEmbySync
};
