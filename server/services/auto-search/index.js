import { get, query, run } from '../core/db.js';
import { getSetting } from '../settings/index.js';
import qBittorrentService from '../qbittorrent/index.js';
import mediaInventoryService from '../media-inventory/index.js';
import prowlarrSearchService, { isCompleteSeasonTitle } from '../prowlarr/search.js';
import { applyQualityProfile } from '../utils/validation.js';
import {
  pad2,
  loadAssignedQualityProfile
} from '../utils/helpers.js';
import {
  getSeasonEpisodesWithAirDates
} from '../tmdb/episodes.js';
import { reconcileStaleTvEpisodeDownloads } from '../media-inventory/episode-status.js';
import {
  buildQbitTagsString,
  findQbitTorrentByTags,
  loadQbitTorrentsForUser
} from '../tv-season/qbit-tags.js';
import {
  insertTvSeasonHistory,
  markTvEpisodeCompleted,
  markTvEpisodeError,
  torrentDownloadFields,
  torrentHistoryFields,
  upsertTvEpisodeDownload
} from '../tv-season/downloads.js';
import { inferQbitCategoryFromMediaType } from '../utils/qbit-categories.js';
import logger from '../core/logger.js';

async function getAutoSearchContext(mediaType) {
  const minSeedsSetting = await getSetting('min_seeds');
  const profiles = await getSetting('quality_profiles');
  const assignments = await getSetting('quality_profile_assignments');

  return {
    minSeeds: typeof minSeedsSetting === 'number' ? minSeedsSetting : 3,
    profile: loadAssignedQualityProfile(mediaType, profiles, assignments),
    qbitCategory: inferQbitCategoryFromMediaType(mediaType)
  };
}

export async function runAutoSearchForTvSeasonEpisodeRequest({ requestId, userId, episodeNumber }) {
  const epNum = Number(episodeNumber);
  if (!Number.isFinite(epNum) || epNum <= 0) return { status: 'invalid_episode_number' };

  const requestItem = await get(
    `SELECT id, user_id, tmdb_id, media_type, title, season_number, status, next_episode_number FROM tv_season_requests WHERE id = ? AND user_id = ?`,
    [requestId, userId]
  );
  if (!requestItem) return { status: 'not_found' };

  await reconcileStaleTvEpisodeDownloads({ tvSeasonRequestId: requestId });

  const now = new Date().toISOString();
  try {
    const allEpisodes = await getSeasonEpisodesWithAirDates({ tmdbId: requestItem.tmdb_id, seasonNumber: requestItem.season_number });
    const tmdbEpisode = (allEpisodes || []).find((e) => Number(e.episodeNumber) === epNum) || null;
    if (!tmdbEpisode) return { status: 'episode_not_in_tmdb' };

    const present = await mediaInventoryService.isPresent({ kind: 'tv', title: requestItem.title, season: requestItem.season_number, episode: epNum, tmdb_id: requestItem.tmdb_id });
    if (present?.present) return { status: 'already_present', episode: epNum };

    const historyRows = await query(`SELECT status FROM tv_episode_downloads WHERE tv_season_request_id = ? AND episode_number = ?`, [requestId, epNum]);
    const historyStatus = historyRows?.[0]?.status ?? null;

    if (historyStatus === 'downloading') {
      return { status: 'already_in_history', episode: epNum, current_status: historyStatus };
    }

    if (historyStatus === 'completed') {
      await markTvEpisodeError({ requestId, episodeNumber: epNum });
    }

    const retryAfterError = historyStatus === 'error' || historyStatus === 'completed';
    if (retryAfterError) {
      const qbitTorrents = await loadQbitTorrentsForUser(userId);
      const existingTorrent = qbitTorrents
        ? findQbitTorrentByTags(qbitTorrents, { requestId, episodeNumber: epNum })
        : null;

      if (existingTorrent) {
        await upsertTvEpisodeDownload({
          requestId,
          episodeNumber: epNum,
          sentAt: now,
          ...torrentDownloadFields(existingTorrent)
        });
        return { status: 'already_in_qbit', episode: epNum, torrent_name: existingTorrent.name || null };
      }
    }

    const airMs = tmdbEpisode.airDate ? new Date(tmdbEpisode.airDate).getTime() : null;
    if (airMs && airMs > Date.now()) {
      await run(`UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['monitoring', epNum, now, null, requestId, userId]);
      return { status: 'not_aired', episode: epNum };
    }

    const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(requestItem.media_type);

    const results = await prowlarrSearchService.searchTvEpisode({
      title: requestItem.title,
      seasonNumber: requestItem.season_number,
      episodeNumber: epNum,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      minSeeds,
      qualityProfile: profile
    });

    const best = results[0] || null;

    if (!best) {
      await run(`UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['monitoring', epNum, now, null, requestId, userId]);
      return { status: 'no_results', episode: epNum };
    }

    await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
      category: qbitCategory,
      tags: buildQbitTagsString({ requestId, seasonNumber: requestItem.season_number, episodeNumber: epNum })
    });

    await upsertTvEpisodeDownload({
      requestId,
      episodeNumber: epNum,
      sentAt: now,
      ...torrentDownloadFields(best)
    });

    await insertTvSeasonHistory({
      tvSeasonRequestId: requestItem.id,
      userId: requestItem.user_id,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      title: requestItem.title,
      seasonNumber: requestItem.season_number,
      episodeNumber: epNum,
      action: 'sent_auto',
      createdAt: now,
      ...torrentHistoryFields(best)
    });

    await run(`UPDATE tv_season_requests SET status = ?, next_episode_number = ?, matched_torrent_name = ?, matched_torrent_magnet = ?, matched_torrent_size = ?, matched_torrent_seeds = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
      ['monitoring', epNum, String(best.name), String(best.link), best.size, best.seeds, now, null, requestId, userId]);

    return { status: 'sent_episode', episode: epNum, selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    await run(`UPDATE tv_season_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['error', now, message, requestId, userId]);
    return { status: 'error', error: message, episode: epNum };
  }
}

