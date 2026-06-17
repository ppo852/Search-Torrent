import fetch from 'node-fetch';
import logger from '../core/logger.js';
import { get } from '../core/db.js';
import { getTMDBCacheByTitle, saveTMDBCache, getTMDBTvShowCache, saveTMDBTvShowCache } from './cache.js';
import { applyTmdbCategoryOverride, TMDB_ANIMATION_GENRE_ID } from './category.js';
// Use centralized normalization/parsing from media-inventory
import { parseTorrentSafe, cleanMediaTitle } from '../media-inventory/utils.js';

async function getTmdbAccessToken() {
  const settings = await get("SELECT value FROM app_settings WHERE name = 'tmdb_access_token'");
  return settings?.value || null;
}

/**
 * Détails show TMDB (genres + statut + dates) — cache par tmdb_id, mutualisé RSS + accueil.
 * @returns {Promise<{ status: string|null, first_air_date: string|null, last_air_date: string|null, is_animation: boolean }|null>}
 */
export async function getTvShowDetails(tmdbId, token, cache = new Map()) {
  if (!Number.isFinite(tmdbId) || !token) return null;
  if (cache.has(tmdbId)) return cache.get(tmdbId);

  const dbCached = await getTMDBTvShowCache(tmdbId);
  if (dbCached) {
    cache.set(tmdbId, dbCached);
    return dbCached;
  }

  try {
    const resp = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${String(token)}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      cache.set(tmdbId, null);
      return null;
    }

    const data = await resp.json();
    const details = {
      status: data.status || null,
      first_air_date: data.first_air_date || null,
      last_air_date: data.last_air_date || null,
      is_animation: Array.isArray(data.genres)
        && data.genres.some((genre) => genre?.id === TMDB_ANIMATION_GENRE_ID),
    };

    await saveTMDBTvShowCache(tmdbId, details);
    cache.set(tmdbId, details);
    return details;
  } catch (error) {
    logger.error(`rss/tmdb: erreur tv/${tmdbId}:`, error);
    cache.set(tmdbId, null);
    return null;
  }
}

function attachTvShowDetails(tmdbData, showDetails) {
  if (!tmdbData || !showDetails) return tmdbData;
  return {
    ...tmdbData,
    is_animation: showDetails.is_animation,
    show_status: showDetails.status,
    show_first_air_date: showDetails.first_air_date,
    show_last_air_date: showDetails.last_air_date,
  };
}

/**
 * Cherche des informations TMDB pour un titre donné
 * @param {string} title - Titre pour lequel chercher des informations
 * @returns {Promise<Object|null>} Données TMDB ou null si rien trouvé
 */
