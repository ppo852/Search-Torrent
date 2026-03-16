import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import { get, query, run } from '../core/db.js';
import { getSetting } from '../settings/index.js';
import qBittorrentService from '../qbittorrent/index.js';
import mediaInventoryService from '../media-inventory/index.js';
import {
  getProwlarrCategoryId,
  pickBestProwlarrLink,
  normalizeResults,
  isCompleteSeasonTitle
} from '../prowlarr/search.js';
import {
  titleContainsAny
} from '../utils/keywords.js';

function pad2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '00';
  return String(v).padStart(2, '0');
}

export async function runAutoSearchForTvSeasonEpisodeRequest({ requestId, userId, episodeNumber }) {
  const epNum = Number(episodeNumber);
  if (!Number.isFinite(epNum) || epNum <= 0) {
    return { status: 'invalid_episode_number' };
  }

  const requestItem = await get(
    `SELECT id, user_id, tmdb_id, media_type, title, season_number, status, next_episode_number
     FROM tv_season_requests
     WHERE id = ? AND user_id = ?`,
    [requestId, userId]
  );

  if (!requestItem) {
    return { status: 'not_found' };
  }

  const now = new Date().toISOString();

  try {
    const allEpisodes = await getSeasonEpisodesWithAirDates({
      tmdbId: requestItem.tmdb_id,
      seasonNumber: requestItem.season_number
    });

    const tmdbEpisode = (allEpisodes || []).find((e) => Number(e.episodeNumber) === epNum) || null;
    if (!tmdbEpisode) {
      return { status: 'episode_not_in_tmdb' };
    }

    // Check if episode already exists in history (any status except 'error')
    // This prevents re-downloads even if scan hasn't detected the file yet
    const historyRows = await query(
      `SELECT episode_number, status FROM tv_episode_downloads 
       WHERE tv_season_request_id = ? AND episode_number = ?`,
      [requestId, epNum]
    );
    const existingDownload = (historyRows || [])[0];

    if (existingDownload) {
      // If in history with status other than 'error', block re-download
      if (existingDownload.status !== 'error') {
        return { 
          status: 'already_in_history', 
          episode: epNum, 
          current_status: existingDownload.status 
        };
      }
      // If status is 'error', allow re-download (user must manually retry)
    }

    const present = await mediaInventoryService.isPresent({
      kind: 'tv',
      title: requestItem.title,
      year: null,
      season: requestItem.season_number,
      episode: epNum,
      tmdb_id: requestItem.tmdb_id
    });

    if (present?.present) {
      return { status: 'already_present', episode: epNum };
    }

    const airMs = tmdbEpisode.airDate ? new Date(tmdbEpisode.airDate).getTime() : null;
    const hasAired = !airMs || Number.isNaN(airMs) || airMs <= Date.now();
    if (!hasAired) {
      try {
        await run(
          `UPDATE tv_season_requests
           SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ?
           WHERE id = ? AND user_id = ?`,
          ['monitoring', epNum, now, null, requestId, userId]
        );
      } catch {
        // ignore
      }
      return { status: 'not_aired', episode: epNum };
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;
    const profile = await loadAssignedQualityProfile(requestItem.media_type);
    const qbitCategory = inferQbitCategory(requestItem.media_type);

    const results = await searchProwlarrTvSeason({
      title: requestItem.title,
      mediaType: requestItem.media_type,
      seasonNumber: requestItem.season_number,
      episodeNumber: epNum
    });

    const episodeToken = buildEpisodeToken(requestItem.season_number, epNum);
    const episodeRegex = buildEpisodeMatchRegex(requestItem.season_number, epNum) || new RegExp(episodeToken, 'i');
    const episodeResults = (results || []).filter((r) => episodeRegex.test(String(r?.name || '')));
    const filteredBySeeds = episodeResults.filter((r) => (r.seeds || 0) >= minSeeds);
    const filteredByProfile = applyQualityProfile(filteredBySeeds, profile);
    const sorted = sortResults(filteredByProfile, profile?.sort_by);
    const best = sorted[0] || null;

    if (!best) {
      await run(
        `UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
        ['monitoring', epNum, now, null, requestId, userId]
      );
      return { status: 'no_results', episode: epNum };
    }

    await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
      category: qbitCategory,
      tags: buildQbitTagsForTvSeasonRequest({
        requestId,
        seasonNumber: requestItem.season_number,
        episodeNumber: epNum
      })
    });

    await run(
      `INSERT OR REPLACE INTO tv_episode_downloads (id, tv_season_request_id, episode_number, status, torrent_name, torrent_magnet, torrent_size, torrent_seeds, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        requestId,
        epNum,
        'downloading',
        String(best.name),
        String(best.link),
        typeof best.size === 'number' ? best.size : null,
        typeof best.seeds === 'number' ? best.seeds : null,
        now
      ]
    );

    await run(
      `INSERT INTO tv_season_request_history (id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number, action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        requestId,
        userId,
        requestItem.tmdb_id,
        requestItem.media_type,
        requestItem.title,
        requestItem.season_number,
        epNum,
        'auto_download',
        String(best.name),
        String(best.link),
        typeof best.size === 'number' ? best.size : null,
        typeof best.seeds === 'number' ? best.seeds : null,
        now
      ]
    );

    await run(
      `UPDATE tv_season_requests
       SET status = ?, next_episode_number = ?,
           matched_torrent_name = ?, matched_torrent_magnet = ?,
           matched_torrent_size = ?, matched_torrent_seeds = ?,
           last_checked_at = ?, last_error = ?
       WHERE id = ? AND user_id = ?`,
      [
        'monitoring',
        epNum,
        String(best.name),
        String(best.link),
        typeof best.size === 'number' ? best.size : null,
        typeof best.seeds === 'number' ? best.seeds : null,
        now,
        null,
        requestId,
        userId
      ]
    );

    return { status: 'sent_episode', episode: epNum, selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error(`[AutoSearch] Erreur épisode TV id=${requestId} ep=${epNum}:`, error);

    try {
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        ['error', now, message, requestId, userId]
      );
    } catch {
      // ignore
    }

    return { status: 'error', error: message, episode: epNum };
  }
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

function buildSeasonMatchRegex(seasonNumber) {
  const s = Number(seasonNumber);
  if (!Number.isFinite(s)) return null;
  const sStr = String(s);
  return new RegExp(`S0*${sStr}`, 'i');
}

function parseDateToMs(value) {
  if (!value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function applyQualityProfile(results, profile) {
  if (!profile) return results;

  const minBytes = (profile.min_size_mb || 0) > 0 ? profile.min_size_mb * 1024 * 1024 : 0;
  const maxBytes = (profile.max_size_mb || 0) > 0 ? profile.max_size_mb * 1024 * 1024 : 0;

  const required = Array.isArray(profile.required_keywords) ? profile.required_keywords : [];
  const blocked = Array.isArray(profile.blocked_keywords) ? profile.blocked_keywords : [];

  return (results || [])
    .filter((r) => {
      const size = r.size || 0;
      if (minBytes > 0 && size > 0 && size < minBytes) return false;
      if (maxBytes > 0 && size > 0 && size > maxBytes) return false;
      if (required.length > 0 && !titleContainsAny(r.name, required)) return false;
      if (blocked.length > 0 && titleContainsAny(r.name, blocked)) return false;
      return true;
    });
}

function sortResults(results, sortBy) {
  const cloned = [...(results || [])];
  const sort = sortBy || 'seeds_desc';

  cloned.sort((a, b) => {
    if (sort === 'seeds_desc') return (b.seeds || 0) - (a.seeds || 0);
    if (sort === 'size_asc') return (a.size || 0) - (b.size || 0);
    if (sort === 'size_desc') return (b.size || 0) - (a.size || 0);
    if (sort === 'date_asc') return parseDateToMs(a.publishDate) - parseDateToMs(b.publishDate);
    if (sort === 'date_desc') return parseDateToMs(b.publishDate) - parseDateToMs(a.publishDate);
    return (b.seeds || 0) - (a.seeds || 0);
  });

  return cloned;
}

async function loadAssignedQualityProfile(mediaType) {
  const profiles = await getSetting('quality_profiles');
  const assignments = await getSetting('quality_profile_assignments');

  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const isMovie = mediaType === 'movie';
  const assignedId = isMovie ? assignments?.movie_profile_id : assignments?.tv_profile_id;

  if (!assignedId) return null;
  return safeProfiles.find((p) => p?.id === assignedId) || null;
}

async function searchProwlarr(requestItem) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const categoryId = getProwlarrCategoryId(requestItem.media_type);

  let queryText = requestItem.title;
  if (requestItem.media_type === 'movie' && requestItem.release_date) {
    const year = String(requestItem.release_date).split('-')[0];
    if (year) queryText = `${queryText} ${year}`;
  }

  const url = new URL('/api/v1/search', prowlarrUrl);
  url.searchParams.append('query', queryText);
  if (categoryId) {
    String(categoryId)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((id) => {
        url.searchParams.append('categories', id);
      });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Api-Key': prowlarrApiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prowlarr API error: ${response.status} - ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const results = Array.isArray(data) ? data : [];
  return normalizeResults(results);
}

async function getTmdbAccessToken() {
  const token = await getSetting('tmdb_access_token');
  return token ? String(token) : null;
}

async function getSeasonEpisodesCount({ tmdbId, seasonNumber }) {
  const token = await getTmdbAccessToken();
  if (!token) return null;

  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
  url.searchParams.append('language', 'fr-FR');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  const maxEpisode = episodes.reduce((acc, e) => {
    const n = Number(e?.episode_number);
    if (!Number.isInteger(n)) return acc;
    return Math.max(acc, n);
  }, 0);

  return maxEpisode > 0 ? maxEpisode : null;
}

/**
 * Get all episodes of a season with their air dates
 */
async function getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber }) {
  const token = await getTmdbAccessToken();
  if (!token) return [];

  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
  url.searchParams.append('language', 'fr-FR');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) return [];

  const data = await response.json().catch(() => null);
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  
  return episodes
    .map((e) => ({
      episodeNumber: Number(e?.episode_number),
      airDate: e?.air_date || null
    }))
    .filter((e) => Number.isInteger(e.episodeNumber) && e.episodeNumber > 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
}

async function isEpisodeAired({ tmdbId, seasonNumber, episodeNumber }) {
  const token = await getTmdbAccessToken();
  if (!token) return true;

  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
  url.searchParams.append('language', 'fr-FR');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return true;
  }

  const data = await response.json().catch(() => null);
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  const ep = episodes.find((e) => Number(e?.episode_number) === Number(episodeNumber)) || null;
  if (!ep) return false;

  if (!ep.air_date) return true;
  const airMs = new Date(ep.air_date).getTime();
  if (Number.isNaN(airMs)) return true;

  return airMs <= Date.now();
}

async function searchProwlarrTvSeason({ title, mediaType, seasonNumber, episodeNumber }) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const categoryId = getProwlarrCategoryId(mediaType);

  const runSearch = async (queryText) => {
    const url = new URL('/api/v1/search', prowlarrUrl);
    url.searchParams.append('query', queryText);
    if (categoryId) {
      String(categoryId)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((id) => {
          url.searchParams.append('categories', id);
        });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Api-Key': prowlarrApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Prowlarr API error: ${response.status} - ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const results = Array.isArray(data) ? data : [];
    return normalizeResults(results);
  };

  const episodeToken = buildEpisodeToken(seasonNumber, episodeNumber);
  const seasonToken = buildSeasonToken(seasonNumber);

  const episodeRegex = buildEpisodeMatchRegex(seasonNumber, episodeNumber) || new RegExp(episodeToken, 'i');
  const seasonRegex = buildSeasonMatchRegex(seasonNumber) || new RegExp(seasonToken, 'i');

  let results = await runSearch(`${title} ${episodeToken}`);
  results = results.filter((r) => episodeRegex.test(String(r?.name || '')));

  if (results.length === 0) {
    const seasonCandidates = await runSearch(`${title} ${seasonToken}`);
    results = seasonCandidates
      .filter((r) => seasonRegex.test(String(r?.name || '')))
      .filter((r) => isCompleteSeasonTitle(r?.name));
  }

  return results;
}

function inferQbitCategory(mediaType) {
  return mediaType === 'movie' ? 'Films' : mediaType === 'anime' ? 'Anime' : 'Séries';
}

function buildQbitTagsForTvSeasonRequest({ requestId, seasonNumber, episodeNumber }) {
  const tags = [`st`, `st:req:${String(requestId)}`];
  if (Number.isFinite(Number(seasonNumber))) tags.push(`st:s:${String(seasonNumber)}`);
  if (Number.isFinite(Number(episodeNumber))) tags.push(`st:e:${String(episodeNumber)}`);
  return tags.join(',');
}

export async function runAutoSearchForRequest({ requestId, userId }) {
  const requestItem = await get(
    `SELECT id, user_id, tmdb_id, media_type, title, release_date, status
     FROM media_requests
     WHERE id = ? AND user_id = ?`,
    [requestId, userId]
  );

  if (!requestItem) {
    return { status: 'not_found' };
  }

  if (requestItem.status === 'sent_to_qbit') {
    return { status: 'already_sent' };
  }

  const now = new Date().toISOString();

  try {
    const year = requestItem.release_date ? Number(String(requestItem.release_date).split('-')[0]) : null;
    const present = await mediaInventoryService.isPresent({
      kind: requestItem.media_type === 'movie' ? 'movie' : 'tv',
      title: requestItem.title,
      year: Number.isInteger(year) ? year : null
    });

    if (present?.present) {
      await run(
        `UPDATE media_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        ['already_available', now, null, requestId, userId]
      );
      return { status: 'already_available', matches: present.matches || [] };
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    const profile = await loadAssignedQualityProfile(requestItem.media_type);

    const allResults = await searchProwlarr(requestItem);

    const filteredBySeeds = allResults.filter((r) => (r.seeds || 0) >= minSeeds);
    const filteredByProfile = applyQualityProfile(filteredBySeeds, profile);
    const sorted = sortResults(filteredByProfile, profile?.sort_by);

    const best = sorted[0] || null;

    await run(
      `UPDATE media_requests
       SET last_checked_at = ?, last_error = ?
       WHERE id = ? AND user_id = ?`,
      [now, null, requestId, userId]
    );

    if (!best) {
      return { status: 'no_results' };
    }

    await run(
      `UPDATE media_requests
       SET status = ?,
           matched_torrent_name = ?,
           matched_torrent_magnet = ?,
           matched_torrent_size = ?,
           matched_torrent_seeds = ?,
           last_error = ?,
           last_checked_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        'found',
        String(best.name),
        String(best.link),
        typeof best.size === 'number' ? best.size : null,
        typeof best.seeds === 'number' ? best.seeds : null,
        null,
        now,
        requestId,
        userId
      ]
    );

    await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
      category: inferQbitCategory(requestItem.media_type)
    });

    await run(
      `UPDATE media_requests
       SET status = ?, last_checked_at = ?, last_error = ?
       WHERE id = ? AND user_id = ?`,
      ['sent_to_qbit', now, null, requestId, userId]
    );

    return { status: 'sent', selected: best };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    try {
      await run(
        `UPDATE media_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        ['error', now, message, requestId, userId]
      );
    } catch {
      // ignore
    }

    return { status: 'error', error: message };
  }
}

export async function runAutoSearchForTvSeasonRequest({ requestId, userId }) {
  const requestItem = await get(
    `SELECT id, user_id, tmdb_id, media_type, title, season_number, status, next_episode_number
     FROM tv_season_requests
     WHERE id = ? AND user_id = ?`,
    [requestId, userId]
  );

  if (!requestItem) {
    return { status: 'not_found' };
  }

  if (requestItem.status === 'sent_to_qbit' || requestItem.status === 'completed') {
    return { status: 'already_sent' };
  }

  const now = new Date().toISOString();

  try {
    // Get all episodes of the season from TMDB
    const allEpisodes = await getSeasonEpisodesWithAirDates({
      tmdbId: requestItem.tmdb_id,
      seasonNumber: requestItem.season_number
    });

    if (allEpisodes.length === 0) {
      await run(
        `UPDATE tv_season_requests SET last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
        [now, 'Impossible de récupérer les épisodes depuis TMDB', requestId, userId]
      );
      return { status: 'error', error: 'No episodes found in TMDB' };
    }

    const dbgPresence = String(process.env.DEBUG_AUTOSEARCH_PRESENCE || '').toLowerCase() === '1';
    const totalEpisodes = allEpisodes.length;
    const nowMs = Date.now();

    // Get episodes already downloading (to avoid re-downloading)
    const downloadingRows = await query(
      `SELECT episode_number FROM tv_episode_downloads WHERE tv_season_request_id = ? AND status = 'downloading'`,
      [requestId]
    );
    const alreadyDownloading = new Set((downloadingRows || []).map(r => r.episode_number));

    // Find all missing episodes (not present in media-inventory AND already aired AND not already downloading)
    const missingEpisodes = [];
    const presentEpisodes = [];
    const downloadingEpisodes = [];

    for (const ep of allEpisodes) {
      // Check if episode is already present
      // eslint-disable-next-line no-await-in-loop
      const present = await mediaInventoryService.isPresent({
        kind: 'tv',
        title: requestItem.title,
        year: null,
        season: requestItem.season_number,
        episode: ep.episodeNumber,
        tmdb_id: requestItem.tmdb_id
      });

      if (dbgPresence) {
        console.log('[AutoSearch][presence]', {
          title: requestItem.title,
          tmdb_id: requestItem.tmdb_id,
          season: requestItem.season_number,
          episode: ep.episodeNumber,
          isPresent: !!present?.present,
          alreadyDownloading: alreadyDownloading.has(ep.episodeNumber),
          matches: Array.isArray(present?.matches)
            ? present.matches.slice(0, 2).map((m) => ({ season: m.season, episode: m.episode, title: m.title, path: m.path, tmdb_id: m.tmdb_id }))
            : []
        });
      }

      if (present?.present) {
        presentEpisodes.push(ep.episodeNumber);
        // Mark download as completed if it was downloading
        if (alreadyDownloading.has(ep.episodeNumber)) {
          // eslint-disable-next-line no-await-in-loop
          await run(
            `UPDATE tv_episode_downloads SET status = 'completed', completed_at = ? WHERE tv_season_request_id = ? AND episode_number = ?`,
            [now, requestId, ep.episodeNumber]
          );
        }
        continue;
      }

      // Skip if already downloading
      if (alreadyDownloading.has(ep.episodeNumber)) {
        downloadingEpisodes.push(ep.episodeNumber);
        continue;
      }

      // Check if episode has aired
      const airMs = ep.airDate ? new Date(ep.airDate).getTime() : null;
      const hasAired = !airMs || Number.isNaN(airMs) || airMs <= nowMs;

      if (hasAired) {
        missingEpisodes.push(ep.episodeNumber);
      }
    }

    console.log(`[AutoSearch] Saison ${requestItem.title} S${String(requestItem.season_number).padStart(2, '0')}: ${presentEpisodes.length}/${totalEpisodes} présents, ${downloadingEpisodes.length} en téléchargement, ${missingEpisodes.length} manquants à chercher`);

    // If all episodes are present, mark as completed
    if (missingEpisodes.length === 0) {
      if (presentEpisodes.length === totalEpisodes) {
        await run(
          `UPDATE tv_season_requests SET status = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
          ['completed', now, null, requestId, userId]
        );
        return { status: 'completed_season' };
      }
      // Some episodes not aired yet
      await run(
        `UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
        ['monitoring', Math.max(...presentEpisodes, 0) + 1, now, null, requestId, userId]
      );
      return { status: 'not_aired', presentCount: presentEpisodes.length, totalCount: totalEpisodes };
    }

    const minSeedsSetting = await getSetting('min_seeds');
    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;
    const profile = await loadAssignedQualityProfile(requestItem.media_type);
    const qbitCategory = inferQbitCategory(requestItem.media_type);

    // First, try to find a complete season pack
    const seasonPackResults = await searchProwlarrTvSeason({
      title: requestItem.title,
      mediaType: requestItem.media_type,
      seasonNumber: requestItem.season_number,
      episodeNumber: 1 // Will search for season pack
    });

    const seasonPacks = seasonPackResults.filter((r) => isCompleteSeasonTitle(r?.name));
    const filteredPacks = applyQualityProfile(
      seasonPacks.filter((r) => (r.seeds || 0) >= minSeeds),
      profile
    );
    const sortedPacks = sortResults(filteredPacks, profile?.sort_by);
    const bestPack = sortedPacks[0] || null;

    if (bestPack) {
      console.log(`[AutoSearch] Pack saison trouvé: "${bestPack.name}" (${bestPack.seeds} seeds)`);
      await qBittorrentService.addTorrentUrlForUser(userId, bestPack.link, {
        category: qbitCategory,
        tags: buildQbitTagsForTvSeasonRequest({ requestId, seasonNumber: requestItem.season_number })
      });
      
      // Mark all missing episodes as downloading (season pack)
      for (const epNum of missingEpisodes) {
        // eslint-disable-next-line no-await-in-loop
        await run(
          `INSERT OR REPLACE INTO tv_episode_downloads (id, tv_season_request_id, episode_number, status, torrent_name, torrent_magnet, torrent_size, torrent_seeds, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), requestId, epNum, 'downloading', String(bestPack.name), String(bestPack.link),
           typeof bestPack.size === 'number' ? bestPack.size : null,
           typeof bestPack.seeds === 'number' ? bestPack.seeds : null, now]
        );
      }

      // Add to history (season pack)
      await run(
        `INSERT INTO tv_season_request_history (id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number, action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), requestId, userId, requestItem.tmdb_id, requestItem.media_type, requestItem.title,
         requestItem.season_number, null, 'auto_download_pack',
         String(bestPack.name), String(bestPack.link),
         typeof bestPack.size === 'number' ? bestPack.size : null,
         typeof bestPack.seeds === 'number' ? bestPack.seeds : null, now]
      );

      await run(
        `UPDATE tv_season_requests
         SET status = ?, matched_torrent_name = ?, matched_torrent_magnet = ?,
             matched_torrent_size = ?, matched_torrent_seeds = ?,
             last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        ['sent_to_qbit', String(bestPack.name), String(bestPack.link),
         typeof bestPack.size === 'number' ? bestPack.size : null,
         typeof bestPack.seeds === 'number' ? bestPack.seeds : null,
         now, null, requestId, userId]
      );
      return { status: 'sent_season_pack', selected: bestPack };
    }

    // No season pack found, search for each missing episode individually
    const downloadedEpisodes = [];
    const notFoundEpisodes = [];

    for (const epNum of missingEpisodes) {
      // eslint-disable-next-line no-await-in-loop
      const results = await searchProwlarrTvSeason({
        title: requestItem.title,
        mediaType: requestItem.media_type,
        seasonNumber: requestItem.season_number,
        episodeNumber: epNum
      });

      const episodeToken = buildEpisodeToken(requestItem.season_number, epNum);
      const episodeRegex = buildEpisodeMatchRegex(requestItem.season_number, epNum) || new RegExp(episodeToken, 'i');

      // Filter results that match this specific episode
      const episodeResults = results.filter((r) => episodeRegex.test(String(r?.name || '')));
      const filteredBySeeds = episodeResults.filter((r) => (r.seeds || 0) >= minSeeds);
      const filteredByProfile = applyQualityProfile(filteredBySeeds, profile);
      const sorted = sortResults(filteredByProfile, profile?.sort_by);
      const best = sorted[0] || null;

      if (best) {
        console.log(`[AutoSearch] Episode S${String(requestItem.season_number).padStart(2, '0')}E${String(epNum).padStart(2, '0')} trouvé: "${best.name}" (${best.seeds} seeds)`);
        // eslint-disable-next-line no-await-in-loop
        await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
          category: qbitCategory,
          tags: buildQbitTagsForTvSeasonRequest({ requestId, seasonNumber: requestItem.season_number, episodeNumber: epNum })
        });
        
        // Track episode as downloading
        // eslint-disable-next-line no-await-in-loop
        await run(
          `INSERT OR REPLACE INTO tv_episode_downloads (id, tv_season_request_id, episode_number, status, torrent_name, torrent_magnet, torrent_size, torrent_seeds, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), requestId, epNum, 'downloading', String(best.name), String(best.link),
           typeof best.size === 'number' ? best.size : null,
           typeof best.seeds === 'number' ? best.seeds : null, now]
        );

        // Add to history
        // eslint-disable-next-line no-await-in-loop
        await run(
          `INSERT INTO tv_season_request_history (id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number, action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), requestId, userId, requestItem.tmdb_id, requestItem.media_type, requestItem.title,
           requestItem.season_number, epNum, 'auto_download',
           String(best.name), String(best.link),
           typeof best.size === 'number' ? best.size : null,
           typeof best.seeds === 'number' ? best.seeds : null, now]
        );
        
        downloadedEpisodes.push({ episode: epNum, torrent: best });
      } else {
        console.log(`[AutoSearch] Episode S${String(requestItem.season_number).padStart(2, '0')}E${String(epNum).padStart(2, '0')} non trouvé`);
        notFoundEpisodes.push(epNum);
      }
    }

    // Update request status
    const nextEpisode = notFoundEpisodes.length > 0 
      ? Math.min(...notFoundEpisodes) 
      : Math.max(...allEpisodes.map(e => e.episodeNumber)) + 1;

    if (downloadedEpisodes.length > 0) {
      const lastDownloaded = downloadedEpisodes[downloadedEpisodes.length - 1];
      await run(
        `UPDATE tv_season_requests
         SET status = ?, next_episode_number = ?,
             matched_torrent_name = ?, matched_torrent_magnet = ?,
             matched_torrent_size = ?, matched_torrent_seeds = ?,
             last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        [
          notFoundEpisodes.length > 0 ? 'monitoring' : 'sent_to_qbit',
          nextEpisode,
          String(lastDownloaded.torrent.name),
          String(lastDownloaded.torrent.link),
          typeof lastDownloaded.torrent.size === 'number' ? lastDownloaded.torrent.size : null,
          typeof lastDownloaded.torrent.seeds === 'number' ? lastDownloaded.torrent.seeds : null,
          now, null, requestId, userId
        ]
      );

      return {
        status: 'sent_batch',
        downloadedCount: downloadedEpisodes.length,
        notFoundCount: notFoundEpisodes.length,
        notFoundEpisodes,
        downloaded: downloadedEpisodes
      };
    }

    // No episodes found at all
    await run(
      `UPDATE tv_season_requests SET status = ?, next_episode_number = ?, last_checked_at = ?, last_error = ? WHERE id = ? AND user_id = ?`,
      ['monitoring', nextEpisode, now, null, requestId, userId]
    );

    return { status: 'no_results', notFoundEpisodes };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error(`[AutoSearch] Erreur saison TV id=${requestId}:`, error);

    try {
      await run(
        `UPDATE tv_season_requests
         SET status = ?, last_checked_at = ?, last_error = ?
         WHERE id = ? AND user_id = ?`,
        ['error', now, message, requestId, userId]
      );
    } catch {
      // ignore
    }

    return { status: 'error', error: message };
  }
}

export async function runAutoSearchOnce() {
  console.log('[AutoSearch] Démarrage du cycle de recherche automatique...');

  const pending = await query(
    `SELECT id, user_id
     FROM media_requests
     WHERE status IN ('pending','error')
     ORDER BY created_at ASC
     LIMIT 50`
  );

  const tvMonitoring = await query(
    `SELECT id, user_id
     FROM tv_season_requests
     WHERE status IN ('monitoring','error')
     ORDER BY created_at ASC
     LIMIT 50`
  );

  console.log(`[AutoSearch] Films en attente: ${(pending || []).length}, Saisons TV en monitoring: ${(tvMonitoring || []).length}`);

  const results = [];
  for (const row of pending || []) {
    console.log(`[AutoSearch] Traitement film id=${row.id}`);
    const r = await runAutoSearchForRequest({ requestId: row.id, userId: row.user_id });
    console.log(`[AutoSearch] Film id=${row.id} => ${r?.status}`);
    results.push({ id: row.id, user_id: row.user_id, result: r });
  }

  for (const row of tvMonitoring || []) {
    console.log(`[AutoSearch] Traitement saison TV id=${row.id}`);
    const r = await runAutoSearchForTvSeasonRequest({ requestId: row.id, userId: row.user_id });
    console.log(`[AutoSearch] Saison TV id=${row.id} => ${r?.status}`);
    results.push({ id: row.id, user_id: row.user_id, result: r, kind: 'tv_season_request' });
  }

  console.log(`[AutoSearch] Cycle terminé. ${results.length} demandes traitées.`);
  return results;
}

export default {
  runAutoSearchOnce,
  runAutoSearchForRequest,
  runAutoSearchForTvSeasonRequest,
  runAutoSearchForTvSeasonEpisodeRequest
};
