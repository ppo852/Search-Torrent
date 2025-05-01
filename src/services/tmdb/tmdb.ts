import { globalSettings } from '../settings';

interface TmdbResult {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string;
  posterPath: string | null;
  type: 'movie' | 'tv';
  overview: string;
  voteAverage: number;
}

class TmdbAPI {
  readonly BASE_URL = 'https://api.themoviedb.org/3';

  getHeaders() {
    const token = globalSettings.getTmdbAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private cleanTitle(title: string): string {
    // Remplacer d'abord tous les points par des espaces
    let cleanedTitle = title.replace(/\./g, ' ');
    
    // Ensuite, diviser sur les espaces
    const parts = cleanedTitle.split(/\s+/);
    
    // Remove common keywords, resolutions, codecs, and release group indicators
    const filteredParts = parts.filter(part => {
      const uppercasePart = part.toUpperCase();
      // Skip common resolution indicators
      if (/^(4K|2160P|1080P|720P|480P|360P)$/i.test(part)) return false;
      
      // Skip common codecs
      if (/^(HEVC|H264|H265|X264|X265)$/i.test(part)) return false;
      
      // Skip common release indicators
      if (/^(BLURAY|BDRIP|BRRIP|WEBDL|WEB-DL|HDRip|HDTV|DVDRip)$/i.test(part)) return false;
      
      // Skip common release group names
      if (/^(RARBG|YIFY|YTS|SPARKS|AMIABLE|GECKOS|FGT|ION10|INTEGRALE)$/i.test(part)) return false;
      
      return true;
    });
    
    // Join the remaining parts
    return filteredParts.join(' ').trim();
  }

  async searchMultipleTypes(query: string, mediaType: 'movie' | 'tv' | 'all' = 'all'): Promise<TmdbResult[]> {
    if (!globalSettings.getTmdbAccessToken()) {
      "console.error('TMDB API not configured');"
      return [];
    }
    
    const cleanedTitle = this.cleanTitle(query);
    
    // Log pour le debug
    "console.log(`Cleaned title: \"${cleanedTitle}\" (from \"${query}\") - Type: ${mediaType}`);"
    
    try {
      return await this.searchWithTitle(cleanedTitle, query, mediaType);
    } catch (error) {
      "console.error('TMDB search error:', error);" 
      return [];
    }
  }

  async searchWithTitle(query: string, originalQuery: string, mediaType: 'movie' | 'tv' | 'all' = 'all'): Promise<TmdbResult[]> {
    // Determine if likely an anime for better search
    const isAnime = /anime|アニメ/.test(originalQuery.toLowerCase());
    
    // Déterminer quels types de médias rechercher en fonction du paramètre mediaType
    const types: Array<'movie' | 'tv'> = mediaType === 'all' ? ['movie', 'tv'] : [mediaType];
    const results: TmdbResult[] = [];
    
    for (const type of types) {
      try {
        const url = new URL(`${this.BASE_URL}/search/${type}`);
        url.searchParams.append('query', query);
        url.searchParams.append('language', 'fr-FR');
        url.searchParams.append('include_adult', 'false');
        
        // Pour les animes, on ajoute le filtre du genre animation
        if (isAnime) {
          url.searchParams.append('with_genres', '16');
        }
        
        const response = await fetch(url.toString(), {
          headers: this.getHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        data.results.forEach((item: any) => {
          results.push({
            id: item.id,
            title: type === 'movie' ? item.title : item.name,
            originalTitle: type === 'movie' ? item.original_title : item.original_name,
            releaseDate: type === 'movie' ? item.release_date : item.first_air_date,
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
            type: type,
            overview: item.overview,
            voteAverage: item.vote_average
          });
        });
      } catch (error) {
        "console.error(`Error searching ${type}:`, error);"
      }
    }
    
    // Trier par popularité (vote_average)
    return results.sort((a, b) => b.voteAverage - a.voteAverage);
  }

  getTmdbUrl(id: number, type: 'movie' | 'tv'): string {
    return `https://www.themoviedb.org/${type}/${id}`;
  }

  /**
   * Alias pour searchMultipleTypes pour maintenir la compatibilité avec SearchPage.tsx
   * @param query Requête de recherche
   * @param mediaType Type de média (film, série ou les deux)
   * @param isAnime Indique si la recherche concerne des animes
   */
  async searchSuggestions(query: string, mediaType: 'movie' | 'tv' | 'all' = 'all', isAnime: boolean = false): Promise<TmdbResult[]> {
    // Simplement appeler searchMultipleTypes qui a la même fonctionnalité
    return this.searchMultipleTypes(query, mediaType);
  }
}

export const tmdbAPI = new TmdbAPI();
export default tmdbAPI;
