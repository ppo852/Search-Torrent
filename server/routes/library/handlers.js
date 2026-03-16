import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { get, query, run } from '../../services/core/db.js';
import { getSetting } from '../../services/settings/index.js';
import FormData from 'form-data';
import qBittorrentService from '../../services/qbittorrent/index.js';
import autoSearchService from '../../services/auto-search/index.js';
import mediaInventoryService from '../../services/media-inventory/index.js';
import prowlarrSearchService, {
  getProwlarrCategoryId,
  pickBestProwlarrLink,
  getTmdbMovieTitleVariants,
  isCompleteSeasonTitle
} from '../../services/prowlarr/search.js';
import {
  flattenKeywords,
  titleContainsAny
} from '../../services/utils/keywords.js';

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
    console.error('Erreur lors de la récupération de l\'historique TV:', error);
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
    console.error('Erreur lors de la recherche automatique (tv_season_requests):', error);
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

    const episodeNumbers = await getTmdbSeasonEpisodeNumbers(season.tmdb_id, season.season_number);
    
    // Get episodes already completed (never re-check these)
    const completedRows = await query(
      `SELECT episode_number FROM tv_episode_downloads
       WHERE tv_season_request_id = ? AND status = 'completed'`,
      [id]
    );
    const completedEpisodes = new Set((completedRows || []).map(r => r.episode_number));
    
    // Get episodes currently downloading
    const downloadingRows = await query(
      `SELECT episode_number, sent_at, torrent_name
       FROM tv_episode_downloads
       WHERE tv_season_request_id = ? AND status = 'downloading'`,
      [id]
    );
    let downloadingEpisodes = (downloadingRows || []).map(r => r.episode_number);

    const staleMs = 60 * 60 * 1000;
    const nowMs = Date.now();
    const staleRows = (downloadingRows || []).filter((r) => {
      const sentMs = r?.sent_at ? new Date(r.sent_at).getTime() : NaN;
      // Never check stale for episodes already completed
      return Number.isFinite(sentMs) && (nowMs - sentMs) > staleMs && !completedEpisodes.has(r.episode_number);
    });

    const errorEpisodesSet = new Set();
    if (staleRows.length > 0) {
      try {
        const qbitUser = await qBittorrentService.getQBitUserInfo(null, season.user_id);
        if (qbitUser?.qbit_url) {
          const qbitUrl = qbitUser.qbit_url.trim().replace(/\/+$/, '');
          let cookies = '';
          if (qbitUser.qbit_username && qbitUser.qbit_password) {
            cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, qbitUser.qbit_username, qbitUser.qbit_password);
          }

          const torrents = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/info`, {
            headers: {
              'Cookie': cookies,
              'Referer': qbitUrl
            }
          });

          const torrentNames = new Set((torrents || []).map((t) => String(t?.name || '')));
          const wantedTag = `st:req:${String(id)}`;
          const torrentsForThisRequest = new Set(
            (torrents || [])
              .filter((t) => String(t?.tags || '').split(',').map((x) => x.trim()).includes(wantedTag))
              .map((t) => String(t?.name || ''))
          );
          const nowIso = new Date().toISOString();

          for (const row of staleRows) {
            const tname = String(row?.torrent_name || '').trim();
            if (!tname) continue;
            const existsByTag = torrentsForThisRequest.size > 0 ? torrentsForThisRequest.has(tname) : null;
            const exists = existsByTag === null ? torrentNames.has(tname) : existsByTag;
            if (!exists) {
              errorEpisodesSet.add(row.episode_number);
              // eslint-disable-next-line no-await-in-loop
              await run(
                `UPDATE tv_episode_downloads SET status = 'error' WHERE tv_season_request_id = ? AND episode_number = ?`,
                [id, row.episode_number]
              );
              // eslint-disable-next-line no-await-in-loop
              await run(
                `INSERT INTO tv_season_request_history (id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number, action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  randomUUID(),
                  id,
                  season.user_id,
                  season.tmdb_id,
                  season.media_type,
                  season.title,
                  season.season_number,
                  row.episode_number,
                  'download_missing_in_qbit',
                  tname,
                  null,
                  null,
                  null,
                  nowIso
                ]
              );
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (errorEpisodesSet.size > 0) {
      downloadingEpisodes = downloadingEpisodes.filter((ep) => !errorEpisodesSet.has(ep));
    }

    const present = [];
    const downloading = [];
    const missing = [];
    const errorEpisodes = [];
    
    for (const ep of episodeNumbers) {
      // If episode is already completed, always show as present (never re-check)
      if (completedEpisodes.has(ep)) {
        present.push(ep);
        continue;
      }
      
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
        // If episode is now present, mark download as completed
        if (downloadingEpisodes.includes(ep)) {
          // eslint-disable-next-line no-await-in-loop
          await run(
            `UPDATE tv_episode_downloads SET status = 'completed', completed_at = ? WHERE tv_season_request_id = ? AND episode_number = ?`,
            [new Date().toISOString(), id, ep]
          );
        }
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

async function getTmdbSeasonEpisodeNumbers(tmdbId, seasonNumber) {
  const token = await getSetting('tmdb_access_token');
  if (!token) return [];
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
  url.searchParams.append('language', 'en-US');
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${String(token)}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  const nums = episodes
    .map((e) => Number(e?.episode_number))
    .filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function getResultCompatibility(result, profile) {
  if (!profile) return { is_compatible: true, incompatible_reason: null };

  const minMb = typeof profile.min_size_mb === 'number' ? profile.min_size_mb : 0;
  const maxMb = typeof profile.max_size_mb === 'number' ? profile.max_size_mb : 0;
  const minBytes = minMb > 0 ? minMb * 1024 * 1024 : 0;
  const maxBytes = maxMb > 0 ? maxMb * 1024 * 1024 : 0;
  const required = Array.isArray(profile.required_keywords) ? profile.required_keywords : [];
  const blocked = Array.isArray(profile.blocked_keywords) ? profile.blocked_keywords : [];

  const size = result?.size || 0;
  if (minBytes > 0 && size > 0 && size < minBytes) {
    return { is_compatible: false, incompatible_reason: `Taille trop petite (min ${minMb} MB)` };
  }
  if (maxBytes > 0 && size > 0 && size > maxBytes) {
    return { is_compatible: false, incompatible_reason: `Taille trop grande (max ${maxMb} MB)` };
  }
  if (required.length > 0 && !titleContainsAny(result?.name, required)) {
    const flat = flattenKeywords(required);
    return { is_compatible: false, incompatible_reason: `Aucun mot-clé requis trouvé: ${flat.join(', ')}` };
  }
  if (blocked.length > 0 && titleContainsAny(result?.name, blocked)) {
    const flat = flattenKeywords(blocked);
    return { is_compatible: false, incompatible_reason: `Mots-clés bloqués détectés: ${flat.join(', ')}` };
  }
  return { is_compatible: true, incompatible_reason: null };
}

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

    const prowlarrUrl = await getSetting('prowlarr_url');
    const prowlarrApiKey = await getSetting('prowlarr_api_key');
    const minSeedsSetting = await getSetting('min_seeds');
    const profiles = await getSetting('quality_profiles');
    const assignments = await getSetting('quality_profile_assignments');

    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;
    if (!prowlarrUrl || !prowlarrApiKey) {
      return res.status(400).json({ error: 'Prowlarr non configuré' });
    }

    const categoryId = getProwlarrCategoryId(requestItem.media_type);
    const episodeToken = buildEpisodeToken(requestItem.season_number, targetEpisodeNumber);

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
      return results
        .map(item => ({
          name: item.title,
          link: pickBestProwlarrLink(item),
          size: item.size || 0,
          seeds: item.seeders || 0,
          leech: item.peers || 0,
          engine_url: item.indexer || '',
          desc_link: item.infoUrl || '',
          publishDate: item.publishDate || item.pubDate || null
        }))
        .filter(item => item.link)
        .filter(item => item.seeds >= minSeeds);
    };

    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const assignedProfileId = assignments?.tv_profile_id;
    const assignedProfile = assignedProfileId
      ? safeProfiles.find((p) => p?.id === assignedProfileId) || null
      : null;

    const episodeRegex = buildEpisodeMatchRegex(requestItem.season_number, targetEpisodeNumber) ||
      new RegExp(episodeToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    let normalized = await runSearch(`${requestItem.title} ${episodeToken}`);
    normalized = normalized.filter((r) => episodeRegex.test(String(r.name || '')));

    const normalizedWithCompatibility = normalized.map((r) => ({
      ...r,
      ...getResultCompatibility(r, assignedProfile)
    }));

    const now = new Date().toISOString();
    await run(
      `UPDATE tv_season_requests
       SET last_checked_at = ?, last_error = ?
       WHERE id = ?`,
      [now, null, id]
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

    res.json({ request: updated, episode_number: targetEpisodeNumber, results: normalizedWithCompatibility });
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

    const prowlarrUrl = await getSetting('prowlarr_url');
    const prowlarrApiKey = await getSetting('prowlarr_api_key');
    const minSeedsSetting = await getSetting('min_seeds');
    const profiles = await getSetting('quality_profiles');
    const assignments = await getSetting('quality_profile_assignments');

    const minSeeds = typeof minSeedsSetting === 'number' ? minSeedsSetting : 3;

    if (!prowlarrUrl || !prowlarrApiKey) {
      return res.status(400).json({ error: 'Prowlarr non configuré' });
    }

    const categoryId = getProwlarrCategoryId(requestItem.media_type);

    const episodeToken = buildEpisodeToken(requestItem.season_number, requestItem.next_episode_number);
    const seasonToken = buildSeasonToken(requestItem.season_number);

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
      return results
        .map(item => ({
          name: item.title,
          link: pickBestProwlarrLink(item),
          size: item.size || 0,
          seeds: item.seeders || 0,
          leech: item.peers || 0,
          engine_url: item.indexer || '',
          desc_link: item.infoUrl || '',
          publishDate: item.publishDate || item.pubDate || null
        }))
        .filter(item => item.link)
        .filter(item => item.seeds >= minSeeds);
    };

    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const assignedProfileId = assignments?.tv_profile_id;
    const assignedProfile = assignedProfileId
      ? safeProfiles.find((p) => p?.id === assignedProfileId) || null
      : null;

    const episodeRegex = new RegExp(episodeToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const seasonRegex = new RegExp(seasonToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    let normalized = await runSearch(`${requestItem.title} ${episodeToken}`);
    normalized = normalized.filter((r) => episodeRegex.test(String(r.name || '')));

    if (normalized.length === 0) {
      const seasonCandidates = await runSearch(`${requestItem.title} ${seasonToken}`);
      normalized = seasonCandidates
        .filter((r) => seasonRegex.test(String(r.name || '')))
        .filter((r) => isCompleteSeasonTitle(r.name));
    }

    const normalizedWithCompatibility = normalized.map((r) => ({
      ...r,
      ...getResultCompatibility(r, assignedProfile)
    }));

    const now = new Date().toISOString();
    await run(
      `UPDATE tv_season_requests
       SET last_checked_at = ?, last_error = ?
       WHERE id = ?`,
      [now, null, id]
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

    res.json({ request: updated, results: normalizedWithCompatibility });
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

    const user = await qBittorrentService.getQBitUserInfo(null, requestItem.user_id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    const formData = new FormData();
    formData.append('urls', requestItem.matched_torrent_magnet);

    const category = requestItem.media_type === 'anime' ? 'Anime' : 'Séries';
    formData.append('category', category);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    const now = new Date().toISOString();
    const tokenEpisodeNumber = targetEpisodeNumber ?? requestItem.next_episode_number;

    try {
      await run(
        `INSERT INTO tv_season_request_history (
          id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number,
          action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          id,
          requestItem.user_id,
          requestItem.tmdb_id ?? null,
          requestItem.media_type,
          requestItem.title,
          requestItem.season_number,
          tokenEpisodeNumber,
          force ? 'sent_forced' : 'sent',
          requestItem.matched_torrent_name || null,
          requestItem.matched_torrent_magnet || null,
          typeof requestItem.matched_torrent_size === 'number' ? requestItem.matched_torrent_size : null,
          typeof requestItem.matched_torrent_seeds === 'number' ? requestItem.matched_torrent_seeds : null,
          now
        ]
      );
    } catch {
      // ignore history errors
    }
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
        ['sent_to_qbit', now, null, id]
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
    console.error('Erreur lors de la récupération du suivi tv_season_requests:', error);
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
        const episodeNumbers = await getTmdbSeasonEpisodeNumbers(tmdb_id, seasonNumber);
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
          if (dbgOnCreate) {
            console.log('[AutoSearch][onCreate] Trigger', { count: createdForAutoSearch.length });
          }
          for (const id of createdForAutoSearch) {
            try {
              // Ensure auto-search runs as the request owner
              // eslint-disable-next-line no-await-in-loop
              const ownerRow = await get('SELECT user_id FROM tv_season_requests WHERE id = ?', [id]);
              // eslint-disable-next-line no-await-in-loop
              await autoSearchService.runAutoSearchForTvSeasonRequest({ requestId: id, userId: ownerRow?.user_id });
            } catch (err) {
              console.error(`[AutoSearch][onCreate] Erreur (requestId=${id}):`, err);
            }
          }
        })().catch(() => {
          // ignore
        });
      }, 0);
    }
  } catch (error) {
    console.error('Erreur lors de la création du suivi par saison:', error);
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
    console.error('Erreur lors de la suppression du suivi tv_season_requests:', error);
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
    const searchResults = await prowlarrSearchService.searchMovie({
      title: requestItem.title,
      year,
      tmdbId: requestItem.tmdb_id,
      minSeeds,
      filterByRelevance: true
    });

    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const assignedProfileId = requestItem.media_type === 'movie'
      ? assignments?.movie_profile_id
      : assignments?.tv_profile_id;
    const assignedProfile = assignedProfileId
      ? safeProfiles.find((p) => p?.id === assignedProfileId) || null
      : null;

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

    console.error('Erreur lors de la recherche Prowlarr:', error);
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
    console.error('Erreur lors de la recherche automatique:', error);
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
    console.error('Erreur lors de la sélection du torrent:', error);
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

    const user = await qBittorrentService.getQBitUserInfo(null, requestItem.user_id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    const formData = new FormData();
    formData.append('urls', requestItem.matched_torrent_magnet);

    // Catégorie simple par type (on raffinera plus tard via Admin)
    const category = requestItem.media_type === 'movie' ? 'Films' : requestItem.media_type === 'anime' ? 'Anime' : 'Séries';
    formData.append('category', category);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
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

    console.error('Erreur lors de l\'envoi à qBittorrent:', error);
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
        const dbgOnCreate = ['1', 'true', 'yes'].includes(String(process.env.DEBUG_AUTOSEARCH_ON_CREATE || '').toLowerCase());
        if (dbgOnCreate) {
          console.log('[AutoSearch][onCreate] Trigger', { kind: 'media_request', id, media_type });
        }
        autoSearchService
          .runAutoSearchForRequest({ requestId: id, userId: req.user?.id })
          .catch((err) => {
            console.error(`[AutoSearch][onCreate] Erreur (media_request id=${id}):`, err);
          });
      }, 0);
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout au suivi:', error);
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
