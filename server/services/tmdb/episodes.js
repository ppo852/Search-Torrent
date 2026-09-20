import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';

const seasonDetailCache = new Map();
const showMetaCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getTmdbAccessToken() {
  const token = await getSetting('tmdb_access_token');
  return token ? String(token) : null;
}

function parseSeasonEpisodes(data) {
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  return episodes
    .map((e) => ({
      episodeNumber: Number(e?.episode_number),
      airDate: e?.air_date || null,
      title: typeof e?.name === 'string' ? e.name : null,
    }))
    .filter((e) => Number.isInteger(e.episodeNumber) && e.episodeNumber > 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
}

function resolveSeasonEpisodeCount(data, parsedEpisodes) {
  const fromMeta = Number(data?.episode_count);
  if (Number.isInteger(fromMeta) && fromMeta > 0) return fromMeta;
  if (parsedEpisodes.length > 0) {
    return Math.max(...parsedEpisodes.map((e) => e.episodeNumber));
  }
  return 0;
}

async function fetchSeasonDetail({ tmdbId, seasonNumber }) {
  const id = Number(tmdbId);
  const season = Number(seasonNumber);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(season) || season < 0) {
    return { episodeCount: 0, episodes: [] };
  }

  const cacheKey = `${id}-${season}`;
  const cached = seasonDetailCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const token = await getTmdbAccessToken();
  if (!token) return { episodeCount: 0, episodes: [] };

  const url = new URL(`https://api.themoviedb.org/3/tv/${id}/season/${season}`);
  url.searchParams.append('language', 'fr-FR');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return { episodeCount: 0, episodes: [] };

  const data = await response.json().catch(() => null);
  const episodes = parseSeasonEpisodes(data);
  const detail = {
    episodeCount: resolveSeasonEpisodeCount(data, episodes),
    episodes,
  };

  seasonDetailCache.set(cacheKey, { data: detail, at: Date.now() });
  return detail;
}

async function fetchShowDetail(tmdbId) {
  const id = Number(tmdbId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const cached = showMetaCache.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const token = await getTmdbAccessToken();
  if (!token) return null;

  const showUrl = new URL(`https://api.themoviedb.org/3/tv/${id}`);
  showUrl.searchParams.append('language', 'fr-FR');

  const showRes = await fetch(showUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!showRes.ok) return null;

  const show = await showRes.json().catch(() => null);
  if (!show) return null;

  showMetaCache.set(id, { data: show, at: Date.now() });
  return show;
}

/**
 * Get all episodes of a season with their air dates
 */
export async function getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber }) {
  const detail = await fetchSeasonDetail({ tmdbId, seasonNumber });
  return detail.episodes;
}

/**
 * Indique si un épisode TMDB est déjà diffusé (sans date = considéré diffusé).
 */
export function isEpisodeAiredNow(airDate, now = Date.now()) {
  if (!airDate) return true;
  const airMs = new Date(airDate).getTime();
  if (Number.isNaN(airMs)) return true;
  return airMs <= now;
}

/**
 * Filtre les épisodes TMDB déjà diffusés.
 */
export function filterAiredEpisodes(episodes, now = Date.now()) {
  return (episodes || []).filter((episode) => isEpisodeAiredNow(episode.airDate, now));
}

/**
 * Numéros d'épisodes TMDB déjà diffusés.
 */
export function getAiredEpisodeNumbers(episodes, now = Date.now()) {
  return filterAiredEpisodes(episodes, now)
    .map((episode) => episode.episodeNumber)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Nombre total d'épisodes prévus pour une saison TMDB.
 */
export async function getSeasonTotalEpisodeCount({ tmdbId, seasonNumber }) {
  const detail = await fetchSeasonDetail({ tmdbId, seasonNumber });
  return detail.episodeCount;
}

/**
 * Métadonnées TMDB pour l'inventaire (total prévu + série terminée ou non).
 * Si la série n'est pas terminée, on ne calcule pas le total d'épisodes
 * (inutile pour les badges Partiel / Complète).
 */
export async function getTvShowInventoryMeta(tmdbId) {
  const id = Number(tmdbId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const show = await fetchShowDetail(id);
  if (!show) return null;

  const status = String(show?.status || '');
  const ended = status === 'Ended' || status === 'Canceled';
  const nextEpisode = show?.next_episode_to_air ?? null;

  // Série en cours : pas besoin du total pour les pastilles
  if (!ended) {
    return {
      status,
      ended: false,
      total_episodes: null,
      next_episode_to_air: nextEpisode,
    };
  }

  const seasons = (Array.isArray(show?.seasons) ? show.seasons : [])
    .map((s) => ({
      seasonNumber: Number(s?.season_number),
      episodeCount: Number(s?.episode_count),
    }))
    .filter((s) => Number.isInteger(s.seasonNumber) && s.seasonNumber > 0);

  let total = 0;
  for (const season of seasons) {
    if (Number.isInteger(season.episodeCount) && season.episodeCount > 0) {
      total += season.episodeCount;
      continue;
    }
    const detail = await fetchSeasonDetail({
      tmdbId: id,
      seasonNumber: season.seasonNumber,
    });
    total += detail.episodeCount;
  }

  return {
    status,
    ended: true,
    total_episodes: total,
    next_episode_to_air: nextEpisode,
  };
}

function isSeasonStillAiring(meta, seasonNumber) {
  const next = meta?.next_episode_to_air;
  if (!next) return false;
  return Number(next.season_number) === Number(seasonNumber);
}

function boostExpectedFromNextEpisode(meta, seasonNumber, expectedCount) {
  if (!isSeasonStillAiring(meta, seasonNumber)) return expectedCount;
  const nextEp = Number(meta.next_episode_to_air?.episode_number);
  if (!Number.isInteger(nextEp) || nextEp <= 0) return expectedCount;
  return Math.max(expectedCount, nextEp);
}

export { isSeasonStillAiring, boostExpectedFromNextEpisode };
