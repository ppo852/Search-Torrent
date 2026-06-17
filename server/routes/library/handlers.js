import { randomUUID } from 'crypto';
import { get, query, run } from '../../services/core/db.js';
import { getSetting } from '../../services/settings/index.js';
import qBittorrentService from '../../services/qbittorrent/index.js';
import autoSearchService from '../../services/auto-search/index.js';
import mediaInventoryService from '../../services/media-inventory/index.js';
import prowlarrSearchService, {
  getProwlarrCategoryId,
  isCompleteSeasonTitle
} from '../../services/prowlarr/search.js';
import tmdbService from '../../services/tmdb/index.js';
import logger from '../../services/core/logger.js';
import {
  flattenKeywords,
  titleContainsAny
} from '../../services/utils/keywords.js';
import { getResultCompatibility } from '../../services/utils/validation.js';
import { loadAssignedQualityProfile } from '../../services/utils/helpers.js';
import { reconcileStaleTvEpisodeDownloads } from '../../services/media-inventory/episode-status.js';
import { buildQbitTagsString } from '../../services/tv-season/qbit-tags.js';
import { insertTvSeasonHistory, markTvEpisodeCompleted, markTvEpisodeError } from '../../services/tv-season/downloads.js';
import { inferQbitCategoryFromMediaType } from '../../services/utils/qbit-categories.js';

