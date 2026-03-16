import chokidar from 'chokidar';
import mediaInventoryService from './index.js';
import { getSetting } from '../settings/index.js';
import { updateDownloadingEpisodesStatus } from './episode-status.js';

let watcher = null;
let debounceTimer = null;
let scanIsRunning = false;

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

async function runScanNow() {
  if (scanIsRunning) return;
  scanIsRunning = true;
  try {
    const moviesPath = await getSetting('media_movies_path');
    const seriesPath = await getSetting('media_series_path');

    await mediaInventoryService.scanNow({
      moviesPath: typeof moviesPath === 'string' ? moviesPath : '/media/Films',
      seriesPath: typeof seriesPath === 'string' ? seriesPath : '/media/series'
    });

    await updateDownloadingEpisodesStatus();
  } catch (err) {
    console.error('[MediaWatcher] Erreur scan déclenché:', err);
  } finally {
    scanIsRunning = false;
  }
}

function scheduleScan(reason, filePath) {
  const debounceMs = getDebounceMs();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    if (isDebug()) {
      console.log('[MediaWatcher] Changement détecté, scan déclenché', { reason, file: filePath || null });
    }
    await runScanNow();
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

  const moviesPath = await getSetting('media_movies_path');
  const seriesPath = await getSetting('media_series_path');
  const watchPaths = [moviesPath, seriesPath]
    .filter((v) => typeof v === 'string' && v.trim().length > 0);

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
      pollInterval
    },
    usePolling,
    interval: pollInterval,
    binaryInterval: pollInterval
  });

  watcher.on('add', (p) => {
    if (!isVideoFilePath(p)) return;
    scheduleScan('add', p);
  });

  watcher.on('unlink', (p) => {
    if (!isVideoFilePath(p)) return;
    scheduleScan('unlink', p);
  });

  watcher.on('error', (err) => {
    console.error('[MediaWatcher] Erreur watcher:', err);
  });

  if (isDebug()) {
    console.log('[MediaWatcher] Actif', { paths: watchPaths, usePolling, pollInterval, debounceMs: getDebounceMs() });
  }
}

export async function stopMediaWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
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
  stopMediaWatcher
};
