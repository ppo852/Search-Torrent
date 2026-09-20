import { get, query, run } from '../core/db.js';
import { getSetting, resolveMinSeeds } from '../settings/index.js';
import qBittorrentService from '../qbittorrent/index.js';
import mediaInventoryService from '../media-inventory/index.js';
import prowlarrSearchService, { isCompleteSeasonTitle } from '../prowlarr/search.js';
import {
  loadAssignedQualityProfile,
  isMovieLikeMediaType
} from '../utils/helpers.js';
import {
  getSeasonEpisodesWithAirDates,
  isEpisodeAiredNow,
} from '../tmdb/episodes.js';
import { reconcileStaleTvEpisodeDownloads } from '../media-inventory/episode-status.js';
import { logActivity } from '../activity-log/index.js';
import {
  buildQbitTagsString,
  findQbitTorrentByTags,
  loadQbitTorrentsForUser
} from '../tv-season/qbit-tags.js';
import { tryMarkTvSeasonCompleted } from '../tv-season/completion.js';
import {
  insertTvSeasonHistory,
  markTvEpisodeCompleted,
  markTvEpisodeError,
  resolveTvSeasonInProgressStatus,
  torrentDownloadFields,
  torrentHistoryFields,
  upsertTvEpisodeDownload
} from '../tv-season/downloads.js';
import { inferQbitCategoryFromMediaType } from '../utils/qbit-categories.js';
import logger from '../core/logger.js';

