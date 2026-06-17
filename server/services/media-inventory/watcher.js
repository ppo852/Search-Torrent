import chokidar from 'chokidar';
import mediaInventoryService from './index.js';
import { updateDownloadingEpisodesStatus } from './episode-status.js';
import userService from '../users/index.js';

let watcher = null;
let debounceTimer = null;
let flushIsRunning = false;
const pendingAdds = new Set();
const pendingUnlinks = new Set();

function isDebug() {
  const v = String(process.env.DEBUG_MEDIA_WATCHER || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isEnabled() {
  const v = String(process.env.MEDIA_WATCHER_ENABLED || '').toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

function getDebounceMs() {
  const n = Number(process.env.MEDIA_WATCHER_DEBOUNCE_MS);
  return Number.isFinite(n) && n >= 0 ? n : 15000;
}

function getUsePolling() {
  const v = String(process.env.MEDIA_WATCHER_USE_POLLING || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function getPollIntervalMs() {
  const n = Number(process.env.MEDIA_WATCHER_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

function isVideoFilePath(p) {
  const s = String(p || '').toLowerCase();
  return (
    s.endsWith('.mkv') ||
    s.endsWith('.mp4') ||
    s.endsWith('.avi') ||
    s.endsWith('.mov') ||
    s.endsWith('.m4v') ||
    s.endsWith('.wmv')
  );
}

async function flushPendingChanges() {
  if (flushIsRunning) return;
  flushIsRunning = true;

  const unlinks = Array.from(pendingUnlinks);
  const adds = Array.from(pendingAdds);
  pendingUnlinks.clear();
  pendingAdds.clear();

  try {
    for (const filePath of unlinks) {
      try {
        await mediaInventoryService.removeFile(filePath);
        if (isDebug()) {
          console.log('[MediaWatcher] Fichier retiré de l\'inventaire', { file: filePath });
        }
      } catch (err) {
        console.error(`[MediaWatcher] Erreur suppression inventaire ${filePath}:`, err);
      }
    }

    for (const filePath of adds) {
      try {
        const record = await mediaInventoryService.ingestFile(filePath);
        if (isDebug()) {
          console.log('[MediaWatcher] Fichier ajouté à l\'inventaire', {
            file: filePath,
            title: record?.title || null,
          });
        }
      } catch (err) {
        console.error(`[MediaWatcher] Erreur ingestion ${filePath}:`, err);
      }
    }

    if (unlinks.length > 0 || adds.length > 0) {
      await updateDownloadingEpisodesStatus();
    }
  } catch (err) {
    console.error('[MediaWatcher] Erreur traitement incrémental:', err);
  } finally {
    flushIsRunning = false;
  }
}

function scheduleIncrementalChange(reason, filePath) {
  if (reason === 'add') {
    pendingUnlinks.delete(filePath);
    pendingAdds.add(filePath);
  } else if (reason === 'unlink') {
    pendingAdds.delete(filePath);
    pendingUnlinks.add(filePath);
  }

  const debounceMs = getDebounceMs();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    if (isDebug()) {
      console.log('[MediaWatcher] Traitement incrémental', {
        adds: pendingAdds.size,
        unlinks: pendingUnlinks.size,
        file: filePath || null,
      });
    }
    await flushPendingChanges();
  }, debounceMs);
}

export async function startMediaWatcher() {
  if (!isEnabled()) {
    if (isDebug()) {
      console.log('[MediaWatcher] Désactivé (MEDIA_WATCHER_ENABLED)');
    }
    return;
  }

  if (watcher) return;

  const pathsToWatch = new Set();

  const addPaths = (val) => {
    if (typeof val === 'string' && val.trim().length > 0) {
      val.split(':').map((p) => p.trim()).filter(Boolean).forEach((p) => pathsToWatch.add(p));
    }
  };

  try {
    const users = await userService.getAllUsers();
    for (const u of users) {
      addPaths(u.download_path_movies);
      addPaths(u.download_path_series);
      addPaths(u.download_path_anime);
    }
  } catch (err) {
    console.error('[MediaWatcher] Failed to fetch user paths:', err);
  }

  const watchPaths = Array.from(pathsToWatch);

  if (watchPaths.length === 0) {
    if (isDebug()) {
      console.log('[MediaWatcher] Aucun chemin à surveiller');
    }
    return;
  }

  const usePolling = getUsePolling();
  const pollInterval = getPollIntervalMs();

  watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 30000,
      pollInterval,
    },
    usePolling,
    interval: pollInterval,
    binaryInterval: pollInterval,
  });

  watcher.on('add', (p) => {
    if (!isVideoFilePath(p)) return;
    scheduleIncrementalChange('add', p);
  });

  watcher.on('unlink', (p) => {
    if (!isVideoFilePath(p)) return;
    scheduleIncrementalChange('unlink', p);
  });

  watcher.on('error', (err) => {
    console.error('[MediaWatcher] Erreur watcher:', err);
  });

  if (isDebug()) {
    console.log('[MediaWatcher] Actif (incrémental)', { paths: watchPaths, usePolling, pollInterval, debounceMs: getDebounceMs() });
  }
}

export async function stopMediaWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingAdds.clear();
  pendingUnlinks.clear();
  if (watcher) {
    try {
      await watcher.close();
    } catch {
      // ignore
    }
    watcher = null;
  }
}

export default {
  startMediaWatcher,
  stopMediaWatcher,
};
