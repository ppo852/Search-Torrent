/**
 * Service centralisé pour les recherches Prowlarr
 * Gère les variantes de titres, le filtrage par pertinence, et les fallbacks
 */

import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';

/**
 * Get Prowlarr category IDs for a media type
 */
function getProwlarrCategoryId(mediaType) {
  if (mediaType === 'movies' || mediaType === 'movie') return '2000,2010,2020,2030,2040,2045,2050,2060,2070,2080,2090';
  if (mediaType === 'tv') return '5000,5010,5020,5030,5040,5050,5060,5080,5090,5100,5110';
  if (mediaType === 'anime') return '5070';
  return null;
}

/**
 * Pick the best download link from a Prowlarr result
 */
function pickBestProwlarrLink(item) {
  const downloadUrl = item?.downloadUrl;
  const guid = item?.guid;
  const magnetUri = item?.magnetUrl || item?.magnet;

  const isMagnet = (v) => typeof v === 'string' && v.startsWith('magnet:?');
  const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

  // Prefer magnets (always work) over HTTP links (may fail in Docker)
  if (isMagnet(magnetUri)) return magnetUri;
  if (isMagnet(downloadUrl)) return downloadUrl;
  if (isMagnet(guid)) return guid;

  // Fallback to HTTP links
  if (isHttp(downloadUrl)) return downloadUrl;
  if (isHttp(guid)) return guid;
  return null;
}

/**
 * Normalize a string for comparison (lowercase, no accents, alphanumeric only)
 */
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/gi, ' ')
    .trim();
}

/**
 * Simplify a title for search (remove special chars)
 */
function simplifyTitle(title) {
  return String(title || '')
    .replace(/[:']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a torrent title indicates a complete season pack
 */
function isCompleteSeasonTitle(name) {
  const t = String(name || '').toLowerCase();
  return /complete|integrale|intégrale|full\s*season|season\s*pack|pack\s*season|saison\s*complete|saison\s*compl[eè]te/.test(t);
}

/**
 * Check if a torrent name is relevant to the requested title
 */
function isRelevantMovieResult(torrentName, requestedTitle, year) {
  if (!requestedTitle) return true;

  const n = normalize(torrentName);
  const t = normalize(requestedTitle);

  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'au', 'aux']);
  const tokens = t
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !stopWords.has(tok));

  if (tokens.length === 0) return true;

  let matches = 0;
  for (const tok of tokens) {
    if (n.includes(tok)) matches += 1;
  }

  const matchRatio = matches / tokens.length;
  if (matchRatio < 0.5) return false;

  if (year && !n.includes(String(year))) return false;

  return true;
}

/**
 * Normalize Prowlarr results to a standard format
 */
function normalizeResults(results) {
  return (results || [])
    .map((item) => ({
      name: item.title,
      link: pickBestProwlarrLink(item),
      size: item.size || 0,
      seeds: item.seeders || 0,
      leech: item.peers || 0,
      engine_url: item.indexer || '',
      desc_link: item.infoUrl || '',
      publishDate: item.publishDate || item.pubDate || null
    }))
    .filter((item) => item.link);
}

/**
 * Execute a single Prowlarr search
 */
async function runProwlarrSearch(prowlarrUrl, prowlarrApiKey, queryText, categoryId) {
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
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Get movie title variants from TMDB (original + French)
 */
async function getTmdbMovieTitleVariants(tmdbId) {
  const token = await getSetting('tmdb_access_token');
  if (!token || !tmdbId) return [];

  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
    url.searchParams.append('language', 'fr-FR');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const titles = [];

    if (data.original_title) titles.push(data.original_title);
    if (data.title && data.title !== data.original_title) titles.push(data.title);

    return [...new Set(titles)];
  } catch {
    return [];
  }
}

/**
 * Get TV series title variants from TMDB (original + French)
 */
async function getTmdbTvTitleVariants(tmdbId) {
  const token = await getSetting('tmdb_access_token');
  if (!token || !tmdbId) return [];

  try {
    const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
    url.searchParams.append('language', 'fr-FR');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const titles = [];

    // Add French title first (usually better for French indexers)
    if (data.name) titles.push(data.name);
    // Add original title (may be in foreign script like Hebrew, Japanese, etc.)
    if (data.original_name && data.original_name !== data.name) titles.push(data.original_name);

    return [...new Set(titles)];
  } catch {
    return [];
  }
}

/**
 * Search for a movie with multiple title variants and fallbacks
 * @param {Object} options
 * @param {string} options.title - Movie title
 * @param {string} options.year - Release year
 * @param {number} options.tmdbId - TMDB ID for title variants
 * @param {number} options.minSeeds - Minimum seeds filter
 * @param {boolean} options.filterByRelevance - Filter results by title relevance
 * @returns {Promise<Array>} - Search results
 */
export async function searchMovie({ title, year, tmdbId, minSeeds = 3, filterByRelevance = true }) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const categoryId = getProwlarrCategoryId('movie');
  const baseTitle = String(title || '').trim();

  // Build list of query variants
  const queries = [];
  
  if (baseTitle && year) queries.push(`${simplifyTitle(baseTitle)} ${year}`);
  if (baseTitle) queries.push(simplifyTitle(baseTitle));

  // Add TMDB title variants (original/English title)
  if (tmdbId) {
    const variants = await getTmdbMovieTitleVariants(tmdbId);
    for (const t of variants) {
      if (t && t !== baseTitle) {
        if (year) queries.push(`${simplifyTitle(t)} ${year}`);
        queries.push(simplifyTitle(t));
      }
    }
  }

  const uniqueQueries = [...new Set(queries)];

  // Try each query with category filter
  let rawResults = [];
  for (const q of uniqueQueries) {
    rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, q, categoryId);
    if (rawResults.length > 0) break;
  }

  // Fallback: try without category filter
  if (rawResults.length === 0) {
    for (const q of uniqueQueries) {
      rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, q, null);
      if (rawResults.length > 0) break;
    }
  }

  // Normalize results
  let results = normalizeResults(rawResults);

  // Filter by minimum seeds
  if (minSeeds > 0) {
    results = results.filter((r) => r.seeds >= minSeeds);
  }

  // Filter by title relevance
  if (filterByRelevance) {
    results = results.filter((r) => isRelevantMovieResult(r.name, baseTitle, year));
  }

  return results;
}

