import { query, run } from '../core/db.js';
import mediaInventoryService from './index.js';
import { getSetting } from '../settings/index.js';
<<<<<<< HEAD
import logger from '../core/logger.js';
import {
  isEpisodeTorrentInQbit,
  loadQbitTorrentsForUser
} from '../tv-season/qbit-tags.js';
import { insertTvSeasonHistory, markTvEpisodeCompleted, markTvEpisodeError } from '../tv-season/downloads.js';

const DEFAULT_STALE_DOWNLOAD_MS = 60 * 60 * 1000;

/**
 * Marque en "error" les épisodes en downloading depuis trop longtemps mais absents de qBittorrent.
 * @param {{ tvSeasonRequestId?: string|null, staleMs?: number }} options
 * @returns {Promise<{ markedError: number, errorEpisodesByRequest: Map<string, Set<number>> }>}
 */
export async function reconcileStaleTvEpisodeDownloads(options = {}) {
  const staleMs = typeof options.staleMs === 'number' && options.staleMs > 0
    ? options.staleMs
    : DEFAULT_STALE_DOWNLOAD_MS;
  const tvSeasonRequestId = options.tvSeasonRequestId ?? null;
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  const errorEpisodesByRequest = new Map();

  let sql = `
    SELECT d.tv_season_request_id, d.episode_number, d.sent_at, d.torrent_name,
           r.user_id, r.tmdb_id, r.media_type, r.title, r.season_number
    FROM tv_episode_downloads d
    JOIN tv_season_requests r ON r.id = d.tv_season_request_id
    WHERE d.status = 'downloading'
  `;
  const params = [];
  if (tvSeasonRequestId) {
    sql += ' AND d.tv_season_request_id = ?';
    params.push(tvSeasonRequestId);
  }

  const rows = await query(sql, params);
  const staleRows = (rows || []).filter((r) => {
    const sentMs = r?.sent_at ? new Date(r.sent_at).getTime() : NaN;
    return Number.isFinite(sentMs) && (nowMs - sentMs) > staleMs;
  });

  if (staleRows.length === 0) {
    return { markedError: 0, errorEpisodesByRequest };
  }

  let markedError = 0;

  const markStaleEpisodeAsError = async (row, torrentLabel) => {
    const requestId = row.tv_season_request_id;
    await markTvEpisodeError({ requestId, episodeNumber: row.episode_number });
    await insertTvSeasonHistory({
      tvSeasonRequestId: requestId,
      userId: row.user_id,
      tmdbId: row.tmdb_id,
      mediaType: row.media_type,
      title: row.title,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      action: 'download_missing_in_qbit',
      torrentName: torrentLabel,
      createdAt: nowIso
    });

    if (!errorEpisodesByRequest.has(requestId)) {
      errorEpisodesByRequest.set(requestId, new Set());
    }
    errorEpisodesByRequest.get(requestId).add(row.episode_number);
    markedError++;
  };

  const staleWithoutName = staleRows.filter((r) => !String(r?.torrent_name || '').trim());
  for (const row of staleWithoutName) {
    // eslint-disable-next-line no-await-in-loop
    await markStaleEpisodeAsError(row, '(nom inconnu)');
  }

  const staleWithName = staleRows.filter((r) => String(r?.torrent_name || '').trim());
  const byUser = new Map();
  for (const row of staleWithName) {
    const list = byUser.get(row.user_id) || [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  if (staleWithName.length === 0) {
    if (markedError > 0) {
      logger.info('inventory', `${markedError} épisode(s) fantôme(s) passé(s) en error (absents de qBit)`);
    }
    return { markedError, errorEpisodesByRequest };
  }

  for (const [userId, userRows] of byUser.entries()) {
    const torrents = await loadQbitTorrentsForUser(userId);
    if (!torrents) continue;

    for (const row of userRows) {
      const exists = isEpisodeTorrentInQbit(torrents, {
        requestId: row.tv_season_request_id,
        episodeNumber: row.episode_number,
        torrentName: row.torrent_name
      });

      if (!exists) {
        // eslint-disable-next-line no-await-in-loop
        await markStaleEpisodeAsError(row, String(row?.torrent_name || '').trim() || '(nom inconnu)');
      }
    }
  }

  if (markedError > 0) {
    logger.info('inventory', `${markedError} épisode(s) fantôme(s) passé(s) en error (absents de qBit)`);
  }

  return { markedError, errorEpisodesByRequest };
}
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

/**
 * Update status of downloading episodes when files are detected in inventory
 */
export async function updateDownloadingEpisodesStatus() {
  try {
<<<<<<< HEAD
    logger.debug('inventory', 'Vérification des épisodes en téléchargement...');
    
    const downloadingEpisodes = await query(
      `SELECT d.tv_season_request_id, d.episode_number, r.title, r.season_number, r.tmdb_id
=======
    const dbg = ['1', 'true', 'yes'].includes(String(process.env.DEBUG_MEDIA_EP_STATUS || '').toLowerCase());
    if (dbg) {
      console.log('[MediaInventory] Vérification des épisodes en téléchargement...');
    }
    
    const downloadingEpisodes = await query(
      `SELECT d.id, d.tv_season_request_id, d.episode_number, r.title, r.season_number, r.tmdb_id
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
       FROM tv_episode_downloads d
       JOIN tv_season_requests r ON r.id = d.tv_season_request_id
       WHERE d.status = 'downloading'`
    );

    if (!downloadingEpisodes || downloadingEpisodes.length === 0) {
<<<<<<< HEAD
      logger.debug('inventory', 'Aucun épisode en statut "downloading"');
      return 0;
    }
    
    logger.debug('inventory', `${downloadingEpisodes.length} épisode(s) en téléchargement à vérifier`);
=======
      if (dbg) {
        console.log('[MediaInventory] Aucun épisode en statut "downloading"');
      }
      return 0;
    }
    
    if (dbg) {
      console.log(`[MediaInventory] ${downloadingEpisodes.length} épisode(s) en téléchargement à vérifier`);
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const ep of downloadingEpisodes) {
      // eslint-disable-next-line no-await-in-loop
      const present = await mediaInventoryService.isPresent({
        kind: 'tv',
        title: ep.title,
        season: ep.season_number,
        episode: ep.episode_number,
        tmdb_id: ep.tmdb_id
      });

<<<<<<< HEAD
      logger.debug('inventory', `Check "${ep.title}" S${ep.season_number}E${ep.episode_number} => present=${present?.present}`);

      if (present?.present) {
        // eslint-disable-next-line no-await-in-loop
        await markTvEpisodeCompleted({
          requestId: ep.tv_season_request_id,
          episodeNumber: ep.episode_number,
          completedAt: now
        });
=======
      if (dbg) {
        console.log(`[MediaInventory] Check "${ep.title}" S${ep.season_number}E${ep.episode_number} => present=${present?.present}`);
      }

      if (present?.present) {
        // eslint-disable-next-line no-await-in-loop
        await run(
          `UPDATE tv_episode_downloads SET status = 'completed', completed_at = ? WHERE id = ?`,
          [now, ep.id]
        );
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
        updatedCount++;
      }
    }

    // Also update movie requests status and auto-delete completed ones
    try {
      const movieRequests = await query(
        `SELECT id, user_id, tmdb_id, title, release_date, status, completed_at
         FROM media_requests
         WHERE media_type = 'movie' AND status NOT IN ('completed')`
      );

      let completedMarked = 0;
      for (const mr of movieRequests || []) {
        const year = mr?.release_date ? Number(String(mr.release_date).split('-')[0]) : null;
        // eslint-disable-next-line no-await-in-loop
        const presentMovie = await mediaInventoryService.isPresent({
          kind: 'movie',
          title: mr.title,
          year: Number.isInteger(year) ? year : null,
          tmdb_id: mr.tmdb_id
        });

        if (presentMovie?.present) {
          // eslint-disable-next-line no-await-in-loop
          await run(
            `UPDATE media_requests
             SET status = 'completed', completed_at = COALESCE(completed_at, ?), last_checked_at = ?, last_error = ?
             WHERE id = ?`,
            [now, now, null, mr.id]
          );
          completedMarked++;
        }
      }

      const hoursSetting = await getSetting('media_requests_auto_delete_completed_after_hours');
      const hours = typeof hoursSetting === 'number' && Number.isFinite(hoursSetting) && hoursSetting >= 0 ? hoursSetting : 24;
      if (hours === 0) {
        // immediate cleanup
        await run(`DELETE FROM media_requests WHERE status = 'completed'`);
      } else {
        const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
        const cutoffIso = new Date(cutoffMs).toISOString();
        await run(
          `DELETE FROM media_requests
           WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?`,
          [cutoffIso]
        );
      }

<<<<<<< HEAD
      if (completedMarked > 0) {
        logger.debug('inventory', `${completedMarked} film(s) passé(s) en 'completed'`);
=======
      if (dbg && completedMarked > 0) {
        console.log(`[MediaInventory] ${completedMarked} film(s) passé(s) en 'completed'`);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      }
    } catch {
      // ignore
    }

<<<<<<< HEAD
    if (updatedCount > 0) {
      logger.debug('inventory', `${updatedCount} épisode(s) passé(s) de 'downloading' à 'completed'`);
=======
    if (dbg && updatedCount > 0) {
      console.log(`[MediaInventory] ${updatedCount} épisode(s) passé(s) de 'downloading' à 'completed'`);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    }

    return updatedCount;
  } catch (error) {
<<<<<<< HEAD
    logger.error('[MediaInventory] Erreur mise à jour statuts épisodes:', error);
=======
    console.error('[MediaInventory] Erreur mise à jour statuts épisodes:', error);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    return 0;
  }
}

<<<<<<< HEAD
export default {
  updateDownloadingEpisodesStatus,
  reconcileStaleTvEpisodeDownloads
};
=======
export default { updateDownloadingEpisodesStatus };
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
