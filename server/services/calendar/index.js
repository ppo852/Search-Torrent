import crypto from 'crypto';
import { query } from '../core/db.js';
import { getSetting } from '../settings/index.js';
import { getSeasonEpisodesWithAirDates } from '../tmdb/episodes.js';
import { pad2 } from '../utils/helpers.js';
import logger from '../core/logger.js';

export { eventsToIcs } from './ics.js';

const DEFAULT_DAYS_BEFORE = 7;
const DEFAULT_DAYS_AFTER = 30;
const CACHE_TTL_MS = 15 * 60 * 1000;

let eventsCache = {
  key: null,
  at: 0,
  events: null,
};

function toIsoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveDateWindow({ start, end } = {}) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - DEFAULT_DAYS_BEFORE);
  const defaultEnd = new Date(now);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + DEFAULT_DAYS_AFTER);

  const startDate = parseIsoDate(start) || defaultStart;
  const endDate = parseIsoDate(end) || defaultEnd;
  const startIso = toIsoDate(startDate);
  const endIso = toIsoDate(endDate);
  if (startIso > endIso) {
    return { startIso: endIso, endIso: startIso };
  }
  return { startIso, endIso };
}

/**
 * Génère une clé API calendrier (hex 64 chars).
 */
export function generateCalendarApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Vérifie le token query contre le setting calendar_api_key.
 */
export async function isValidCalendarToken(token) {
  const expected = await getSetting('calendar_api_key');
  if (typeof expected !== 'string' || expected.length < 16) return false;
  if (typeof token !== 'string' || token.length < 16) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Épisodes des saisons séries/animes en cours (status != completed).
 */
export async function getCalendarEvents({ start, end } = {}) {
  const { startIso, endIso } = resolveDateWindow({ start, end });
  const cacheKey = `${startIso}|${endIso}`;
  if (eventsCache.events && eventsCache.key === cacheKey && Date.now() - eventsCache.at < CACHE_TTL_MS) {
    return { start: startIso, end: endIso, events: eventsCache.events };
  }

  const rows = await query(
    `SELECT tmdb_id, media_type, title, season_number, status
     FROM tv_season_requests
     WHERE status != 'completed'
       AND media_type IN ('tv', 'anime')
       AND tmdb_id IS NOT NULL
       AND season_number IS NOT NULL
     ORDER BY title ASC, season_number ASC`
  );

  const events = [];
  const seen = new Set();

  for (const row of rows || []) {
    const tmdbId = Number(row.tmdb_id);
    const seasonNumber = Number(row.season_number);
    const mediaType = row.media_type === 'anime' ? 'anime' : 'tv';
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) continue;

    const seasonKey = `${mediaType}:${tmdbId}:${seasonNumber}`;
    if (seen.has(seasonKey)) continue;
    seen.add(seasonKey);

    let episodes = [];
    try {
      episodes = await getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber });
    } catch (error) {
      logger.warn('[calendar] TMDB season fetch failed', {
        tmdbId,
        seasonNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const ep of episodes || []) {
      const airDate = typeof ep.airDate === 'string' ? ep.airDate.slice(0, 10) : null;
      if (!airDate || airDate < startIso || airDate > endIso) continue;

      const episodeNumber = Number(ep.episodeNumber);
      if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;

      const showTitle = String(row.title || `TMDB ${tmdbId}`).trim();
      const episodeTitle = typeof ep.title === 'string' && ep.title.trim() ? ep.title.trim() : null;
      const code = `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;

      events.push({
        id: `${mediaType}-${tmdbId}-${seasonNumber}-${episodeNumber}`,
        title: showTitle,
        season: seasonNumber,
        episode: episodeNumber,
        episodeTitle,
        airDate,
        tmdbId,
        mediaType,
        summary: episodeTitle ? `${showTitle} - ${code} - ${episodeTitle}` : `${showTitle} - ${code}`,
      });
    }
  }

  events.sort((a, b) => {
    if (a.airDate !== b.airDate) return a.airDate < b.airDate ? -1 : 1;
    return String(a.summary).localeCompare(String(b.summary), 'fr');
  });

  eventsCache = { key: cacheKey, at: Date.now(), events };
  return { start: startIso, end: endIso, events };
}

/** Invalide le cache (tests / régénération). */
export function clearCalendarCache() {
  eventsCache = { key: null, at: 0, events: null };
}
