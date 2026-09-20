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
import { isEpisodeTorrentTitle } from '../utils/episode-title.js';
import {
  isMovieExtraTorrent,
  shouldApplyMovieExtraFilter,
  expandTitleVariantsForRelevance,
} from '../utils/extra-content.js';
import logger from '../core/logger.js';
import {
  buildProwlarrTvSearchQuery,
  buildProwlarrMovieSearchQuery,
} from './id-query.js';

/**
 * Sépare titre / année sans vider un titre numérique (ex. "1923", "9101").
 */
export function splitQueryTitleAndYear(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return { title: '', year: '' };

  if (/^\d{4}$/.test(trimmed)) {
    return { title: trimmed, year: '' };
  }

  const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch?.[1] || '';
  const title = year
    ? trimmed.replace(/\b(19\d{2}|20\d{2})\b/, '').replace(/\s+/g, ' ').trim()
    : trimmed;

  if (!title && year) {
    return { title: trimmed, year: '' };
  }

  return { title, year };
}

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
  if (mediaType === 'movies' || mediaType === 'movie' || mediaType === 'animation') {
    return '2000,2010,2020,2030,2040,2045,2050,2060,2070,2080,2090';
  }
  if (mediaType === 'tv' || mediaType === 'anime') return PROWLARR_TV_CATEGORY_IDS;
  if (mediaType === 'music') return PROWLARR_MUSIC_CATEGORY_IDS;
  if (mediaType === 'software') return PROWLARR_SOFTWARE_CATEGORY_IDS;
  if (mediaType === 'books') return PROWLARR_BOOKS_CATEGORY_IDS;
  return null;
}

/**
 * Variantes de titre TMDB pour le filtre de pertinence.
 */
async function fetchVariants(tmdbId, type) {
  if (!tmdbId) return { variants: [], originalTitle: null, isDocumentary: false };
  const info = await tmdbService.getDetailedInfo(tmdbId, type);
  if (!info) return { variants: [], originalTitle: null, isDocumentary: false };
  return {
    variants: info.titles || [],
    originalTitle: info.originalTitle || info.mainTitle,
    isDocumentary: !!info.isDocumentary,
  };
}

/**
 * Correspondance stricte titre demandé ↔ nom de torrent.
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

  // Titre = année seule (ex. "1923", "1917", "9101") : ne pas filtrer par année
  // sinon le titre lui-même est pris pour une année de sortie.
  const titleIsNumericOnly = titles.some((title) => {
    const t = normalize(title).replace(/\s+/g, '');
    return /^\d{4}$/.test(t);
  });

  if (year && !titleIsNumericOnly) {
    const yearInNameMatch = n.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearInNameMatch && yearInNameMatch[0] !== String(year)) {
      return false;
    }
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
 * Variantes texte (max 2) : original d'abord, puis titre local.
 * Priorité : saison → année → titre seul.
 */
function prepareQueries(baseTitle, originalTitle, year, seasonNumber) {
  const ordered = [];
  const seen = new Set();
  const push = (query) => {
    const q = String(query || '').trim();
    if (!q || seen.has(q)) return;
    seen.add(q);
    ordered.push(q);
  };

  const st = baseTitle ? simplifyTitle(baseTitle) : '';
  const ost =
    originalTitle && originalTitle !== baseTitle ? simplifyTitle(originalTitle) : '';
  const titles = [ost, st].filter(Boolean);
  const sToken = seasonNumber ? `S${pad2(seasonNumber)}` : null;

  for (const t of titles) {
    if (sToken) push(`${t} ${sToken}`);
  }
  for (const t of titles) {
    if (year) push(`${t} ${year}`);
  }
  for (const t of titles) {
    push(t);
  }

  return ordered.slice(0, 2);
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
    seasonNumber = null,
    filterMovieExtras = false,
    movieTitleVariants = [],
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

  let extrasFilteredOnly = false;
  if (filterMovieExtras) {
    const beforeExtras = results.length;
    results = results.filter((r) => !isMovieExtraTorrent(r.name, { titleVariants: movieTitleVariants }));
    extrasFilteredOnly = beforeExtras > 0 && results.length === 0;
  }

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

  return { results, extrasFilteredOnly };
}

