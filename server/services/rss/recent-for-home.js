import * as db from '../core/db.js';
import logger from '../core/logger.js';
import { getSetting } from '../settings/index.js';
import { getAppCache, setAppCache } from '../core/app-cache.js';
import { fetchRSSFeedWithCache } from './index.js';
import { getTvShowDetails } from './tmdb.js';

const DEFAULT_HOURS = 72;
const HOME_CACHE_TTL_MINUTES = 15;
const ACTIVE_SHOW_MONTHS = 18;
const ACTIVE_STATUSES = new Set(['Returning Series', 'In Production', 'Planned']);
const ENDED_STATUSES = new Set(['Ended', 'Canceled']);

function isWithinHours(pubDate, hours) {
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

function getReleaseYear(releaseDate) {
  if (!releaseDate) return null;
  const year = parseInt(String(releaseDate).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function isMovieInYearWindow(releaseDate) {
  const year = getReleaseYear(releaseDate);
  if (!year) return false;
  const currentYear = new Date().getFullYear();
  return year === currentYear || year === currentYear - 1;
}

function isFirstAirRecent(firstAirDate) {
  const year = getReleaseYear(firstAirDate);
  if (!year) return false;
  const currentYear = new Date().getFullYear();
  return year === currentYear || year === currentYear - 1;
}

function isWithinMonths(dateStr, months) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

function hasPoster(tmdb) {
  if (!tmdb) return false;
  if (typeof tmdb.poster_url === 'string' && tmdb.poster_url.trim().length > 0) return true;
  if (tmdb.poster_path) return true;
  return false;
}

function isAnimeItem(item) {
  if (item.categoryName === 'Anime') return true;
  const cat = parseInt(item.category, 10);
  return cat === 5070;
}

function isSeriesTvItem(item) {
  if (isAnimeItem(item)) return false;
  if (item.categoryName === 'Séries TV') return true;
  const cat = parseInt(item.category, 10);
  return Number.isFinite(cat) && cat >= 5000 && cat < 6000 && cat !== 5060 && cat !== 5070;
}

function isRecentMovieForHome(item, hours) {
  if (!isWithinHours(item.pubDate, hours)) return false;
  if (!item.tmdb) return false;
  if (item.tmdb.media_type !== 'movie') return false;
  if (!hasPoster(item.tmdb)) return false;
  if (!isMovieInYearWindow(item.tmdb.release_date)) return false;
  return true;
}

function isRecentTvCandidate(item, hours) {
  if (!isWithinHours(item.pubDate, hours)) return false;
  if (!item.tmdb) return false;
  if (item.tmdb.media_type !== 'tv') return false;
  if (!hasPoster(item.tmdb)) return false;
  return true;
}

function isInterestingTvShow(show) {
  if (!show) return false;

  const status = String(show.status || '');
  const firstAir = show.first_air_date;
  const lastAir = show.last_air_date;

  if (ENDED_STATUSES.has(status)) {
    return false;
  }

  if (isFirstAirRecent(firstAir)) return true;
  if (ACTIVE_STATUSES.has(status)) return true;
  if (isWithinMonths(lastAir, ACTIVE_SHOW_MONTHS)) return true;

  return false;
}

function dedupeByTmdbId(items) {
  const byTmdbId = new Map();

  for (const item of items) {
    const tmdbId = item.tmdb?.tmdb_id;
    if (!Number.isFinite(tmdbId)) continue;

    const existing = byTmdbId.get(tmdbId);
    if (!existing || new Date(item.pubDate) > new Date(existing.pubDate)) {
      byTmdbId.set(tmdbId, item);
    }
  }

  return Array.from(byTmdbId.values());
}

function toHomeMediaDto(item) {
  const tmdb = item.tmdb;
  const posterUrl = tmdb.poster_url?.trim()
    || (tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null);

  return {
    tmdb: {
      tmdb_id: tmdb.tmdb_id,
      title: tmdb.title,
      poster_url: posterUrl,
      release_date: tmdb.release_date,
      vote_average: tmdb.vote_average,
    },
  };
}

async function getOwnedMovieTmdbIds() {
  const rows = await db.query(
    `SELECT DISTINCT tmdb_id
     FROM local_media_inventory
     WHERE media_kind = 'movie' AND tmdb_id IS NOT NULL AND tmdb_id > 0`
  );
  return new Set((rows || []).map((row) => row.tmdb_id));
}

async function collectRssItems() {
  const feeds = await db.query('SELECT * FROM global_rss_feeds ORDER BY created_at DESC');
  if (!feeds?.length) return [];

  const allItems = [];
  for (const feed of feeds) {
    try {
      const result = await fetchRSSFeedWithCache(feed.id, feed.feed_url, { includeTMDB: true });
      allItems.push(...result.items);
    } catch (error) {
      logger.error(`recent-for-home: erreur flux ${feed.feed_name}:`, error);
    }
  }
  return allItems;
}

function getCachedShowDetails(item) {
  const tmdb = item.tmdb;
  if (!tmdb) return null;

  const hasShowMeta = tmdb.show_status != null
    || tmdb.show_last_air_date != null
    || tmdb.show_first_air_date != null;

  if (!hasShowMeta) return null;

  return {
    status: tmdb.show_status,
    first_air_date: tmdb.show_first_air_date || tmdb.release_date,
    last_air_date: tmdb.show_last_air_date,
  };
}

async function filterInterestingTvItems(items, token, sharedCache = new Map()) {
  if (!items.length) return [];

  const kept = [];

  for (const item of items) {
    let details = getCachedShowDetails(item);

    if (!details && token) {
      const fetched = await getTvShowDetails(item.tmdb.tmdb_id, token, sharedCache);
      details = fetched
        ? {
            status: fetched.status,
            first_air_date: fetched.first_air_date,
            last_air_date: fetched.last_air_date,
          }
        : null;
    }

    if (isInterestingTvShow(details)) {
      kept.push(item);
    }
  }

  return kept;
}

/**
 * Agrège les médias récents des trackers pour la page d'accueil.
 */
export async function getRecentForHome({ hours = DEFAULT_HOURS } = {}) {
  const cacheKey = `recent-home:${hours}`;
  const cached = await getAppCache(cacheKey);
  if (cached) {
    return cached;
  }

  const allItems = await collectRssItems();
  if (!allItems.length) {
    const empty = { films: [], series: [], anime: [], hours };
    await setAppCache(cacheKey, empty, HOME_CACHE_TTL_MINUTES);
    return empty;
  }

  const ownedMovieIds = await getOwnedMovieTmdbIds();
  const tmdbToken = await getSetting('tmdb_access_token');

  const films = dedupeByTmdbId(
    allItems.filter((item) => isRecentMovieForHome(item, hours))
  )
    .filter((item) => !ownedMovieIds.has(item.tmdb.tmdb_id))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .map(toHomeMediaDto);

  const seriesCandidates = dedupeByTmdbId(
    allItems.filter((item) => isRecentTvCandidate(item, hours) && isSeriesTvItem(item))
  );

  const animeCandidates = dedupeByTmdbId(
    allItems.filter((item) => isRecentTvCandidate(item, hours) && isAnimeItem(item))
  );

  let series = [];
  let anime = [];

  if (tmdbToken) {
    const tvShowCache = new Map();
    const [filteredSeries, filteredAnime] = await Promise.all([
      filterInterestingTvItems(seriesCandidates, tmdbToken, tvShowCache),
      filterInterestingTvItems(animeCandidates, tmdbToken, tvShowCache),
    ]);

    series = filteredSeries
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .map(toHomeMediaDto);

    anime = filteredAnime
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .map(toHomeMediaDto);
  }

  const result = { films, series, anime, hours };
  await setAppCache(cacheKey, result, HOME_CACHE_TTL_MINUTES);
  return result;
}

/** @deprecated Alias films-only */
export async function getRecentMoviesForHome(options) {
  const result = await getRecentForHome(options);
  return { films: result.films, hours: result.hours };
}