export async function getTvSeasonHistoryHandler(req, res) {
  try {
    const { id } = req.params;

    const season = await get(
      `SELECT id, user_id
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!season) return res.status(404).json({ error: 'Élément non trouvé' });

    const rows = await query(
      `SELECT id, tv_season_request_id, action, episode_number, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at
       FROM tv_season_request_history
       WHERE tv_season_request_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json(rows || []);
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'historique TV:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function autoSearchTvSeasonRequestHandler(req, res) {
  try {
    const { id } = req.params;

    const existing = await get(
      `SELECT id, user_id
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    const result = await autoSearchService.runAutoSearchForTvSeasonRequest({
      requestId: id,
      userId: existing.user_id
    });

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, status, next_episode_number,
              last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds,
              created_at
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    res.json({ request: updated, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    logger.error('Erreur lors de la recherche automatique (tv_season_requests):', error);
    res.status(500).json({ error: message });
  }
}

export async function autoSearchTvSeasonEpisodeRequestHandler(req, res) {
  try {
    const { id } = req.params;
    const { episode_number } = req.body || {};

    const existing = await get(
      `SELECT id, user_id
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    const result = await autoSearchService.runAutoSearchForTvSeasonEpisodeRequest({
      requestId: id,
      userId: existing.user_id,
      episodeNumber: episode_number
    });

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, status, next_episode_number,
              last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds,
              created_at
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    res.json({ request: updated, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Erreur lors de la recherche automatique (tv_season_requests episode):', error);
    res.status(500).json({ error: message });
  }
}

export async function getTvSeasonPresenceHandler(req, res) {
  try {
    const { id } = req.params;
    const season = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, season_number
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!season) return res.status(404).json({ error: 'Élément non trouvé' });

    const episodes = await tmdbService.getSeasonEpisodes(season.tmdb_id, season.season_number);
    const episodeNumbers = episodes.map(e => e.episodeNumber);

    // Épisodes marqués completed en base (re-vérifiés sur le disque)
    const completedRows = await query(
      `SELECT episode_number FROM tv_episode_downloads
       WHERE tv_season_request_id = ? AND status = 'completed'`,
      [id]
    );
    const completedEpisodes = new Set((completedRows || []).map(r => r.episode_number));

    const { errorEpisodesByRequest } = await reconcileStaleTvEpisodeDownloads({ tvSeasonRequestId: id });
    const errorEpisodesSet = errorEpisodesByRequest.get(id) ?? new Set();

    const downloadingRows = await query(
      `SELECT episode_number, sent_at, torrent_name
       FROM tv_episode_downloads
       WHERE tv_season_request_id = ? AND status = 'downloading'`,
      [id]
    );
    const downloadingEpisodes = (downloadingRows || []).map(r => r.episode_number);

    const present = [];
    const downloading = [];
    const missing = [];
    const errorEpisodes = [];

    for (const ep of episodeNumbers) {
      // eslint-disable-next-line no-await-in-loop
      const p = await mediaInventoryService.isPresent({
        kind: 'tv',
        title: season.title,
        season: season.season_number,
        episode: ep,
        tmdb_id: season.tmdb_id
      });

      if (p?.present) {
        present.push(ep);
        if (downloadingEpisodes.includes(ep) || errorEpisodesSet.has(ep)) {
          // eslint-disable-next-line no-await-in-loop
          await markTvEpisodeCompleted({ requestId: id, episodeNumber: ep });
        }
      } else if (completedEpisodes.has(ep)) {
        // completed en base mais fichier absent du disque
        // eslint-disable-next-line no-await-in-loop
        await markTvEpisodeError({ requestId: id, episodeNumber: ep });
        missing.push(ep);
      } else if (errorEpisodesSet.has(ep)) {
        errorEpisodes.push(ep);
      } else if (downloadingEpisodes.includes(ep)) {
        downloading.push(ep);
      } else {
        missing.push(ep);
      }
    }

    // Advance next episode pointer based on missing episodes (not downloading, not present)
    const nextMissing = (missing.length > 0)
      ? Math.min(...missing)
      : (episodeNumbers.length > 0 ? Math.max(...episodeNumbers) + 1 : 1);
    const nextStatus = (missing.length > 0 || downloading.length > 0) ? 'monitoring' : 'completed';
    const now = new Date().toISOString();
    try {
      await run(
        `UPDATE tv_season_requests
         SET next_episode_number = ?, status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        [nextMissing, nextStatus, now, null, id]
      );
    } catch {
      // ignore
    }

    res.json({
      id: season.id,
      tmdb_id: season.tmdb_id,
      season_number: season.season_number,
      present_episodes: present,
      downloading_episodes: downloading,
      error_episodes: errorEpisodes,
      missing_episodes: missing,
      next_episode_number: nextMissing,
      status: nextStatus
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la présence des épisodes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// Supprimé au profit de tmdbService.getSeasonEpisodes


function canManageRequest(req, request) {
  if (!request) return false;
  if (req.user?.is_admin) return true;
  return request.user_id === req.user?.id;
}

function pad2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '00';
  return String(v).padStart(2, '0');
}

function buildEpisodeToken(seasonNumber, episodeNumber) {
  return `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;
}

function buildSeasonToken(seasonNumber) {
  return `S${pad2(seasonNumber)}`;
}

function buildEpisodeMatchRegex(seasonNumber, episodeNumber) {
  const s = Number(seasonNumber);
  const e = Number(episodeNumber);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;

  const sStr = String(s);
  const eStr = String(e);
  return new RegExp(`(?:S0*${sStr}E0*${eStr}|${sStr}x0*${eStr})`, 'i');
}

export async function listLibraryHandler(req, res) {
  try {
    const items = await query(
      `SELECT mr.id, mr.user_id, mr.tmdb_id, mr.media_type, mr.title, mr.poster_url, mr.release_date, mr.monitored, mr.created_at,
              mr.status, mr.last_checked_at, mr.last_error,
              mr.matched_torrent_name, mr.matched_torrent_magnet, mr.matched_torrent_size, mr.matched_torrent_seeds,
              u.username as requested_by
       FROM media_requests mr
       LEFT JOIN users u ON u.id = mr.user_id
       ORDER BY mr.created_at DESC`
    );

    const processedItems = (items || []).map(item => ({
      ...item,
      monitored: !!item.monitored
    }));

    res.json(processedItems);
  } catch (error) {
    console.error('Erreur lors de la récupération du suivi:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function searchTvSeasonRequestEpisodeHandler(req, res) {
  try {
    const { id } = req.params;
    const { episode_number } = req.body;

    const targetEpisodeNumber = Number(episode_number);
    if (!Number.isInteger(targetEpisodeNumber) || targetEpisodeNumber <= 0) {
      return res.status(400).json({ error: 'episode_number est requis (entier > 0)' });
    }

    const requestItem = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, next_episode_number
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!requestItem) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, requestItem)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    const results = await prowlarrSearchService.searchTvEpisode({
      title: requestItem.title,
      seasonNumber: requestItem.season_number,
      episodeNumber: targetEpisodeNumber,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      minSeeds: 0 // On veut tout voir en manuel
    });

    const profiles = await getSetting('quality_profiles');
    const assignments = await getSetting('quality_profile_assignments');

    const assignedProfile = loadAssignedQualityProfile(requestItem.media_type, profiles, assignments);

    const resultsWithCompatibility = results.map((r) => ({
      ...r,
      ...getResultCompatibility(r, assignedProfile)
    }));

    res.json({ results: resultsWithCompatibility });
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      const { id } = req.params;
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['error', now, message, id]
      );
    } catch {
      // ignore
    }

    console.error('Erreur lors de la recherche Prowlarr (tv_season_requests episode):', error);
    res.status(500).json({ error: message });
  }
}

export async function searchTvSeasonRequestHandler(req, res) {
  try {
    const { id } = req.params;

    const requestItem = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, next_episode_number
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!requestItem) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, requestItem)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    // Récupérer le nombre d'épisodes pour adapter les filtres de taille
    const episodes = await tmdbService.getSeasonEpisodes(requestItem.tmdb_id, requestItem.season_number);
    const episodeCount = (episodes || []).length || 1;

    const results = await prowlarrSearchService.searchTvSeries({
      title: requestItem.title,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      seasonNumber: requestItem.season_number,
      minSeeds: 0, // On veut tout voir en manuel
      episodeCount
    });

    const profiles = await getSetting('quality_profiles');
    const assignments = await getSetting('quality_profile_assignments');

    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const assignedProfileId = assignments?.tv_profile_id;
    const assignedProfile = assignedProfileId
      ? safeProfiles.find((p) => p?.id === assignedProfileId) || null
      : null;

    const resultsWithCompatibility = results.map((r) => ({
      ...r,
      ...getResultCompatibility(r, assignedProfile, episodeCount)
    }));

    res.json({ results: resultsWithCompatibility });
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      const { id } = req.params;
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['error', now, message, id]
      );
    } catch {
      // ignore
    }

    console.error('Erreur lors de la recherche Prowlarr (tv_season_requests):', error);
    res.status(500).json({ error: message });
  }
}

export async function selectTvSeasonRequestHandler(req, res) {
  try {
    const { id } = req.params;
    const { name, link, size, seeds } = req.body;

    if (!name || !link) {
      return res.status(400).json({ error: 'name et link sont requis' });
    }

    const existing = await get(
      'SELECT id, user_id FROM tv_season_requests WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, existing)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    await run(
      `UPDATE tv_season_requests
       SET status = ?,
           matched_torrent_name = ?,
           matched_torrent_magnet = ?,
           matched_torrent_size = ?,
           matched_torrent_seeds = ?,
           last_error = ?
       WHERE id = ?`,
      [
        'found',
        String(name),
        String(link),
        typeof size === 'number' ? size : null,
        typeof seeds === 'number' ? seeds : null,
        null,
        id
      ]
    );

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, status, next_episode_number,
              last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds,
              created_at
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Erreur lors de la sélection du torrent (tv_season_requests):', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

export async function sendToQbitTvSeasonRequestHandler(req, res) {
  try {
    const { id } = req.params;

    const requestedEpisodeNumber = req.body?.episode_number;
    const force = !!req.body?.force;
    const targetEpisodeNumber = requestedEpisodeNumber == null ? null : Number(requestedEpisodeNumber);
    if (targetEpisodeNumber !== null && (!Number.isInteger(targetEpisodeNumber) || targetEpisodeNumber <= 0)) {
      return res.status(400).json({ error: 'episode_number invalide' });
    }

    const requestItem = await get(
      `SELECT id, user_id, tmdb_id, title, media_type, season_number, next_episode_number,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    if (!requestItem) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, requestItem)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    if (!requestItem.matched_torrent_magnet) {
      return res.status(400).json({ error: 'Aucun torrent sélectionné. Lancez une recherche d\'abord.' });
    }

    const presence = await mediaInventoryService.isPresent({
      kind: 'tv',
      title: requestItem.title,
      season: requestItem.season_number,
      episode: targetEpisodeNumber ?? requestItem.next_episode_number
    });

    if (presence?.present && !force) {
      return res.status(409).json({
        error: 'Déjà présent dans la médiathèque',
        present: true,
        matches: presence.matches || []
      });
    }

    const category = inferQbitCategoryFromMediaType(requestItem.media_type) || 'Séries';
    
    await qBittorrentService.addTorrentUrlForUser(requestItem.user_id, requestItem.matched_torrent_magnet, {
      category,
      tags: buildQbitTagsString({
        requestId: id,
        seasonNumber: requestItem.season_number,
        episodeNumber: targetEpisodeNumber ?? requestItem.next_episode_number
      })
    });

    const now = new Date().toISOString();
    const tokenEpisodeNumber = targetEpisodeNumber ?? requestItem.next_episode_number;

    await insertTvSeasonHistory({
      tvSeasonRequestId: id,
      userId: requestItem.user_id,
      tmdbId: requestItem.tmdb_id,
      mediaType: requestItem.media_type,
      title: requestItem.title,
      seasonNumber: requestItem.season_number,
      episodeNumber: tokenEpisodeNumber,
      action: force ? 'sent_forced' : 'sent',
      torrentName: requestItem.matched_torrent_name || null,
      torrentMagnet: requestItem.matched_torrent_magnet || null,
      torrentSize: typeof requestItem.matched_torrent_size === 'number' ? requestItem.matched_torrent_size : null,
      torrentSeeds: typeof requestItem.matched_torrent_seeds === 'number' ? requestItem.matched_torrent_seeds : null,
      createdAt: now
    });

    const episodeToken = buildEpisodeToken(requestItem.season_number, tokenEpisodeNumber);
    const episodeRegex = new RegExp(episodeToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const isEpisodeMatch = episodeRegex.test(String(requestItem.matched_torrent_name || ''));
    const isComplete = isCompleteSeasonTitle(requestItem.matched_torrent_name);

    if (isEpisodeMatch) {
      const bumpTo = tokenEpisodeNumber + 1;
      await run(
        `UPDATE tv_season_requests
         SET status = ?, next_episode_number = ?,
             last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['monitoring', bumpTo, now, null, id]
      );
    } else if (isComplete) {
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['monitoring', now, null, id]
      );
    } else {
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['sent_to_qbit', now, null, id]
      );
    }

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, season_number, status, next_episode_number,
              last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds,
              created_at
       FROM tv_season_requests
       WHERE id = ?`,
      [id]
    );

    res.json(updated);
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      const { id } = req.params;
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['error', now, message, id]
      );
    } catch {
      // ignore
    }

    console.error('Erreur lors de l\'envoi à qBittorrent (tv_season_requests):', error);
    res.status(500).json({ error: message });
  }
}

export async function listTvSeasonRequestsHandler(req, res) {
  try {
    const items = await query(
      `SELECT tr.id, tr.user_id, tr.tmdb_id, tr.media_type, tr.title, tr.poster_url, tr.season_number,
              tr.status, tr.next_episode_number, tr.last_checked_at, tr.last_error,
              tr.matched_torrent_name, tr.matched_torrent_magnet, tr.matched_torrent_size, tr.matched_torrent_seeds,
              tr.created_at,
              u.username as requested_by
       FROM tv_season_requests tr
       LEFT JOIN users u ON u.id = tr.user_id
       ORDER BY tr.created_at DESC`
    );

    res.json(items || []);
  } catch (error) {
    logger.error('Erreur lors de la récupération du suivi tv_season_requests:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function getExistingSeasonsHandler(req, res) {
  try {
    const { tmdbId } = req.params;
    const { mediaType } = req.query; // optional, defaults to 'tv'

    const rows = await query(
      `SELECT season_number FROM tv_season_requests 
       WHERE tmdb_id = ? AND media_type = ?`,
      [tmdbId, mediaType || 'tv']
    );

    res.json(rows.map(r => r.season_number));
  } catch (error) {
    logger.error('Erreur lors de la récupération des saisons existantes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function createTvSeasonRequestsHandler(req, res) {
  try {
    const { tmdb_id, media_type, title, poster_url, season_numbers } = req.body;

    if (!tmdb_id || !media_type || !title) {
      return res.status(400).json({ error: 'tmdb_id, media_type et title sont requis' });
    }

    if (!['tv', 'anime'].includes(media_type)) {
      return res.status(400).json({ error: 'media_type doit être tv ou anime' });
    }

    if (!Array.isArray(season_numbers) || season_numbers.length === 0) {
      return res.status(400).json({ error: 'season_numbers est requis (tableau non vide)' });
    }

    const normalizedSeasons = Array.from(
      new Set(
        season_numbers
          .map((s) => Number(s))
          .filter((s) => Number.isInteger(s) && s > 0)
      )
    );

    if (normalizedSeasons.length === 0) {
      return res.status(400).json({ error: 'season_numbers doit contenir des entiers > 0' });
    }

    const now = new Date().toISOString();
    const created = [];
    const createdForAutoSearch = [];
    const conflicts = [];
    const presentConflicts = [];

    for (const seasonNumber of normalizedSeasons) {
      const existing = await get(
        `SELECT tr.id, tr.user_id, tr.tmdb_id, tr.media_type, tr.title, tr.season_number, u.username as requested_by
         FROM tv_season_requests tr
         LEFT JOIN users u ON u.id = tr.user_id
         WHERE tr.tmdb_id = ? AND tr.media_type = ? AND tr.season_number = ?`,
        [tmdb_id, media_type, seasonNumber]
      );

      if (existing) {
        conflicts.push({
          id: existing.id,
          tmdb_id: existing.tmdb_id,
          media_type: existing.media_type,
          title: existing.title,
          season_number: existing.season_number,
          requested_by: existing.requested_by
        });
        continue;
      }

      // Check presence for all episodes (single loop for both anti-doublon and decoration)
      let presentEpisodes = [];
      let missingEpisodes = [];
      try {
        const episodes = await tmdbService.getSeasonEpisodes(tmdb_id, seasonNumber);
        const episodeNumbers = episodes.map(e => e.episodeNumber);
        if (episodeNumbers.length > 0) {
          for (const ep of episodeNumbers) {
            // eslint-disable-next-line no-await-in-loop
            const p = await mediaInventoryService.isPresent({
              kind: 'tv',
              title,
              season: seasonNumber,
              episode: ep,
              tmdb_id
            });
            if (p?.present) {
              presentEpisodes.push(ep);
            } else {
              missingEpisodes.push(ep);
            }
          }
        }
      } catch {
        // if TMDB fails, don't block on season presence
      }

      // Anti-doublon: bloquer uniquement si TOUS les épisodes sont présents
      const allEpisodesPresent = presentEpisodes.length > 0 && missingEpisodes.length === 0;
      if (allEpisodesPresent) {
        presentConflicts.push({
          tmdb_id,
          media_type,
          title,
          season_number: seasonNumber,
          matches: []
        });
        continue;
      }

      const id = randomUUID();
      await run(
        `INSERT INTO tv_season_requests (
          id, user_id, tmdb_id, media_type, title, poster_url, season_number,
          status, next_episode_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.user.id,
          tmdb_id,
          media_type,
          title,
          poster_url || null,
          seasonNumber,
          'monitoring',
          1,
          now
        ]
      );

      created.push({
        id,
        user_id: req.user.id,
        tmdb_id,
        media_type,
        title,
        poster_url: poster_url || null,
        season_number: seasonNumber,
        status: 'monitoring',
        next_episode_number: 1,
        created_at: now,
        present_episodes: presentEpisodes,
        missing_episodes: missingEpisodes
      });

      if (missingEpisodes.length > 0) {
        createdForAutoSearch.push(id);
        logger.info(`[Library] Saison ${seasonNumber} de "${title}" ajoutée. ${missingEpisodes.length} épisodes manquants détectés.`);
      } else {
        logger.info(`[Library] Saison ${seasonNumber} de "${title}" ajoutée. Aucun épisode manquant détecté (scan auto ignoré).`);
      }
    }

    if (created.length === 0 && (conflicts.length > 0 || presentConflicts.length > 0)) {
      return res.status(409).json({
        error: presentConflicts.length > 0 ? 'Déjà présent dans la médiathèque' : 'Déjà demandé',
        existing: conflicts[0] || presentConflicts[0],
        conflicts,
        present_conflicts: presentConflicts
      });
    }

    res.status(201).json({ created, conflicts });

    // Auto-search immediately after creation (non-blocking)
    const autoOnCreate = !['0', 'false', 'no'].includes(String(process.env.AUTO_SEARCH_ON_CREATE || '').toLowerCase());
    if (autoOnCreate && createdForAutoSearch.length > 0) {
      setTimeout(() => {
        (async () => {
          const dbgOnCreate = ['1', 'true', 'yes'].includes(String(process.env.DEBUG_AUTOSEARCH_ON_CREATE || '').toLowerCase());
          logger.info(`[AutoSearch] Lancement du premier scan pour ${createdForAutoSearch.length} nouvelle(s) demande(s)...`);
          for (const id of createdForAutoSearch) {
            try {
              // Ensure auto-search runs as the request owner
              // eslint-disable-next-line no-await-in-loop
              const ownerRow = await get('SELECT user_id FROM tv_season_requests WHERE id = ?', [id]);
              // eslint-disable-next-line no-await-in-loop
              await autoSearchService.runAutoSearchForTvSeasonRequest({ requestId: id, userId: ownerRow?.user_id });
            } catch (err) {
              logger.error(`[AutoSearch][onCreate] Erreur (requestId=${id}):`, err);
            }
          }
        })().catch(() => {
          // ignore
        });
      }, 0);
    }
  } catch (error) {
    logger.error('Erreur lors de la création du suivi par saison:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function deleteTvSeasonRequestHandler(req, res) {
  try {
    const { id } = req.params;

    const existing = await get(
      'SELECT id, user_id FROM tv_season_requests WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, existing)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    await run(
      'DELETE FROM tv_season_request_history WHERE tv_season_request_id = ?',
      [id]
    );

    // Delete episode downloads (also handled by ON DELETE CASCADE, but explicit for safety)
    await run(
      'DELETE FROM tv_episode_downloads WHERE tv_season_request_id = ?',
      [id]
    );

    const result = await run(
      'DELETE FROM tv_season_requests WHERE id = ?',
      [id]
    );

    if (result && result.changes > 0) {
      res.json({ message: 'Supprimé du suivi' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  } catch (error) {
    logger.error('Erreur lors de la suppression du suivi tv_season_requests:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function searchLibraryItemHandler(req, res) {
  try {
    const { id } = req.params;

    const requestItem = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, release_date
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    if (!requestItem) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, requestItem)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const profiles = await getSetting('quality_profiles');
    const assignments = await getSetting('quality_profile_assignments');

    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;
    const year = requestItem.release_date ? String(requestItem.release_date).split('-')[0] : '';

    // Use centralized search service
    const searchOptions = {
      title: requestItem.title,
      year,
      tmdbId: requestItem.tmdb_id,
      minSeeds: 0, // En manuel, on veut tout voir
      filterByRelevance: true
    };

    const searchResults = requestItem.media_type === 'movie'
      ? await prowlarrSearchService.searchMovie(searchOptions)
      : await prowlarrSearchService.searchTvSeries({ ...searchOptions, mediaType: requestItem.media_type });

    const assignedProfile = loadAssignedQualityProfile(requestItem.media_type, profiles, assignments);

    const normalizedWithCompatibility = searchResults.map((r) => ({
      ...r,
      ...getResultCompatibility(r, assignedProfile)
    }));

    const now = new Date().toISOString();

    await run(
      `UPDATE media_requests
       SET last_checked_at = ?, last_error = ?
       WHERE id = ?`,
      [now, null, id]
    );

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, release_date, monitored, created_at,
              status, last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    res.json({
      request: {
        ...updated,
        monitored: !!updated?.monitored
      },
      results: normalizedWithCompatibility
    });
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      const { id } = req.params;
      await run(
        `UPDATE media_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['error', now, message, id]
      );
    } catch {
      // ignore
    }

    logger.error('Erreur lors de la recherche Prowlarr:', error);
    res.status(500).json({ error: message });
  }
}

export async function autoSearchLibraryItemHandler(req, res) {
  try {
    const { id } = req.params;

    const existing = await get(
      `SELECT id, user_id
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    const result = await autoSearchService.runAutoSearchForRequest({
      requestId: id,
      userId: existing.user_id
    });

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, release_date, monitored, created_at,
              status, last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    res.json({
      request: {
        ...updated,
        monitored: !!updated?.monitored
      },
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    logger.error('Erreur lors de la recherche automatique:', error);
    res.status(500).json({ error: message });
  }
}

export async function selectLibraryItemHandler(req, res) {
  try {
    const { id } = req.params;
    const { name, link, size, seeds } = req.body;

    if (!name || !link) {
      return res.status(400).json({ error: 'name et link sont requis' });
    }

    const existing = await get(
      'SELECT id, user_id FROM media_requests WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, existing)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    await run(
      `UPDATE media_requests
       SET status = ?,
           matched_torrent_name = ?,
           matched_torrent_magnet = ?,
           matched_torrent_size = ?,
           matched_torrent_seeds = ?,
           last_error = ?
       WHERE id = ?`,
      [
        'found',
        String(name),
        String(link),
        typeof size === 'number' ? size : null,
        typeof seeds === 'number' ? seeds : null,
        null,
        id
      ]
    );

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, release_date, monitored, created_at,
              status, last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    res.json({
      ...updated,
      monitored: !!updated?.monitored
    });
  } catch (error) {
    logger.error('Erreur lors de la sélection du torrent:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

export async function sendToQbitLibraryItemHandler(req, res) {
  try {
    const { id } = req.params;

    const force = !!req.body?.force;

    const requestItem = await get(
      `SELECT id, user_id, title, media_type, release_date, matched_torrent_magnet
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    if (!requestItem) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, requestItem)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    if (!requestItem.matched_torrent_magnet) {
      return res.status(400).json({ error: 'Aucun torrent sélectionné. Lancez une recherche d\'abord.' });
    }

    const year = requestItem.release_date ? Number(String(requestItem.release_date).split('-')[0]) : null;
    const presence = await mediaInventoryService.isPresent({
      kind: requestItem.media_type === 'movie' ? 'movie' : 'tv',
      title: requestItem.title,
      year: Number.isInteger(year) ? year : null
    });

    if (presence?.present && !force) {
      return res.status(409).json({
        error: 'Déjà présent dans la médiathèque',
        present: true,
        matches: presence.matches || []
      });
    }

    const category = inferQbitCategoryFromMediaType(requestItem.media_type) || 'Autres';

    await qBittorrentService.addTorrentUrlForUser(requestItem.user_id, requestItem.matched_torrent_magnet, {
      category,
      tags: buildQbitTagsString({ requestId: id })
    });

    const now = new Date().toISOString();
    await run(
      `UPDATE media_requests
       SET status = ?, last_checked_at = ?, last_error = ?
       WHERE id = ?`,
      ['sent_to_qbit', now, null, id]
    );

    const updated = await get(
      `SELECT id, user_id, tmdb_id, media_type, title, poster_url, release_date, monitored, created_at,
              status, last_checked_at, last_error,
              matched_torrent_name, matched_torrent_magnet, matched_torrent_size, matched_torrent_seeds
       FROM media_requests
       WHERE id = ?`,
      [id]
    );

    res.json({
      ...updated,
      monitored: !!updated?.monitored
    });
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      const { id } = req.params;
      await run(
        `UPDATE media_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ?`,
        ['error', now, message, id]
      );
    } catch {
      // ignore
    }

    logger.error('Erreur lors de l\'envoi à qBittorrent:', error);
    res.status(500).json({ error: message });
  }
}

export async function createLibraryItemHandler(req, res) {
  try {
    const { tmdb_id, media_type, title, poster_url, release_date } = req.body;

    if (!tmdb_id || !media_type || !title) {
      return res.status(400).json({ error: 'tmdb_id, media_type et title sont requis' });
    }

    if (!['movie', 'tv', 'anime'].includes(media_type)) {
      return res.status(400).json({ error: 'media_type doit être movie, tv ou anime' });
    }

    // 1) Priorité: inventaire local (empêche la création si déjà présent)
    const yearForPresence = release_date ? Number(String(release_date).split('-')[0]) : null;
    try {
      const presence = await mediaInventoryService.isPresent({
        kind: media_type === 'movie' ? 'movie' : 'tv',
        title,
        year: Number.isInteger(yearForPresence) ? yearForPresence : null,
        tmdb_id: tmdb_id || null
      });
      if (presence?.present) {
        return res.status(409).json({
          error: 'Déjà présent dans la médiathèque',
          present: true,
          matches: presence.matches || [],
          messages: ['Déjà présent dans la médiathèque']
        });
      }
    } catch {
      // ignore presence errors, continue with duplicate check
    }

    // 2) Si pas présent localement, vérifier une demande existante
    const existing = await get(
      `SELECT mr.id, mr.user_id, mr.tmdb_id, mr.media_type, mr.title, u.username as requested_by
       FROM media_requests mr
       LEFT JOIN users u ON u.id = mr.user_id
       WHERE mr.tmdb_id = ? AND mr.media_type = ?`,
      [tmdb_id, media_type]
    );

    // 3) Réponse combinée si déjà demandé (fallback si pas présent)
    if (existing) {
      const messages = [];
      messages.push(existing.requested_by ? `Déjà demandé par ${existing.requested_by}` : 'Déjà demandé');

      return res.status(409).json({
        error: 'Déjà demandé',
        existing: {
          id: existing.id,
          tmdb_id: existing.tmdb_id,
          media_type: existing.media_type,
          title: existing.title,
          requested_by: existing.requested_by
        },
        messages
      });
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO media_requests (
        id, user_id, tmdb_id, media_type, title, poster_url, release_date, status, monitored, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        tmdb_id,
        media_type,
        title,
        poster_url || null,
        release_date || null,
        'pending',
        1,
        now
      ]
    );

    res.status(201).json({
      id,
      user_id: req.user.id,
      tmdb_id,
      media_type,
      title,
      poster_url: poster_url || null,
      release_date: release_date || null,
      monitored: true,
      status: 'pending',
      created_at: now
    });

    // Auto-search immediately after creation (non-blocking)
    const autoOnCreate = !['0', 'false', 'no'].includes(String(process.env.AUTO_SEARCH_ON_CREATE || '').toLowerCase());
    if (autoOnCreate) {
      setTimeout(() => {
        logger.debug('autosearch', `Trigger onCreate`, { kind: 'media_request', id, media_type });
        autoSearchService
          .runAutoSearchForRequest({ requestId: id, userId: req.user?.id })
          .catch((err) => {
            logger.error(`[AutoSearch][onCreate] Erreur (media_request id=${id}):`, err);
          });
      }, 0);
    }
  } catch (error) {
    logger.error('Erreur lors de l\'ajout au suivi:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

export async function deleteLibraryItemHandler(req, res) {
  try {
    const { id } = req.params;

    const existing = await get(
      'SELECT id, user_id FROM media_requests WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Élément non trouvé' });
    }

    if (!canManageRequest(req, existing)) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    const result = await run(
      'DELETE FROM media_requests WHERE id = ?',
      [id]
    );

    await run(
      'DELETE FROM library_items WHERE id = ?',
      [id]
    );

    if (result && result.changes > 0) {
      res.json({ message: 'Supprimé du suivi' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du suivi:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
