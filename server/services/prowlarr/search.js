<<<<<<< HEAD
import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';
import tmdbService from '../tmdb/index.js';
import {
  normalize,
  simplifyTitle,
  pickBestProwlarrLink,
  pad2
} from '../utils/helpers.js';
import { applyQualityProfile } from '../utils/validation.js';
import logger from '../core/logger.js';

function extractProwlarrCategoryId(item) {
  const raw = item?.categories ?? item?.category;
  if (raw == null || raw === '') return undefined;

  const entries = Array.isArray(raw) ? raw : [raw];
  const ids = [];

  for (const entry of entries) {
    let id;
    if (typeof entry === 'object' && entry !== null) {
      id = Number(entry.id ?? entry.ID ?? entry.value);
    } else {
      id = Number(entry);
    }
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }

  if (ids.length === 0) return undefined;
  const specific = ids.find((id) => id < 8000 || id >= 9000);
  return specific ?? ids[0];
}
=======
/**
 * Service centralisé pour les recherches Prowlarr
 * Gère les variantes de titres, le filtrage par pertinence, et les fallbacks
 */

import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

/**
 * Get Prowlarr category IDs for a media type
 */
<<<<<<< HEAD
const PROWLARR_TV_CATEGORY_IDS = '5000,5010,5020,5030,5040,5045,5050,5060,5070,5080,5090,5100,5110';
const PROWLARR_MUSIC_CATEGORY_IDS = '3000,3010,3020,3030,3040,3050,3060,3070';
const PROWLARR_SOFTWARE_CATEGORY_IDS = '1000,1010,1020,1030,1040,1050,1060,1070,1080,1090,4000,4010,4020,4030,4040,4050,4060,4070';
const PROWLARR_BOOKS_CATEGORY_IDS = '7000,7010,7020,7030,7040,7050';

const NON_MEDIA_SEARCH_CATEGORIES = new Set(['music', 'software', 'books']);