/**
 * Search for a TV episode
 * @param {Object} options
 * @param {string} options.title - Series title
 * @param {number} options.seasonNumber - Season number
 * @param {number} options.episodeNumber - Episode number
 * @param {string} options.mediaType - 'tv' or 'anime'
 * @param {number} options.minSeeds - Minimum seeds filter
 * @returns {Promise<Array>} - Search results
 */
export async function searchTvEpisode({ title, seasonNumber, episodeNumber, mediaType = 'tv', minSeeds = 3 }) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const categoryId = getProwlarrCategoryId(mediaType);
  const baseTitle = String(title || '').trim();

  const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
  const episodeToken = `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;
  const seasonToken = `S${pad2(seasonNumber)}`;

  const episodeRegex = new RegExp(`(?:S0*${seasonNumber}E0*${episodeNumber}|${seasonNumber}x0*${episodeNumber})`, 'i');
  const seasonRegex = new RegExp(`S0*${seasonNumber}`, 'i');

  // Search for specific episode
  let rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, `${baseTitle} ${episodeToken}`, categoryId);
  rawResults = rawResults.filter((r) => episodeRegex.test(String(r?.title || '')));

  // Fallback: search for complete season pack
  if (rawResults.length === 0) {
    const seasonCandidates = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, `${baseTitle} ${seasonToken}`, categoryId);
    rawResults = seasonCandidates
      .filter((r) => seasonRegex.test(String(r?.title || '')))
      .filter((r) => {
        const t = String(r?.title || '').toLowerCase();
        return /complete|integrale|intégrale|full\s*season|season\s*pack|pack\s*season|saison\s*complete|saison\s*compl[eè]te/.test(t);
      });
  }

  // Normalize results
  let results = normalizeResults(rawResults);

  // Filter by minimum seeds
  if (minSeeds > 0) {
    results = results.filter((r) => r.seeds >= minSeeds);
  }

  return results;
}

/**
 * Search for a TV series (general search, not specific episode)
 * @param {Object} options
 * @param {string} options.title - Series title
 * @param {number} options.tmdbId - TMDB ID for title variants
 * @param {string} options.mediaType - 'tv' or 'anime'
 * @param {number} options.minSeeds - Minimum seeds filter
 * @returns {Promise<Array>} - Search results
 */
export async function searchTvSeries({ title, tmdbId, mediaType = 'tv', minSeeds = 3 }) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const categoryId = getProwlarrCategoryId(mediaType);
  const baseTitle = String(title || '').trim();
  
  // Build query variants
  const queries = [];
  
  // 1. Base title provided
  if (baseTitle) {
    queries.push(simplifyTitle(baseTitle));
    const noAccents = simplifyTitle(baseTitle).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    if (noAccents !== simplifyTitle(baseTitle)) {
      queries.push(noAccents);
    }
  }
  
  // 2. Get title variants from TMDB (like we do for movies)
  if (tmdbId) {
    const variants = await getTmdbTvTitleVariants(tmdbId);
    for (const t of variants) {
      if (t && t !== baseTitle) {
        queries.push(simplifyTitle(t));
        const noAccents = simplifyTitle(t).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        if (noAccents !== simplifyTitle(t)) {
          queries.push(noAccents);
        }
      }
    }
  }

  // Remove duplicates
  const uniqueQueries = [...new Set(queries.filter(Boolean))];

  // Try each query with category filter first
  let rawResults = [];
  for (const q of uniqueQueries) {
    rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, q, categoryId);
    if (rawResults.length > 0) break;
  }

  // Fallback: try without category filter
  if (rawResults.length === 0) {
    for (const q of uniqueQueries) {
      rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, q, null);
      if (rawResults.length > 0) break;
    }
  }

  // Normalize results
  let results = normalizeResults(rawResults);

  // Filter by minimum seeds
  if (minSeeds > 0) {
    results = results.filter((r) => r.seeds >= minSeeds);
  }

  return results;
}

/**
 * General search (all categories)
 * @param {Object} options
 * @param {string} options.query - Search query
 * @param {number} options.minSeeds - Minimum seeds filter
 * @returns {Promise<Array>} - Search results
 */
export async function searchGeneral({ query, minSeeds = 3 }) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');

  if (!prowlarrUrl || !prowlarrApiKey) {
    throw new Error('Prowlarr non configuré');
  }

  const rawResults = await runProwlarrSearch(prowlarrUrl, prowlarrApiKey, query, null);
  let results = normalizeResults(rawResults);

  if (minSeeds > 0) {
    results = results.filter((r) => r.seeds >= minSeeds);
  }

  return results;
}

export {
  getProwlarrCategoryId,
  pickBestProwlarrLink,
  isRelevantMovieResult,
  isCompleteSeasonTitle,
  normalizeResults,
  getTmdbMovieTitleVariants,
  getTmdbTvTitleVariants,
  simplifyTitle,
  normalize,
  runProwlarrSearch
};

export default {
  searchMovie,
  searchTvEpisode,
  searchTvSeries,
  searchGeneral,
  getProwlarrCategoryId,
  pickBestProwlarrLink,
  isRelevantMovieResult,
  normalizeResults,
  getTmdbMovieTitleVariants
};
