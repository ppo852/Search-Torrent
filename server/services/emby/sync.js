import { embyFetch, getEmbyCredentials, isEmbyConfigured } from './client.js';
import { getSetting, saveSetting } from '../settings/index.js';
import { normalizeTitleForDb } from '../media-inventory/utils.js';
import {
  countEmbyItems,
  deleteMissingEmbyItems,
  ensureEmbySchema,
  upsertEmbyItems,
} from './store.js';
import logger from '../core/logger.js';
import {
  INVENTORY_JOB_EMBY_SYNC,
  releaseInventoryJob,
  tryAcquireInventoryJob,
} from '../core/inventory-job-lock.js';

const PAGE_SIZE = 500;

let syncJob = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastResult: null,
  lastError: null,
};

export function getSyncJobStatus() {
  return { ...syncJob };
}

function parseTmdbId(providerIds) {
  if (!providerIds || typeof providerIds !== 'object') return null;
  const raw =
    providerIds.Tmdb ??
    providerIds.tmdb ??
    providerIds.TMDB ??
    null;
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d]/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function mapMovieItem(item, libraryId) {
  const title = String(item?.Name || item?.OriginalTitle || '').trim();
  if (!title || !item?.Id) return null;
  const year = Number(item?.ProductionYear);
  return {
    emby_item_id: String(item.Id),
    library_id: libraryId,
    media_kind: 'movie',
    title,
    title_normalized: normalizeTitleForDb(title),
    year: Number.isInteger(year) && year > 0 ? year : null,
    season: null,
    episode: null,
    tmdb_id: parseTmdbId(item.ProviderIds),
  };
}

function mapEpisodeItem(item, libraryId, seriesTmdbById) {
  const title = String(item?.SeriesName || item?.Name || '').trim();
  if (!title || !item?.Id) return null;
  const season = Number(item?.ParentIndexNumber);
  const episode = Number(item?.IndexNumber);
  const year = Number(item?.ProductionYear);
  const seriesId = item?.SeriesId != null ? String(item.SeriesId) : null;
  const fromSeries = seriesId && seriesTmdbById ? seriesTmdbById.get(seriesId) : null;
  const fromEpisode = parseTmdbId(item.ProviderIds);
  return {
    emby_item_id: String(item.Id),
    library_id: libraryId,
    media_kind: 'tv',
    title,
    title_normalized: normalizeTitleForDb(title),
    year: Number.isInteger(year) && year > 0 ? year : null,
    season: Number.isInteger(season) && season > 0 ? season : null,
    episode: Number.isInteger(episode) && episode > 0 ? episode : null,
    // Priorité id série (ProviderIds épisode = souvent vide / id épisode)
    tmdb_id: fromSeries || fromEpisode,
  };
}

/** Map SeriesId Emby → tmdb_id (ProviderIds de l’item Series). */
async function buildSeriesTmdbMap(libraryId) {
  const series = await fetchAllItems({
    libraryId,
    includeItemTypes: 'Series',
    fields: 'ProviderIds',
  });
  const map = new Map();
  for (const item of series) {
    if (!item?.Id) continue;
    const tmdb = parseTmdbId(item.ProviderIds);
    if (tmdb) map.set(String(item.Id), tmdb);
  }
  return map;
}

async function fetchAllItems({ libraryId, includeItemTypes, fields }) {
  const results = [];
  let startIndex = 0;
  let total = Infinity;

  while (startIndex < total) {
    const params = new URLSearchParams({
      ParentId: libraryId,
      Recursive: 'true',
      IncludeItemTypes: includeItemTypes,
      Fields: fields,
      StartIndex: String(startIndex),
      Limit: String(PAGE_SIZE),
      EnableTotalRecordCount: 'true',
    });

    const data = await embyFetch(`/Items?${params.toString()}`);
    const items = Array.isArray(data?.Items) ? data.Items : [];
    total = Number.isFinite(Number(data?.TotalRecordCount))
      ? Number(data.TotalRecordCount)
      : startIndex + items.length;

    results.push(...items);
    if (items.length === 0) break;
    startIndex += items.length;
    if (items.length < PAGE_SIZE) break;
  }

  return results;
}

