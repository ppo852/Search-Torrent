/**
 * Téléchargement 1-clic (fiche interactive) — meilleur torrent, sans créer de demande.
 * SEARCH_MODE.INTERACTIVE (défaut des searchMovie / searchTvSeries).
 */

import qBittorrentService from '../qbittorrent/index.js';
import { getAutoSearchContext } from '../auto-search/index.js';
import { checkInteractiveInventoryDuplicate } from '../qbittorrent/inventory-guard.js';
import tmdbService from '../tmdb/index.js';
import logger from '../core/logger.js';
import prowlarrSearchService, { isCompleteSeasonTitle } from './search.js';

function buildInteractiveTags({ seasonNumber } = {}) {
  const tags = ['st', 'st:interactive'];
  if (Number.isFinite(Number(seasonNumber)) && Number(seasonNumber) > 0) {
    tags.push(`st:s:${String(seasonNumber)}`);
  }
  return tags.join(',');
}

/** Sélection du meilleur film (déjà trié par searchMovieDetailed). */
export function selectQuickMovieResult(results) {
  const best = results?.[0] || null;
  if (!best?.link) return { ok: false, reason: 'no_results' };
  return { ok: true, best };
}

/** Sélection du meilleur pack saison uniquement. */
export function selectQuickSeasonPack(results) {
  const packs = (results || []).filter((r) => isCompleteSeasonTitle(r?.name));
  const best = packs[0] || null;
  if (!best?.link) return { ok: false, reason: 'no_pack' };
  return { ok: true, best };
}

function blockedInventoryResult(inventoryCheck) {
  return {
    ok: false,
    reason: 'already_present',
    status: inventoryCheck.status || 409,
    error: inventoryCheck.error,
    details: inventoryCheck.details,
    present: inventoryCheck.present === true,
    matches: inventoryCheck.matches || [],
  };
}

/**
 * @returns {Promise<{ ok: true, torrentName: string } | { ok: false, reason: string, status?: number, error?: string, details?: unknown, present?: boolean, matches?: unknown[] }>}
 */
export async function quickDownloadMovie({
  userId,
  title,
  year = '',
  tmdbId = null,
  mediaType = 'movie',
  force = false,
}) {
  const resolvedType = mediaType === 'animation' ? 'animation' : 'movie';
  if (!title || !userId) {
    return { ok: false, reason: 'invalid_params', status: 400, error: 'Titre et utilisateur requis' };
  }

  const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(resolvedType);

  const { results } = await prowlarrSearchService.searchMovieDetailed({
    title,
    year: year || '',
    tmdbId: tmdbId || null,
    mediaType: resolvedType,
    minSeeds,
    qualityProfile: profile,
  });

  const picked = selectQuickMovieResult(results);
  if (!picked.ok) return picked;
  const best = picked.best;

  const inventoryCheck = await checkInteractiveInventoryDuplicate({
    torrentName: best.name,
    force: !!force,
    userId,
    tmdbId: tmdbId || undefined,
    mediaType: resolvedType,
  });

  if (inventoryCheck.blocked) {
    return blockedInventoryResult(inventoryCheck);
  }

  await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
    category: qbitCategory,
    tags: buildInteractiveTags(),
  });

  logger.info(`[quick-download] film "${title}" → ${best.name}`);
  return { ok: true, torrentName: String(best.name || '') };
}

/**
 * Pack saison uniquement (isCompleteSeasonTitle).
 */
export async function quickDownloadTvSeason({
  userId,
  title,
  year = '',
  tmdbId = null,
  mediaType = 'tv',
  seasonNumber,
  force = false,
}) {
  const resolvedType = mediaType === 'anime' ? 'anime' : 'tv';
  const season = Number(seasonNumber);
  if (!title || !userId || !Number.isInteger(season) || season <= 0) {
    return {
      ok: false,
      reason: 'invalid_params',
      status: 400,
      error: 'Titre, utilisateur et numéro de saison requis',
    };
  }

  const { minSeeds, profile, qbitCategory } = await getAutoSearchContext(resolvedType);

  let episodeCount = 1;
  if (tmdbId) {
    try {
      const episodes = await tmdbService.getSeasonEpisodes(tmdbId, season);
      episodeCount = (episodes || []).length || 1;
    } catch {
      episodeCount = 1;
    }
  }

  const results = await prowlarrSearchService.searchTvSeries({
    title,
    year: year || '',
    tmdbId: tmdbId || null,
    mediaType: resolvedType,
    seasonNumber: season,
    minSeeds,
    qualityProfile: profile,
    episodeCount,
  });

  const picked = selectQuickSeasonPack(results);
  if (!picked.ok) return picked;
  const best = picked.best;

  const inventoryCheck = await checkInteractiveInventoryDuplicate({
    torrentName: best.name,
    force: !!force,
    userId,
    tmdbId: tmdbId || undefined,
    mediaType: resolvedType,
    seasonNumber: season,
  });

  if (inventoryCheck.blocked) {
    return blockedInventoryResult(inventoryCheck);
  }

  await qBittorrentService.addTorrentUrlForUser(userId, best.link, {
    category: qbitCategory,
    tags: buildInteractiveTags({ seasonNumber: season }),
  });

  logger.info(`[quick-download] ${resolvedType} "${title}" S${season} → ${best.name}`);
  return { ok: true, torrentName: String(best.name || ''), seasonNumber: season };
}