export function getProwlarrCategoryId(mediaType) {
  if (mediaType === 'movies' || mediaType === 'movie') return '2000,2010,2020,2030,2040,2045,2050,2060,2070,2080,2090';
  if (mediaType === 'tv' || mediaType === 'anime') return PROWLARR_TV_CATEGORY_IDS;
  if (mediaType === 'music') return PROWLARR_MUSIC_CATEGORY_IDS;
  if (mediaType === 'software') return PROWLARR_SOFTWARE_CATEGORY_IDS;
  if (mediaType === 'books') return PROWLARR_BOOKS_CATEGORY_IDS;
=======
function getProwlarrCategoryId(mediaType) {
  if (mediaType === 'movies' || mediaType === 'movie') return '2000,2010,2020,2030,2040,2045,2050,2060,2070,2080,2090';
  if (mediaType === 'tv') return '5000,5010,5020,5030,5040,5050,5060,5080,5090,5100,5110';
  if (mediaType === 'anime') return '5070';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  return null;
}

/**
<<<<<<< HEAD
 * Internal helper to fetch title variants from TMDB
 */
async function fetchVariants(tmdbId, type) {
  if (!tmdbId) return { variants: [], originalTitle: null };
  const info = await tmdbService.getDetailedInfo(tmdbId, type);
  if (!info) return { variants: [], originalTitle: null };
  return {
    variants: info.titles,
    originalTitle: info.originalTitle || info.mainTitle
  };
}

/**
 * LOGIQUE DE FILTRAGE STRICTE (COPIE CONFORME DE LA TIENNE)
 */
function checkSingleTitleStrict(n, requestedTitle) {
  const t = normalize(requestedTitle).replace(/\s+/g, ' ');
  if (!t) return false;

  const escapedTitle = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedTitle}\\b`, 'i');
  if (!regex.test(n)) return false;

  const nWordsRaw = n.split(/[\s._-]+/).filter(Boolean);
  const tWordsRaw = t.split(/[\s._-]+/).filter(Boolean);

  if (tWordsRaw.length === 1) {
    const titleWord = tWordsRaw[0];
    const indexInName = nWordsRaw.indexOf(titleWord);
    if (indexInName !== -1 && nWordsRaw.length > indexInName + 1) {
      const nextWord = nWordsRaw[indexInName + 1];
      const mediaTokenRegex = /^(s\d+(e\d+)?|e\d+|\d{4}|1080p|720p|2160p|4k|uhd|vostfr|vost|french|multi|vf|bluray|web-dl|webrip|hdrip|h264|x264|h265|x265|hevc)$/i;
      if (!mediaTokenRegex.test(nextWord)) return false;
    }
  }

  const articles = new Set(['the', 'le', 'la', 'les', 'un', 'une', 'des', 'a', 'an']);
  const nWords = n.split(/\s+/).filter(w => w && !articles.has(w));
  const tWords = t.split(/\s+/).filter(w => w && !articles.has(w));

  if (t.length <= 5 || tWords.length === 1) {
    if (nWords[0] !== tWords[0]) return false;
  }

  const index = n.indexOf(t);
  if (index > 15) return false;

  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'au', 'aux']);
  const tokens = t.split(/\s+/).filter((tok) => tok.length >= 3 && !stopWords.has(tok));

  if (tokens.length > 1) {
    let matches = 0;
    for (const tok of tokens) {
      if (n.includes(tok)) matches += 1;
    }
    if (matches / tokens.length < 0.6) return false;
  }

  return true;
}

/**
 * Check if a torrent name is relevant
 */
export function isRelevantResult(torrentName, requestedTitles, year, seasonNumber) {
  if (!requestedTitles) return true;
  const titles = Array.isArray(requestedTitles) ? requestedTitles : [requestedTitles];
  const n = normalize(torrentName).replace(/\s+/g, ' ');

  // Filtre de saison (CRITIQUE pour les séries)
  if (seasonNumber) {
    const s = Number(seasonNumber);
    // Regex plus agressive sans frontières strictes pour attraper S01E01
    const seasonMatch = torrentName.match(/S(\d+)|Saison\s*(\d+)|Season\s*(\d+)|(\d+)x\d+/i);
    if (seasonMatch) {
      const foundSeason = Number(seasonMatch[1] || seasonMatch[2] || seasonMatch[3] || seasonMatch[4]);
      if (foundSeason !== s) {
        logger.debug(`[Filter] REJETÉ: "${torrentName}" (Saison trouvée: ${foundSeason}, attendue: ${s})`);
        return false;
      }
    }
  }

  const yearInNameMatch = n.match(/\b(19\d{2}|20\d{2})\b/);
  if (year && yearInNameMatch) {
    if (yearInNameMatch[0] !== String(year)) return false;
  }

  const matched = titles.some(title => checkSingleTitleStrict(n, title));
  if (!matched) {
    logger.debug(`[Filter] REJETÉ: "${torrentName}" (Titre non correspondant)`);
  } else {
    logger.debug(`[Filter] ACCEPTÉ: "${torrentName}" (Saison attendue: ${seasonNumber || 'N/A'})`);
  }

  return matched;
}

/**
 * Prepare queries
 */
function prepareQueries(baseTitle, originalTitle, year, seasonNumber) {
  const q = new Set();
  const sToken = seasonNumber ? `S${pad2(seasonNumber)}` : null;

  if (baseTitle) {
    const st = simplifyTitle(baseTitle);
    q.add(st);
    if (sToken) q.add(`${st} ${sToken}`);
    if (year) q.add(`${st} ${year}`);
  }
  if (originalTitle && originalTitle !== baseTitle) {
    const ost = simplifyTitle(originalTitle);
    q.add(ost);
    if (sToken) q.add(`${ost} ${sToken}`);
    if (year) q.add(`${ost} ${year}`);
  }
  return Array.from(q);
=======
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
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
}

/**
 * Check if a torrent title indicates a complete season pack
 */
<<<<<<< HEAD
export function isCompleteSeasonTitle(name) {
  const t = String(name || '').toLowerCase();

  // 1. Mots-clés explicites (toujours prioritaires)
  if (/complete|integrale|intégrale|full\s*season|season\s*pack|pack\s*season|saison\s*complete|saison\s*compl[eè]te/.test(t)) {
    return true;
  }

  // 2. Détection intelligente : contient une Saison mais PAS d'épisode précis
  // On cherche "S01", "Season 1", "S1", etc.
  // On retire les frontières de mots \b pour être plus large
  const hasSeason = /s\d+|season\s*\d+|saison\s*\d+/i.test(t);
  // On cherche "E01", "1x01", etc.
  const hasEpisode = /e\d+|ep\d+|episode\s*\d+|\d+x\d+/i.test(t);

  return hasSeason && !hasEpisode;
}

/**
 * Calcule un score de résolution pour le tri
 */
function getResolutionScore(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('2160p') || n.includes('4k') || n.includes('uhd')) return 300;
  if (n.includes('1080p') || n.includes('fullhd')) return 200;
  if (n.includes('720p') || n.includes('hdready')) return 100;
  return 0;
}

/**
 * Process Results
 */
export function processSearchResults(rawResults, options = {}) {
  const {
    baseTitle,
    validTitles,
    year,
    minSeeds = 0,
    qualityProfile = null,
    filterByRelevance = true,
    multiplier = 1,
    sortBy = 'seeds_desc',
    seasonNumber = null
  } = options;

  const relevanceTitles = validTitles || (baseTitle ? [baseTitle] : []);
  const seen = new Set();

  let results = (rawResults || [])
    .filter(item => {
      const id = item.guid || item.downloadUrl;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(item => {
      const categoryId = extractProwlarrCategoryId(item);

      return {
        name: item.title,
        link: pickBestProwlarrLink(item),
        size: item.size || 0,
        seeds: item.seeders || 0,
        leech: item.peers || 0,
        engine_url: item.indexer || '',
        desc_link: item.infoUrl || '',
        category: item.categoryDesc || '',
        categoryId,
        publishDate: item.publishDate || item.pubDate || null,
        _resScore: getResolutionScore(item.title)
      };
    })
    .filter(r => r.link);

  // Filtrage
  if (minSeeds > 0) results = results.filter(r => r.seeds >= minSeeds);
  if (filterByRelevance) results = results.filter(r => isRelevantResult(r.name, relevanceTitles, year, seasonNumber));

  // Application du profil de qualité (avec multiplicateur si saison complète)
  if (qualityProfile) {
    results = applyQualityProfile(results, qualityProfile, multiplier);
  }

  // Tri final : Score de résolution d'abord, puis critère utilisateur
  results.sort((a, b) => {
    if (b._resScore !== a._resScore) {
      return b._resScore - a._resScore;
    }

    if (sortBy === 'size_asc') return (a.size || 0) - (b.size || 0);
    if (sortBy === 'size_desc') return (b.size || 0) - (a.size || 0);
    if (sortBy === 'date_desc') return (new Date(b.publishDate).getTime() || 0) - (new Date(a.publishDate).getTime() || 0);
    if (sortBy === 'date_asc') return (new Date(a.publishDate).getTime() || 0) - (new Date(b.publishDate).getTime() || 0);
    return (b.seeds || 0) - (a.seeds || 0);
  });

=======
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

>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  return results;
}

/**
<<<<<<< HEAD
 * Execute search (TEXT ONLY)
 */
async function runSearch(query, categoryId) {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');
  if (!prowlarrUrl || !prowlarrApiKey) return [];

  const url = new URL('/api/v1/search', prowlarrUrl);
  url.searchParams.append('query', query);

  if (categoryId) {
    String(categoryId).split(',').forEach(id => {
      url.searchParams.append('categories', id.trim());
    });
  }

  try {
    const response = await fetch(url, { headers: { 'X-Api-Key': prowlarrApiKey } });
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    return [];
  }
}

export async function searchMovie({ title, year, tmdbId, minSeeds = 3, filterByRelevance = true, qualityProfile = null }) {
  const { variants, originalTitle } = await fetchVariants(tmdbId, 'movie');
  const finalVariants = variants.length > 0 ? variants : [title];
  const queries = prepareQueries(title, originalTitle || title, year);

  const results = await Promise.all(queries.map(q => runSearch(q, getProwlarrCategoryId('movie'))));
  return processSearchResults(results.flat(), { baseTitle: title, validTitles: finalVariants, year, minSeeds, qualityProfile, filterByRelevance, sortBy: qualityProfile?.sort_by });
}

export async function searchTvSeries({ title, year, tmdbId, mediaType = 'tv', seasonNumber, minSeeds = 3, qualityProfile = null, episodeCount = 1 }) {
  const { variants, originalTitle } = await fetchVariants(tmdbId, 'tv');
  const finalVariants = variants.length > 0 ? variants : [title];
  const queries = prepareQueries(title, originalTitle || title, year, seasonNumber);

  const results = await Promise.all(queries.map(q => runSearch(q, getProwlarrCategoryId(mediaType))));
  return processSearchResults(results.flat(), {
    baseTitle: title,
    validTitles: finalVariants,
    year,
    minSeeds,
    qualityProfile,
    multiplier: episodeCount,
    sortBy: qualityProfile?.sort_by,
    seasonNumber
  });
}

export async function searchTvEpisode({ title, seasonNumber, episodeNumber, tmdbId, mediaType = 'tv', minSeeds = 3, qualityProfile = null }) {
  const { variants, originalTitle } = await fetchVariants(tmdbId, 'tv');
  const finalVariants = variants.length > 0 ? variants : [title];
  const t = originalTitle || title;

  const episodeToken = `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;
  const episodeRegex = new RegExp(`S0*${seasonNumber}E0*${episodeNumber}`, 'i');

  const raw = await runSearch(`${t} ${episodeToken}`, getProwlarrCategoryId(mediaType));
  const filtered = raw.filter(r => episodeRegex.test(r.title));

  return processSearchResults(filtered, {
    baseTitle: title,
    validTitles: finalVariants,
    minSeeds,
    qualityProfile,
    sortBy: qualityProfile?.sort_by,
    seasonNumber
  });
}

export async function searchGeneral({ query, category = null, minSeeds = 3 }) {
  const categoryId = category ? getProwlarrCategoryId(category) : null;
  const raw = await runSearch(query, categoryId);
  const filterByRelevance = !NON_MEDIA_SEARCH_CATEGORIES.has(category);
  return processSearchResults(raw, { baseTitle: query, minSeeds, filterByRelevance });
}

export default {
  searchMovie,
  searchTvSeries,
  searchTvEpisode,
  searchGeneral,
  isRelevantResult,
  getProwlarrCategoryId,
  isCompleteSeasonTitle
=======
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
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
};
