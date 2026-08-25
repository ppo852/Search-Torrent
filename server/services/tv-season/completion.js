import { query } from '../core/db.js';
import mediaInventoryService from '../media-inventory/index.js';
import logger from '../core/logger.js';
import {
  getSeasonTotalEpisodeCount,
  getTvShowInventoryMeta,
  isSeasonStillAiring,
  boostExpectedFromNextEpisode,
} from '../tmdb/episodes.js';
import { markTvSeasonRequestCompleted } from './downloads.js';

/**
 * Marque la saison completed si tous les épisodes prévus TMDB sont présents
 * (disque ∪ Emby), qu'aucun épisode n'est en downloading, et que la saison
 * n'est plus en diffusion (pas de next_episode_to_air sur cette saison).
 *
 * @param {{ id: string, user_id?: string, tmdb_id: number, title: string, season_number: number }} season
 * @param {string} [completedAt]
 * @returns {Promise<boolean>}
 */
export async function tryMarkTvSeasonCompleted(season, completedAt) {
  const now = completedAt ?? new Date().toISOString();

  const downloading = await query(
    `SELECT 1 FROM tv_episode_downloads
     WHERE tv_season_request_id = ? AND status = 'downloading'
     LIMIT 1`,
    [season.id]
  );
  if ((downloading || []).length > 0) return false;

  let showMeta = null;
  try {
    showMeta = await getTvShowInventoryMeta(season.tmdb_id);
  } catch (err) {
    logger.debug('inventory', `TMDB indisponible pour complétion saison ${season.id}:`, err);
    return false;
  }

  const stillAiring = isSeasonStillAiring(showMeta, season.season_number);
  if (stillAiring) return false;

  let expectedCount = 0;
  try {
    expectedCount = await getSeasonTotalEpisodeCount({
      tmdbId: season.tmdb_id,
      seasonNumber: season.season_number,
    });
  } catch (err) {
    logger.debug('inventory', `TMDB saison indisponible pour complétion ${season.id}:`, err);
    return false;
  }

  expectedCount = boostExpectedFromNextEpisode(
    showMeta,
    season.season_number,
    expectedCount
  );

  if (expectedCount <= 0) return false;

  const presentEpisodes = await mediaInventoryService.getSeasonPresence({
    tmdb_id: season.tmdb_id,
    title: season.title,
    season: season.season_number,
  });
  const presentCount = (presentEpisodes || []).length;

  if (presentCount < expectedCount) return false;

  await markTvSeasonRequestCompleted({
    requestId: season.id,
    userId: season.user_id,
    completedAt: now,
  });

  logger.debug(
    'inventory',
    `Saison complétée: "${season.title}" S${season.season_number} (${presentCount}/${expectedCount} épisode(s))`
  );
  return true;
}

/**
 * @param {string[]} requestIds
 * @param {string} [completedAt]
 * @returns {Promise<number>}
 */
export async function tryMarkCompletedTvSeasons(requestIds, completedAt) {
  if (!requestIds?.length) return 0;

  const placeholders = requestIds.map(() => '?').join(', ');
  const seasons = await query(
    `SELECT id, user_id, tmdb_id, title, season_number
     FROM tv_season_requests
     WHERE status != 'completed' AND id IN (${placeholders})`,
    requestIds
  );

  let marked = 0;
  for (const season of seasons || []) {
    // eslint-disable-next-line no-await-in-loop
    const done = await tryMarkTvSeasonCompleted(season, completedAt);
    if (done) marked++;
  }
  return marked;
}