async function getAutoSearchContext(mediaType) {
  const minSeeds = await resolveMinSeeds();
  const profiles = await getSetting('quality_profiles');
  const assignments = await getSetting('quality_profile_assignments');

  return {
    minSeeds,
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

    if (!isEpisodeAiredNow(tmdbEpisode.airDate)) {
      const waitStatus = await resolveTvSeasonInProgressStatus(requestId);
      await run(`UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [waitStatus, epNum, now, null, requestId, userId]);
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
      const waitStatus = await resolveTvSeasonInProgressStatus(requestId);
      await run(`UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [waitStatus, epNum, now, null, requestId, userId]);
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
      ['downloading', epNum, String(best.name), String(best.link), best.size, best.seeds, now, null, requestId, userId]);

    return { status: 'sent_episode', episode: epNum, selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    await run(`UPDATE tv_season_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['error', now, message, requestId, userId]);
    await logActivity({
      eventType: 'auto_search.error',
      actorUsername: null,
      targetLabel: `TV request ${requestId}`,
      details: { message, requestId, episode: epNum },
    });
    return { status: 'error', error: message, episode: epNum };
  }
}

export async function runAutoSearchForRequest({ requestId, userId }) {
  const requestItem = await get(`SELECT * FROM media_requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
  if (!requestItem) return { status: 'not_found' };

  const now = new Date().toISOString();
  const year = requestItem.release_date ? Number(String(requestItem.release_date).split('-')[0]) : null;
  const mediaKind = isMovieLikeMediaType(requestItem.media_type) ? 'movie' : 'tv';

  if (requestItem.status === 'sent_to_qbit') {
    const present = await mediaInventoryService.isPresent({
      kind: mediaKind,
      title: requestItem.title,
      year,
      tmdb_id: requestItem.tmdb_id,
    });

    if (present?.present) {
      await run(
        `UPDATE media_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
        ['already_available', now, null, requestId, userId]
      );
      return { status: 'already_available' };
    }

    return { status: 'already_sent' };
  }

  try {
    const present = await mediaInventoryService.isPresent({
      kind: mediaKind,
      title: requestItem.title,
      year,
      tmdb_id: requestItem.tmdb_id,
    });

    if (present?.present) {
      await run(`UPDATE media_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['already_available', now, null, requestId, userId]);
      return { status: 'already_available' };
    }

    const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(requestItem.media_type);

    const { results, extrasFilteredOnly } = await prowlarrSearchService.searchMovieDetailed({
      title: requestItem.title,
      year,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      minSeeds,
      qualityProfile: profile,
    });

    const best = results[0] || null;

    if (!best) {
      if (extrasFilteredOnly) {
        logger.debug('autosearch', 'movie no_results — extras filtered only', { requestId });
      }
      // Pas un échec technique : film pas encore dispo sur les indexeurs.
      await run(
        `UPDATE media_requests SET last_checked_at = ?, last_error = ?, status = 'pending' WHERE id = ? AND user_id = ?`,
        [now, null, requestId, userId]
      );
      return { status: 'no_results', extras_filtered_only: extrasFilteredOnly };
    }

    await qBittorrentService.addTorrentUrlForUser(userId, best.link, { category: qbitCategory, tags: buildQbitTagsString({ requestId }) });
    await run(`UPDATE media_requests SET status = ?, matched_torrent_name = ?, matched_torrent_magnet = ?, matched_torrent_size = ?, matched_torrent_seeds = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
      ['sent_to_qbit', String(best.name), String(best.link), best.size, best.seeds, now, null, requestId, userId]);

    return { status: 'sent', selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    await run(`UPDATE media_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, ['error', now, message, requestId, userId]);
    await logActivity({
      eventType: 'auto_search.error',
      actorUsername: null,
      targetLabel: requestItem?.title || requestId,
      details: { message, requestId, kind: 'movie' },
    });
    return { status: 'error', error: message };
  }
}

export async function runAutoSearchForTvSeasonRequest({ requestId, userId, reconcileStale = true }) {
  const requestItem = await get(`SELECT * FROM tv_season_requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
  if (!requestItem || requestItem.status === 'completed') return { status: 'already_sent' };

  if (requestItem.status === 'sent_to_qbit') {
    await run(`UPDATE tv_season_requests SET status = 'downloading' WHERE id = ? AND user_id = ?`, [requestId, userId]);
    requestItem.status = 'downloading';
  }

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

      if (isEpisodeAiredNow(ep.airDate)) missingEpisodes.push(ep.episodeNumber);
    }

    if (missingEpisodes.length === 0) {
      const completed = await tryMarkTvSeasonCompleted(
        {
          id: requestId,
          user_id: userId,
          tmdb_id: requestItem.tmdb_id,
          title: requestItem.title,
          season_number: requestItem.season_number
        },
        now
      );
      return { status: completed ? 'completed_season' : 'not_aired' };
    }

    const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(requestItem.media_type);
    const hasErrorRetry = missingEpisodes.some((ep) => errorEpisodes.has(ep));
    let qbitTorrents = null;
    const hasPartialPresence = presentSet.size > 0;

    let bestPack = null;
    if (!hasPartialPresence) {
      const packResults = await prowlarrSearchService.searchTvSeries({
        title: requestItem.title,
        tmdbId: requestItem.tmdb_id,
        mediaType: requestItem.media_type,
        seasonNumber: requestItem.season_number,
        minSeeds,
        qualityProfile: profile,
        episodeCount: allEpisodes.length
      });
      bestPack = packResults.filter(r => isCompleteSeasonTitle(r.name))[0];
    }

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
         SET status = 'downloading', next_episode_number = ?,
             matched_torrent_name = ?, matched_torrent_magnet = ?,
             matched_torrent_size = ?, matched_torrent_seeds = ?,
             last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        [nextEp, bestPack.name, bestPack.link, bestPack.size, bestPack.seeds, now, null, requestId, userId]
      );
      return { status: 'sent_season_pack', selected: bestPack };
    } else if (hasPartialPresence) {
      logger.info(
        `[AutoSearch] Pack saison ignoré pour "${requestItem.title}" S${requestItem.season_number} `
        + `(${presentSet.size} épisode(s) déjà présent(s), ${missingEpisodes.length} manquant(s)) — recherche individuelle`
      );
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

    if (downloaded.length > 0) {
      const waitStatus = await resolveTvSeasonInProgressStatus(requestId);
      const stillMissing = missingEpisodes.filter((ep) => !downloaded.includes(ep));
      const nextEp = stillMissing.length > 0 ? Math.min(...stillMissing) : Math.min(...downloaded);
      await run(
        `UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
        [waitStatus, nextEp, now, null, requestId, userId]
      );
      logger.info(`[AutoSearch] Scan terminé pour "${requestItem.title}" S${requestItem.season_number}. Résultat: ${downloaded.length} épisode(s) envoyé(s).`);
      return { status: 'sent_batch', downloadedCount: downloaded.length };
    }

    await run(`UPDATE tv_season_requests SET last_checked_at = ? WHERE id = ? AND user_id = ?`, [now, requestId, userId]);
    if (skippedInQbit.length > 0) {
      return { status: 'already_in_qbit', episodes: skippedInQbit };
    }
    logger.info(`[AutoSearch] Scan terminé pour "${requestItem.title}" S${requestItem.season_number}. Résultat: Aucun résultat compatible trouvé.`);
    return { status: 'no_results', downloadedCount: 0 };
  } catch (error) {
    logger.error(`[AutoSearch] Erreur critique lors du scan de "${requestItem?.title || requestId}" S${requestItem?.season_number}:`, error);
    await run(`UPDATE tv_season_requests SET status = 'error', last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`, [now, error.message, requestId, userId]);
    await logActivity({
      eventType: 'auto_search.error',
      actorUsername: null,
      targetLabel: requestItem?.title ? `${requestItem.title} S${requestItem.season_number}` : requestId,
      details: { message: error.message, requestId, kind: 'tv_season' },
    });
    return { status: 'error', error: error.message };
  }
}

export async function runAutoSearchOnce() {
  logger.info('Cycle de recherche automatique...');
  await reconcileStaleTvEpisodeDownloads();

  const pending = await query(`SELECT id, user_id FROM media_requests WHERE status IN ('pending','error') LIMIT 50`);
  const tvMonitoring = await query(`SELECT id, user_id FROM tv_season_requests WHERE status IN ('monitoring','downloading','error','sent_to_qbit') LIMIT 50`);

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