export async function searchTMDB(title, opts = {}) {
  try {
    // Vérifier d'abord dans le cache
    const cachedData = await getTMDBCacheByTitle(title);
    if (cachedData) {
      return cachedData;
    }
    
    // Extraire un titre propre et une année avec parse-torrent-name, fallback à normalizeTitleForSearch
    const ptn = await parseTorrentSafe(title);
    const baseTitleRaw = (ptn.ok && ptn.title) ? ptn.title : title;
    const baseTitle = cleanMediaTitle(baseTitleRaw);
    const y = (ptn.ok && Number.isInteger(ptn.year) && ptn.year >= 1900 && ptn.year <= 2100) ? ptn.year : null;
    const seToken = /\bS\d{1,2}E\d{1,3}\b/i.test(title) || /\b\d{1,2}x\d{1,3}\b/i.test(title);
    const sToken = /\bS\d{1,2}\b/i.test(title);
    const hasSeasonEpisode = !!(ptn.ok && (ptn.season || ptn.episode)) || seToken || sToken;
    const categoryRaw = opts?.category ?? '';
    const category = String(categoryRaw).toLowerCase();
    const catTokens = category.split(/[\s,]+/).filter(Boolean);
    const isTvByCategory = catTokens.some((tok) => {
      if (['tv','serie','série','show','anime'].includes(tok)) return true;
      if (/^5\d{3}$/.test(tok)) return true; // Torznab TV range 5000-5999
      return false;
    });
    const kindHint = hasSeasonEpisode || isTvByCategory ? 'tv' : 'movie';
    // For TV/Anime, remove season/episode tokens and common noise from the query
    const cleanedForTv = baseTitle
      // drop bracketed fansub/group tags
      .replace(/[\[\(][^\]\)]+[\]\)]/g, ' ')
      .replace(/\bS\d{1,2}E\d{1,3}\b/ig, ' ')
      .replace(/\b\d{1,2}x\d{1,3}\b/ig, ' ')
      .replace(/\bS\d{1,2}\b/ig, ' ')
      .replace(/\bE\d{1,3}\b/ig, ' ')
      .replace(/\b(MULTI|TRUEFRENCH|SUBFRENCH|VOSTFR|VF|VO|VFI|VFF|VQ)\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // debug logs removed for production
    
    // Récupérer l'access token depuis les paramètres (table app_settings)
    const settings = await get("SELECT value FROM app_settings WHERE name = 'tmdb_access_token'");
    if (!settings || !settings.value) {
      console.warn('Clé API TMDB non configurée');
      return null;
    }
    
    // Utiliser directement la valeur du token sans JSON.parse car c'est un token JWT
    const tmdbAccessToken = settings.value;
    if (!tmdbAccessToken) {
      console.warn('Clé API TMDB non configurée ou invalide');
      return null;
    }
    
    // Séquence basée sur hint: TV -> tv(+first_air_date_year) -> multi -> movie(+year)
    // ou Film -> movie(+year) -> multi -> tv(+first_air_date_year)
    let data = { results: [] };
    let forcedMediaType = null;
    const queryTitle = (kindHint === 'tv') ? cleanedForTv : baseTitle;
    const tvLangs = ['fr-FR','en-US','ja-JP'];
    const steps = (kindHint === 'tv')
      ? [
          // try TV in multiple languages when anime; then multi; then movie
          ...tvLangs.map((lng) => ({
            url: () => `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(queryTitle)}${y ? `&first_air_date_year=${encodeURIComponent(String(y))}` : ''}&include_adult=false&language=${lng}&page=1`,
            media_type: 'tv'
          })),
          {
            url: () => `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(queryTitle)}&include_adult=false&language=fr-FR&page=1`,
            media_type: null
          },
          {
            url: () => `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(queryTitle)}${y ? `&year=${encodeURIComponent(String(y))}` : ''}&include_adult=false&language=fr-FR&page=1`,
            media_type: 'movie'
          }
        ]
      : [
          {
            url: () => `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(queryTitle)}${y ? `&year=${encodeURIComponent(String(y))}` : ''}&include_adult=false&language=fr-FR&page=1`,
            media_type: 'movie'
          },
          {
            url: () => `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(queryTitle)}&include_adult=false&language=fr-FR&page=1`,
            media_type: null
          },
          ...tvLangs.map((lng) => ({
            url: () => `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(queryTitle)}${y ? `&first_air_date_year=${encodeURIComponent(String(y))}` : ''}&include_adult=false&language=${lng}&page=1`,
            media_type: 'tv'
          }))
        ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const searchUrl = step.url();
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tmdbAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        continue;
      }
      const maybe = await response.json().catch(() => null);
      const count = Array.isArray(maybe?.results) ? maybe.results.length : 0;
      if (count > 0) {
        data = maybe;
        forcedMediaType = step.media_type;
        break;
      }
    }
    
    if (data.results && data.results.length > 0) {
      
      // Traitement différent selon qu'il s'agit d'une collection ou d'un résultat multi
      let result;
      
      // Construire les URLs complètes pour les images
      const posterUrl = data.results[0].poster_path ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}` : null;
      const backdropUrl = data.results[0].backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.results[0].backdrop_path}` : null;

      const r0 = data.results[0] || {};

      result = {
        tmdb_id: r0.id,
        media_type: r0.media_type || forcedMediaType,
        title: r0.title || r0.name,
        overview: r0.overview,
        poster_path: r0.poster_path,
        poster_url: posterUrl,
        backdrop_path: r0.backdrop_path,
        backdrop_url: backdropUrl,
        release_date: r0.release_date || r0.first_air_date,
        vote_average: r0.vote_average
      };
      
      // Sauvegarder dans le cache pour les futures requêtes
      await saveTMDBCache(title, result);
      
      return result;
    }
    
    return null;
  } catch (error) {
    logger.error('Erreur lors de la recherche TMDB:', error);
    return null;
  }
}

