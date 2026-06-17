import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';

async function getTmdbAccessToken() {
  const token = await getSetting('tmdb_access_token');
  return token ? String(token) : null;
}

/**
 * Get all episodes of a season with their air dates
 */
export async function getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber }) {
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

/**
 * Check if a specific episode has aired
 */
export async function isEpisodeAired({ tmdbId, seasonNumber, episodeNumber }) {
  const episodes = await getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber });
  const ep = episodes.find((e) => e.episodeNumber === Number(episodeNumber));
  if (!ep) return false;

  if (!ep.airDate) return true;
  const airMs = new Date(ep.airDate).getTime();
  if (Number.isNaN(airMs)) return true;

  return airMs <= Date.now();
}

/**
 * Get the total number of episodes in a season
 */
export async function getSeasonEpisodesCount({ tmdbId, seasonNumber }) {
  const episodes = await getSeasonEpisodesWithAirDates({ tmdbId, seasonNumber });
  return episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNumber)) : null;
}
