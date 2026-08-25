import {
  getEmbyCredentials,
  isEmbyConfigured,
  listLibraries,
  testConnection,
} from './client.js';
import { getSetting } from '../settings/index.js';
import { countEmbyItems, ensureEmbySchema, getLatestEmbyUpdatedAt } from './store.js';
import { getSyncJobStatus, startSyncJob, syncNow } from './sync.js';

export {
  getEmbyCredentials,
  isEmbyConfigured,
  listLibraries,
  testConnection,
  syncNow,
  startSyncJob,
  getSyncJobStatus,
};

export async function getEmbyStatus() {
  await ensureEmbySchema();
  const { url, apiKey } = await getEmbyCredentials();
  const configured = isEmbyConfigured(url, apiKey);
  const libraryIdsRaw = await getSetting('emby_library_ids');
  const libraryIds = Array.isArray(libraryIdsRaw)
    ? libraryIdsRaw.map(String)
    : [];
  const syncInterval = Number(await getSetting('emby_sync_interval_minutes')) || 60;
  const job = getSyncJobStatus();
  let itemCount = 0;
  try {
    itemCount = await countEmbyItems();
  } catch {
    itemCount = 0;
  }

  // Mémoire (process courant) → setting persisté → MAX(updated_at) inventaire
  let lastSyncAt = job.finishedAt ? new Date(job.finishedAt).toISOString() : null;
  if (!lastSyncAt) {
    const persisted = await getSetting('emby_last_sync_at');
    if (persisted) lastSyncAt = String(persisted);
  }
  if (!lastSyncAt) {
    try {
      lastSyncAt = await getLatestEmbyUpdatedAt();
    } catch {
      lastSyncAt = null;
    }
  }

  const useMemoryMeta = Boolean(job.finishedAt) || Boolean(job.running);
  let lastSyncError = useMemoryMeta ? job.lastError : null;
  let lastResult = useMemoryMeta ? job.lastResult : null;
  if (!useMemoryMeta) {
    lastSyncError = (await getSetting('emby_last_sync_error')) || null;
    lastResult = (await getSetting('emby_last_sync_result')) || null;
  }

  return {
    configured,
    url: configured ? url : null,
    libraryIds,
    syncIntervalMinutes: syncInterval,
    lastSyncAt,
    lastSyncError,
    lastResult,
    itemCount,
    syncRunning: Boolean(job.running),
    startedAt: job.startedAt,
  };
}

export default {
  getEmbyCredentials,
  isEmbyConfigured,
  listLibraries,
  testConnection,
  syncNow,
  startSyncJob,
  getSyncJobStatus,
  getEmbyStatus,
};
