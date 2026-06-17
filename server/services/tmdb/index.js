import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';
import logger from '../core/logger.js';

/**
 * Service centralisé pour l'API TMDB côté serveur
 */
class TmdbService {
  BASE_URL = 'https://api.themoviedb.org/3';
  cache = new Map();
  CACHE_TTL = 60 * 60 * 1000; // 1 heure

  async getHeaders() {
    const token = await getSetting('tmdb_access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Utilitaire pour gérer le cache
   */
  async withCache(key, fetcher) {
    const now = Date.now();
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (now - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Récupère les variantes de titres pour un film ou une série
   */
  async getDetailedInfo(tmdbId, type = 'movie') {
    if (!tmdbId) return null;

    const cacheKey = `details:${type}:${tmdbId}`;
    return this.withCache(cacheKey, async () => {
      try {
        const headers = await this.getHeaders();
        const url = new URL(`${this.BASE_URL}/${type}/${tmdbId}`);
        url.searchParams.append('language', 'fr-FR');
        url.searchParams.append('append_to_response', 'alternative_titles');

        const response = await fetch(url.toString(), { headers });
        if (!response.ok) return null;

        const data = await response.json();
        const titles = new Set();
        
        if (type === 'movie') {
          if (data.title) titles.add(data.title);
          if (data.original_title) titles.add(data.original_title);
          if (data.alternative_titles?.titles) {
            data.alternative_titles.titles.forEach(t => titles.add(t.title));
          }
        } else {
          if (data.name) titles.add(data.name);
          if (data.original_name) titles.add(data.original_name);
          if (data.alternative_titles?.results) {
            data.alternative_titles.results.forEach(t => titles.add(t.title));
          }
        }

        return {
          tmdbId,
          type,
          mainTitle: type === 'movie' ? data.title : data.name,
          originalTitle: type === 'movie' ? data.original_title : data.original_name,
          titles: Array.from(titles).filter(Boolean)
        };
      } catch (error) {
        logger.error(`[TMDB] Erreur lors de la récupération des détails pour ${type} ${tmdbId}:`, error);
        return null;
      }
    });
  }

  /**
   * Récupère les variantes de titres pour un film ou une série
   */
  async getTitleVariants(tmdbId, type = 'movie') {
    const info = await this.getDetailedInfo(tmdbId, type);
    return info ? info.titles : [];
  }

  /**
   * Récupère les épisodes d'une saison avec leurs dates de diffusion
   */
  async getSeasonEpisodes(tmdbId, seasonNumber) {
    if (!tmdbId || seasonNumber === undefined) return [];

    const cacheKey = `episodes:${tmdbId}:${seasonNumber}`;
    return this.withCache(cacheKey, async () => {
      try {
        const url = new URL(`${this.BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`);
        url.searchParams.append('language', 'fr-FR');

        const response = await fetch(url.toString(), {
          headers: await this.getHeaders()
        });

        if (!response.ok) return [];

        const data = await response.json();
        return (data.episodes || []).map(e => ({
          episodeNumber: e.episode_number,
          airDate: e.air_date,
          name: e.name
        }));
      } catch (error) {
        logger.error(`[TMDB] Erreur lors de la récupération de la saison ${seasonNumber} pour TV ${tmdbId}:`, error);
        return [];
      }
    });
  }
}

const tmdbService = new TmdbService();
export { tmdbService };
export default tmdbService;
