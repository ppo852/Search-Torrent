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

/**
 * Get Prowlarr category IDs for a media type
 */
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
  return null;
}

/**
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
}

/**
 * Check if a torrent title indicates a complete season pack
 */
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

  return results;
}

/**
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
};