async function runProwlarrSearch(query, categoryId, searchType = 'search') {
  const prowlarrUrl = await getSetting('prowlarr_url');
  const prowlarrApiKey = await getSetting('prowlarr_api_key');
  if (!prowlarrUrl || !prowlarrApiKey) return [];

  const url = new URL('/api/v1/search', prowlarrUrl);
  url.searchParams.append('query', query);
  if (searchType && searchType !== 'search') {
    url.searchParams.append('type', searchType);
  }

  if (categoryId) {
    String(categoryId).split(',').forEach((id) => {
      url.searchParams.append('categories', id.trim());
    });
  }

  try {
    const response = await fetch(url, { headers: { 'X-Api-Key': prowlarrApiKey } });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

function resolveMovieMediaType(mediaType) {
  return mediaType === 'animation' ? 'animation' : 'movie';
}

/**
 * Recherche Prowlarr par ID (Sonarr/Radarr). Texte = fallback / expand côté appelant.
 * @param {'tv'|'movie'} kind
 */
async function runIndexerIdSearch({
  kind,
  tmdbId,
  mediaType,
  seasonNumber,
  episodeNumber,
} = {}) {
  const isTv = kind === 'tv';
  const label = isTv ? 'TV' : 'Movie';
  const tmdbType = isTv ? 'tv' : resolveMovieMediaType(mediaType);
  const externalIds = tmdbId ? await tmdbService.getExternalIds(tmdbId, tmdbType) : null;

  let idQuery = '';
  if (isTv) {
    idQuery = buildProwlarrTvSearchQuery({
      tvdbId: externalIds?.tvdbId,
      tmdbId: externalIds?.tmdbId ?? tmdbId,
      imdbId: externalIds?.imdbId,
      seasonNumber,
      episodeNumber,
    });
  } else {
    idQuery = buildProwlarrMovieSearchQuery({
      tmdbId: externalIds?.tmdbId ?? tmdbId,
      imdbId: externalIds?.imdbId,
    });
  }

  if (!idQuery) {
    return [];
  }

  const categoryId = getProwlarrCategoryId(isTv ? mediaType : tmdbType);
  // Prowlarr attend type=movie (pas moviesearch) pour parser {TmdbId}/{ImdbId}.
  // Sinon les IDs partent en requête littérale et font planter les indexeurs.
  const searchType = isTv ? 'tvsearch' : 'movie';
  const raw = await runProwlarrSearch(idQuery, categoryId, searchType);

  if (raw.length > 0) {
    logger.debug('prowlarr', `${label} ID search "${idQuery}" → ${raw.length} résultat(s)`);
  } else {
    logger.debug('prowlarr', `${label} ID search vide ("${idQuery}")`);
  }

  return raw;
}

/** Fusion ID + texte — le dédoublonnage est fait dans processSearchResults. */
function mergeProwlarrRawResults(...lists) {
  const out = [];
  for (const list of lists) {
    for (const item of list || []) {
      out.push(item);
    }
  }
  return out;
}

/** Texte séquentiel (pas de Promise.all) pour ménager les indexeurs. */
async function runTextQueries(queries, categoryId) {
  const out = [];
  for (const q of (queries || []).filter(Boolean)) {
    const batch = await runProwlarrSearch(q, categoryId, 'search');
    out.push(...(batch || []));
  }
  return out;
}

/**
 * ID d'abord ; texte séquentiel si besoin (arrêt dès résultats filtrés).
 * expandTextSearch : ID + toutes les variantes texte (max 2), sans arrêt anticipé.
 */
async function processWithIdTitleFallback({
  idRaw,
  textQueries,
  categoryId,
  expandTextSearch = false,
  preFilter = null,
  processOptions,
}) {
  const applyPre = (raw) =>
    (typeof preFilter === 'function' ? preFilter(raw || []) : (raw || []));

  if (expandTextSearch) {
    const textRaw = await runTextQueries(textQueries, categoryId);
    let raw = mergeProwlarrRawResults(idRaw, textRaw);
    raw = applyPre(raw);
    return processSearchResults(raw, processOptions);
  }

  let processed = processSearchResults(applyPre(idRaw), processOptions);
  if (processed.results.length > 0) {
    return processed;
  }

  const queries = (textQueries || []).filter(Boolean);
  let textAccum = [];
  for (const q of queries) {
    const batch = await runProwlarrSearch(q, categoryId, 'search');
    textAccum.push(...(batch || []));
    processed = processSearchResults(applyPre(textAccum), processOptions);
    if (processed.results.length > 0) {
      if ((idRaw || []).length > 0) {
        logger.debug('prowlarr', 'ID sans résultat pertinent après filtre, fallback texte');
      }
      return processed;
    }
  }

  return processed;
}

export async function searchMovieDetailed({
  title,
  year,
  tmdbId,
  mediaType = 'movie',
  minSeeds = 0,
  qualityProfile = null,
  expandTextSearch = false,
}) {
  const tmdbType = resolveMovieMediaType(mediaType);
  const { variants, originalTitle, isDocumentary } = await fetchVariants(tmdbId, 'movie');
  // Une seule liste : pertinence + filtre making-of / bonus.
  const titleVariants = [
    ...new Set(
      [title, originalTitle, ...(variants.length > 0 ? variants : [title])].filter(Boolean)
    ),
  ];
  const filterMovieExtras = shouldApplyMovieExtraFilter({
    isDocumentary,
    titleVariants,
  });
  // Making-of / docu : variantes « cœur » pour matcher Title.Making.Of / Title.DOC
  const relevanceTitles = expandTitleVariantsForRelevance(titleVariants, { isDocumentary });

  const idRaw = await runIndexerIdSearch({
    kind: 'movie',
    tmdbId,
    mediaType: tmdbType,
  });

  const queries = prepareQueries(title, originalTitle || title, year);
  return processWithIdTitleFallback({
    idRaw,
    textQueries: queries,
    categoryId: getProwlarrCategoryId(tmdbType),
    expandTextSearch,
    processOptions: {
      baseTitle: title,
      validTitles: relevanceTitles,
      year,
      minSeeds,
      qualityProfile,
      filterByRelevance: true,
      sortBy: qualityProfile?.sort_by,
      filterMovieExtras,
      movieTitleVariants: titleVariants,
    },
  });
}

export async function searchMovie(options) {
  const { results } = await searchMovieDetailed(options);
  return results;
}

export async function searchTvSeries({
  title,
  year,
  tmdbId,
  mediaType = 'tv',
  seasonNumber,
  minSeeds = 0,
  qualityProfile = null,
  episodeCount = 1,
  expandTextSearch = false,
}) {
  const { variants, originalTitle } = await fetchVariants(tmdbId, 'tv');
  const finalVariants = variants.length > 0 ? variants : [title];

  const idRaw = await runIndexerIdSearch({
    kind: 'tv',
    tmdbId,
    seasonNumber,
    mediaType,
  });

  const queries = prepareQueries(title, originalTitle || title, year, seasonNumber);
  const { results } = await processWithIdTitleFallback({
    idRaw,
    textQueries: queries,
    categoryId: getProwlarrCategoryId(mediaType),
    expandTextSearch,
    processOptions: {
      baseTitle: title,
      validTitles: finalVariants,
      year,
      minSeeds,
      qualityProfile,
      multiplier: episodeCount,
      sortBy: qualityProfile?.sort_by,
      seasonNumber,
      filterByRelevance: true,
    },
  });
  return results;
}

export async function searchTvEpisode({
  title,
  seasonNumber,
  episodeNumber,
  tmdbId,
  mediaType = 'tv',
  minSeeds = 0,
  qualityProfile = null,
}) {
  const { variants, originalTitle } = await fetchVariants(tmdbId, 'tv');
  const finalVariants = variants.length > 0 ? variants : [title];
  const episodeToken = `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;
  const categoryId = getProwlarrCategoryId(mediaType);

  const idRaw = await runIndexerIdSearch({
    kind: 'tv',
    tmdbId,
    seasonNumber,
    episodeNumber,
    mediaType,
  });

  // Max 2 variantes texte (original puis FR), séquentiel + stop via processWithIdTitleFallback.
  const textQueries = [];
  const ost = originalTitle ? simplifyTitle(originalTitle) : '';
  const st = title ? simplifyTitle(title) : '';
  if (ost) textQueries.push(`${ost} ${episodeToken}`);
  if (st && st !== ost) textQueries.push(`${st} ${episodeToken}`);
  if (textQueries.length === 0 && title) textQueries.push(`${title} ${episodeToken}`);

  // Auto-search : jamais d'expand (évite homonymes). ID → texte si besoin + filtre titre.
  const { results } = await processWithIdTitleFallback({
    idRaw,
    textQueries: textQueries.slice(0, 2),
    categoryId,
    expandTextSearch: false,
    preFilter: (raw) =>
      (raw || []).filter((r) => isEpisodeTorrentTitle(r.title, seasonNumber, episodeNumber)),
    processOptions: {
      baseTitle: title,
      validTitles: finalVariants,
      minSeeds,
      qualityProfile,
      sortBy: qualityProfile?.sort_by,
      seasonNumber,
      filterByRelevance: true,
    },
  });
  return results;
}

export async function searchGeneral({ query, category = null, minSeeds = 0 }) {
  const categoryId = category ? getProwlarrCategoryId(category) : null;
  const raw = await runProwlarrSearch(query, categoryId, 'search');
  const filterByRelevance = !NON_MEDIA_SEARCH_CATEGORIES.has(category);
  return processSearchResults(raw, { baseTitle: query, minSeeds, filterByRelevance }).results;
}

export default {
  searchMovie,
  searchMovieDetailed,
  searchTvSeries,
  searchTvEpisode,
  searchGeneral,
  isRelevantResult,
  getProwlarrCategoryId,
  isCompleteSeasonTitle,
};