async function runSyncInternal() {
  await ensureEmbySchema();

  const { url, apiKey } = await getEmbyCredentials();
  if (!isEmbyConfigured(url, apiKey)) {
    const err = new Error('Emby non configuré');
    err.status = 400;
    throw err;
  }

  const libraryIdsRaw = await getSetting('emby_library_ids');
  const libraryIds = Array.isArray(libraryIdsRaw)
    ? libraryIdsRaw.map(String).filter(Boolean)
    : [];

  if (libraryIds.length === 0) {
    const err = new Error('Aucune bibliothèque Emby sélectionnée');
    err.status = 400;
    throw err;
  }

  const mapped = [];
  let moviesCount = 0;
  let episodesCount = 0;

  for (const libraryId of libraryIds) {
    logger.info(`[emby] Sync lib ${libraryId} — films`);
    const movies = await fetchAllItems({
      libraryId,
      includeItemTypes: 'Movie',
      fields: 'ProviderIds,ProductionYear,OriginalTitle',
    });
    for (const item of movies) {
      const row = mapMovieItem(item, libraryId);
      if (row) {
        mapped.push(row);
        moviesCount += 1;
      }
    }

    logger.info(`[emby] Sync lib ${libraryId} — séries (TMDB)`);
    const seriesTmdbById = await buildSeriesTmdbMap(libraryId);
    logger.info(`[emby] Sync lib ${libraryId} — ${seriesTmdbById.size} série(s) avec TMDB`);

    logger.info(`[emby] Sync lib ${libraryId} — épisodes`);
    const episodes = await fetchAllItems({
      libraryId,
      includeItemTypes: 'Episode',
      fields: 'ProviderIds,ProductionYear,SeriesName,SeriesId,ParentIndexNumber,IndexNumber',
    });
    for (const item of episodes) {
      const row = mapEpisodeItem(item, libraryId, seriesTmdbById);
      if (row) {
        mapped.push(row);
        episodesCount += 1;
      }
    }
  }

  // Écriture sérialisée (withDbExclusive, sans BEGIN Emby)
  await upsertEmbyItems(mapped);

  // Ne jamais purger si le sync a renvoyé 0 item (évite de vider la table sur API vide / erreur partielle)
  let deleted = 0;
  if (mapped.length > 0) {
    const keepIds = mapped.map((r) => r.emby_item_id);
    deleted = await deleteMissingEmbyItems(keepIds, { allowEmptyPurge: false });
  }
  const itemCount = await countEmbyItems();

  return {
    libraries: libraryIds.length,
    movies: moviesCount,
    episodes: episodesCount,
    upserted: mapped.length,
    deleted,
    itemCount,
  };
}

function markRunningOrThrow() {
  tryAcquireInventoryJob(INVENTORY_JOB_EMBY_SYNC);
  syncJob = {
    running: true,
    startedAt: Date.now(),
    finishedAt: null,
    lastResult: null,
    lastError: null,
  };
}

async function persistSyncMeta() {
  try {
    const at = syncJob.finishedAt
      ? new Date(syncJob.finishedAt).toISOString()
      : new Date().toISOString();
    await saveSetting('emby_last_sync_at', at);
    await saveSetting('emby_last_sync_error', syncJob.lastError || null);
    if (syncJob.lastResult != null) {
      await saveSetting('emby_last_sync_result', syncJob.lastResult);
    }
  } catch (err) {
    logger.error('[emby] Impossible de persister le meta sync:', err);
  }
}

function finishSyncJob() {
  syncJob.running = false;
  syncJob.finishedAt = Date.now();
  releaseInventoryJob(INVENTORY_JOB_EMBY_SYNC);
  void persistSyncMeta();
}

/**
 * Sync synchrone (scheduler). Refuse si un job tourne déjà.
 */
export async function syncNow() {
  markRunningOrThrow();
  try {
    const result = await runSyncInternal();
    syncJob.lastResult = result;
    syncJob.lastError = null;
    return result;
  } catch (err) {
    syncJob.lastError = err instanceof Error ? err.message : 'Erreur sync Emby';
    throw err;
  } finally {
    finishSyncJob();
  }
}

/**
 * Lance un sync async (bouton admin). Même verrou que syncNow.
 */
export function startSyncJob() {
  markRunningOrThrow();

  (async () => {
    try {
      const result = await runSyncInternal();
      syncJob.lastResult = result;
      syncJob.lastError = null;
      logger.info('[emby] Sync Emby terminé', result);
    } catch (err) {
      syncJob.lastError = err instanceof Error ? err.message : 'Erreur sync Emby';
      logger.error('[emby] Sync Emby échoué:', err);
    } finally {
      finishSyncJob();
    }
  })();

  return { ...syncJob };
}
