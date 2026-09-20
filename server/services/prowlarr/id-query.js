/**
 * Builders de requêtes Prowlarr par ID (Sonarr/Radarr).
 * Module pur — aucun import DB / settings.
 */

function normalizeImdbId(imdbId) {
  const imdb = imdbId ? String(imdbId).trim() : '';
  if (!imdb) return '';
  return imdb.startsWith('tt') ? imdb : `tt${imdb}`;
}

function pushIdTokens(parts, { tvdbId, tmdbId, imdbId, preferTvdb = false } = {}) {
  const tvdb = Number(tvdbId);
  const tmdb = Number(tmdbId);
  const imdb = normalizeImdbId(imdbId);

  if (preferTvdb && Number.isInteger(tvdb) && tvdb > 0) {
    parts.push(`{TvdbId:${tvdb}}`);
  } else if (Number.isInteger(tmdb) && tmdb > 0) {
    parts.push(`{TmdbId:${tmdb}}`);
  } else if (imdb) {
    parts.push(`{ImdbId:${imdb}}`);
  }
}

function hasIndexerIdToken(parts) {
  return parts.some(
    (p) => p.startsWith('{TvdbId:') || p.startsWith('{TmdbId:') || p.startsWith('{ImdbId:')
  );
}

/**
 * Requête TV Prowlarr par ID. Priorité : TVDB > TMDB > IMDb.
 */
export function buildProwlarrTvSearchQuery({
  tvdbId,
  tmdbId,
  imdbId,
  seasonNumber,
  episodeNumber,
} = {}) {
  const parts = [];
  pushIdTokens(parts, { tvdbId, tmdbId, imdbId, preferTvdb: true });

  const season = Number(seasonNumber);
  const episode = Number(episodeNumber);
  if (Number.isInteger(season) && season > 0) {
    parts.push(`{Season:${season}}`);
  }
  if (Number.isInteger(episode) && episode > 0) {
    parts.push(`{Episode:${episode}}`);
  }

  if (!hasIndexerIdToken(parts)) return '';
  return parts.join(' ');
}

/**
 * Requête film Prowlarr par ID. Priorité : TMDB > IMDb.
 * Pas de {Year:} : beaucoup d'indexeurs ne le supportent pas et ça provoque
 * des 400 + mise en pause Prowlarr (ex. TR4KER).
 */
export function buildProwlarrMovieSearchQuery({ tmdbId, imdbId } = {}) {
  const parts = [];
  pushIdTokens(parts, { tmdbId, imdbId, preferTvdb: false });

  if (!hasIndexerIdToken(parts)) return '';
  return parts.join(' ');
}