export async function runAutoSearchForRequest({ requestId, userId }) {
  const requestItem = await get(`SELECT * FROM media_requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
  if (!requestItem) return { status: 'not_found' };
  if (requestItem.status === 'sent_to_qbit') return { status: 'already_sent' };

  const now = new Date().toISOString();
  try {
    const year = requestItem.release_date ? Number(String(requestItem.release_date).split('-')[0]) : null;
    const present = await mediaInventoryService.isPresent({ kind: requestItem.media_type === 'movie' ? 'movie' : 'tv', title: requestItem.title, year: year, tmdb_id: requestItem.tmdb_id });

    if (present?.present) {
      await run(`UPDATE media_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['already_available', now, null, requestId, userId]);
      return { status: 'already_available' };
    }

    const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(requestItem.media_type);

    const results = await prowlarrSearchService.searchMovie({
      title: requestItem.title,
      year: year,
      tmdbId: requestItem.tmdb_id,
      minSeeds,
      qualityProfile: profile
    });

    const best = results[0] || null;

    if (!best) {
      await run(`UPDATE media_requests SET last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [now, null, requestId, userId]);
      return { status: 'no_results' };
    }

    await qBittorrentService.addTorrentUrlForUser(userId, best.link, { category: qbitCategory, tags: buildQbitTagsString({ requestId }) });
    await run(`UPDATE media_requests SET status = ?, matched_torrent_name = ?, matched_torrent_magnet = ?, matched_torrent_size = ?, matched_torrent_seeds = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
      ['sent_to_qbit', String(best.name), String(best.link), best.size, best.seeds, now, null, requestId, userId]);

    return { status: 'sent', selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    await run(`UPDATE media_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['error', now, message, requestId, userId]);
    return { status: 'error', error: message };
  }
}

export async function runAutoSearchForTvSeasonRequest({ requestId, userId, reconcileStale = true }) {
  const requestItem = await get(`SELECT * FROM tv_season_requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
  if (!requestItem || ['sent_to_qbit', 'completed'].includes(requestItem.status)) return { status: 'already_sent' };

  if (reconcileStale) {
    await reconcileStaleTvEpisodeDownloads({ tvSeasonRequestId: requestId });
  }

  const now = new Date().toISOString();
  try {
    const allEpisodes = await getSeasonEpisodesWithAirDates({ tmdbId: requestItem.tmdb_id, seasonNumber: requestItem.season_number });
    if (allEpisodes.length === 0) return { status: 'error', error: 'No episodes found in TMDB' };

    const downloadingRows = await query(`SELECT episode_number FROM tv_episode_downloads WHERE tv_season_request_id = ? AND status = 'downloading'`, [requestId]);
    const alreadyDownloading = new Set((downloadingRows || []).map(r => r.episode_number));

    const errorRows = await query(`SELECT episode_number FROM tv_episode_downloads WHERE tv_season_request_id = ? AND status = 'error'`, [requestId]);
    const errorEpisodes = new Set((errorRows || []).map(r => r.episode_number));

    const presentSet = new Set(await mediaInventoryService.getSeasonPresence({ tmdb_id: requestItem.tmdb_id, title: requestItem.title, season: requestItem.season_number }));

    const missingEpisodes = [];
    const downloadingEpisodes = [];
    for (const ep of allEpisodes) {
      if (presentSet.has(ep.episodeNumber)) {
        if (alreadyDownloading.has(ep.episodeNumber)) {
          await markTvEpisodeCompleted({ requestId, episodeNumber: ep.episodeNumber, completedAt: now });
        }
        continue;
      }
      if (alreadyDownloading.has(ep.episodeNumber)) { downloadingEpisodes.push(ep.episodeNumber); continue; }

      const airMs = ep.airDate ? new Date(ep.airDate).getTime() : null;
      if (!airMs || airMs <= Date.now()) missingEpisodes.push(ep.episodeNumber);
    }

    if (missingEpisodes.length === 0) {
      if (presentSet.size === allEpisodes.length) await run(`UPDATE tv_season_requests SET status = 'completed', last_checked_at = ? WHERE id = ? AND user_id = ?`, [now, requestId, userId]);
      return { status: presentSet.size === allEpisodes.length ? 'completed_season' : 'not_aired' };
    }

    const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(requestItem.media_type);
    const hasErrorRetry = missingEpisodes.some((ep) => errorEpisodes.has(ep));
    let qbitTorrents = null;

    const packResults = await prowlarrSearchService.searchTvSeries({
      title: requestItem.title,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      seasonNumber: requestItem.season_number,
      minSeeds,
      qualityProfile: profile,
      episodeCount: allEpisodes.length
    });
    const bestPack = packResults.filter(r => isCompleteSeasonTitle(r.name))[0];

    if (bestPack) {
      if (hasErrorRetry) {
        qbitTorrents = qbitTorrents ?? await loadQbitTorrentsForUser(userId);
        const existingPack = qbitTorrents
          ? findQbitTorrentByTags(qbitTorrents, { requestId, episodeNumber: null })
          : null;

        if (existingPack) {
          for (const ep of missingEpisodes) {
            if (!errorEpisodes.has(ep)) continue;
            // eslint-disable-next-line no-await-in-loop
            await upsertTvEpisodeDownload({
              requestId,
              episodeNumber: ep,
              sentAt: now,
              ...torrentDownloadFields(existingPack)
            });
          }
          await run(`UPDATE tv_season_requests SET last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [now, null, requestId, userId]);
          return { status: 'already_in_qbit', mode: 'pack', torrent_name: existingPack.name || null };
        }
      }

      await qBittorrentService.addTorrentUrlForUser(userId, bestPack.link, { category: qbitCategory, tags: buildQbitTagsString({ requestId, seasonNumber: requestItem.season_number }) });
      for (const ep of missingEpisodes) {
        await upsertTvEpisodeDownload({
          requestId,
          episodeNumber: ep,
          sentAt: now,
          ...torrentDownloadFields(bestPack)
        });
        // eslint-disable-next-line no-await-in-loop
        await insertTvSeasonHistory({
          tvSeasonRequestId: requestItem.id,
          userId: requestItem.user_id,
          tmdbId: requestItem.tmdb_id,
          mediaType: requestItem.media_type,
          title: requestItem.title,
          seasonNumber: requestItem.season_number,
          episodeNumber: ep,
          action: 'sent_auto',
          createdAt: now,
          ...torrentHistoryFields(bestPack)
        });
      }
      const nextEp = Math.min(...missingEpisodes);
      await run(
        `UPDATE tv_season_requests
         SET status = 'monitoring', next_episode_number = ?,
             matched_torrent_name = ?, matched_torrent_magnet = ?,
             matched_torrent_size = ?, matched_torrent_seeds = ?,
             last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        [nextEp, bestPack.name, bestPack.link, bestPack.size, bestPack.seeds, now, null, requestId, userId]
      );
      return { status: 'sent_season_pack', selected: bestPack };
    }

    // Individual search
    const downloaded = [];
    const skippedInQbit = [];
    for (const ep of missingEpisodes) {
      if (errorEpisodes.has(ep)) {
        qbitTorrents = qbitTorrents ?? await loadQbitTorrentsForUser(userId);
        const existingTorrent = qbitTorrents
          ? findQbitTorrentByTags(qbitTorrents, { requestId, episodeNumber: ep })
          : null;

        if (existingTorrent) {
          // eslint-disable-next-line no-await-in-loop
          await upsertTvEpisodeDownload({
            requestId,
            episodeNumber: ep,
            sentAt: now,
            ...torrentDownloadFields(existingTorrent)
          });
          skippedInQbit.push(ep);
          continue;
        }
      }

      const results = await prowlarrSearchService.searchTvEpisode({
        title: requestItem.title,
        seasonNumber: requestItem.season_number,
        episodeNumber: ep,
        tmdbId: requestItem.tmdb_id,
        mediaType: requestItem.media_type,
        minSeeds,
        qualityProfile: profile
      });
      const best = results[0];
      if (best) {
        await qBittorrentService.addTorrentUrlForUser(userId, best.link, { category: qbitCategory, tags: buildQbitTagsString({ requestId, seasonNumber: requestItem.season_number, episodeNumber: ep }) });
        await upsertTvEpisodeDownload({
          requestId,
          episodeNumber: ep,
          sentAt: now,
          ...torrentDownloadFields(best)
        });
        // eslint-disable-next-line no-await-in-loop
        await insertTvSeasonHistory({
          tvSeasonRequestId: requestItem.id,
          userId: requestItem.user_id,
          tmdbId: requestItem.tmdb_id,
          mediaType: requestItem.media_type,
          title: requestItem.title,
          seasonNumber: requestItem.season_number,
          episodeNumber: ep,
          action: 'sent_auto',
          createdAt: now,
          ...torrentHistoryFields(best)
        });
        downloaded.push(ep);
      }
    }

    await run(`UPDATE tv_season_requests SET last_checked_at = ? WHERE id = ? AND user_id = ?`, [now, requestId, userId]);
    if (downloaded.length > 0) {
      logger.info(`[AutoSearch] Scan terminé pour "${requestItem.title}" S${requestItem.season_number}. Résultat: ${downloaded.length} épisode(s) envoyé(s).`);
      return { status: 'sent_batch', downloadedCount: downloaded.length };
    }
    if (skippedInQbit.length > 0) {
      return { status: 'already_in_qbit', episodes: skippedInQbit };
    }
    logger.info(`[AutoSearch] Scan terminé pour "${requestItem.title}" S${requestItem.season_number}. Résultat: Aucun résultat compatible trouvé.`);
    return { status: 'no_results', downloadedCount: 0 };
  } catch (error) {
    logger.error(`[AutoSearch] Erreur critique lors du scan de "${requestItem?.title || requestId}" S${requestItem?.season_number}:`, error);
    await run(`UPDATE tv_season_requests SET status = 'error', last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [now, error.message, requestId, userId]);
    return { status: 'error', error: error.message };
  }
}

export async function runAutoSearchOnce() {
  logger.info('Cycle de recherche automatique...');
  await reconcileStaleTvEpisodeDownloads();

  const pending = await query(`SELECT id, user_id FROM media_requests WHERE status IN ('pending','error') LIMIT 50`);
  const tvMonitoring = await query(`SELECT id, user_id FROM tv_season_requests WHERE status IN ('monitoring','error') LIMIT 50`);

  for (const row of pending || []) await runAutoSearchForRequest({ requestId: row.id, userId: row.user_id });
  for (const row of tvMonitoring || []) {
    await runAutoSearchForTvSeasonRequest({ requestId: row.id, userId: row.user_id, reconcileStale: false });
  }
}

export default {
  runAutoSearchOnce,
  runAutoSearchForRequest,
  runAutoSearchForTvSeasonRequest,
  runAutoSearchForTvSeasonEpisodeRequest
};