/**
 * Vérifie si une catégorie est pertinente pour TMDB (films, séries, etc.)
 * @param {string} category - Catégorie à vérifier
 * @returns {boolean} True si la catégorie est pertinente pour TMDB
 */
function isTMDBRelevantCategory(category) {
  if (!category) return true; // Si pas de catégorie, on essaie quand même
  
  // Convertir en nombre si c'est une chaîne numérique
  const categoryNum = parseInt(category, 10);
  const categoryStr = category.toString().toLowerCase();
  
  // Catégories numériques standard Newznab/Torznab
  // 2000-2999: Films
  // 5000-5999: TV (mais on exclut 5060 qui est pour le sport et 5070 pour les animes VOSTFR)
  // 6000-6999: XXX (ignoré)
  // 7000-7999: Livres (ignoré)
  // 1000-1999: Audio (ignoré)
  // 3000-3999: Applications (ignoré)
  // 4000-4999: Jeux (ignoré)
  if (!isNaN(categoryNum)) {
    return (categoryNum >= 2000 && categoryNum < 3000) || // Films
           (categoryNum >= 5000 && categoryNum < 6000 && categoryNum !== 5060);   // TV (inclut anime 5070)
  }
  
  // Catégories textuelles
  return categoryStr.includes('movie') || 
         categoryStr.includes('film') || 
         categoryStr.includes('tv') || 
         categoryStr.includes('serie') || 
         categoryStr.includes('série') || 
         categoryStr.includes('show') || 
         categoryStr.includes('anime');
}

/**
 * Enrichit une liste d'éléments RSS avec des données TMDB
 * @param {Array} items - Éléments RSS à enrichir
 * @returns {Promise<Array>} Éléments enrichis avec des données TMDB
 */
export async function enrichItemsWithTMDB(items) {
  const enrichedItems = [];
  const tvShowCache = new Map();
  const tmdbAccessToken = await getTmdbAccessToken();

  for (const item of items) {
    try {
      // Vérifier si la catégorie est pertinente pour TMDB
      if (!isTMDBRelevantCategory(item.category)) {
        enrichedItems.push({
          ...item,
          tmdb: null,
        });
        continue;
      }

      const catCombined = [item.category, item.categoryName].filter(Boolean).join(',');
      const tmdbData = await searchTMDB(item.title, { category: catCombined });

      let enrichedItem = {
        ...item,
        tmdb: tmdbData || null,
      };

      if (
        tmdbData?.media_type === 'tv'
        && Number.isFinite(tmdbData.tmdb_id)
        && tmdbAccessToken
      ) {
        const showDetails = await getTvShowDetails(
          tmdbData.tmdb_id,
          tmdbAccessToken,
          tvShowCache
        );

        if (showDetails) {
          enrichedItem = {
            ...enrichedItem,
            tmdb: attachTvShowDetails(enrichedItem.tmdb, showDetails),
          };

          if (item.categoryName !== 'Anime') {
            enrichedItem = applyTmdbCategoryOverride(enrichedItem, {
              isAnimation: showDetails.is_animation,
            });
          }
        }
      }

      enrichedItems.push(enrichedItem);
    } catch (err) {
      logger.error(`Erreur lors de l'enrichissement TMDB pour ${item.title}:`, err);
      enrichedItems.push({
        ...item,
        tmdb: null,
      });
    }
  }

  return enrichedItems;
}

export default {
  searchTMDB,
  enrichItemsWithTMDB,
  getTvShowDetails,
};
