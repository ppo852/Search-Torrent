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
  genres?: Array<{ id: number; name: string }>;
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
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';

    let q = title
      // Remove IMDB/TVDB/TMDB ID annotations like {imdb-tt...} or [tmdbid-...]
      .replace(/\{imdb-[^\}]+\}/gi, '')
      .replace(/\[tvdbid-[^\]]+\]/gi, '')
      .replace(/\{tmdb-[^\}]+\}/gi, '')
      .replace(/\[tmdbid-[^\]]+\]/gi, '')
      // Remove year in parentheses and everything after: (1989)...
      .replace(/\(\d{4}\).*$/, '')
      // Remove year with separators and everything after: .1989-... or -1989. or _1989_
      .replace(/[._-]\d{4}[._-].*$/, '')
      // Remove standalone year at end with separator: .1989 or -1989 or _1989
      .replace(/[._-]\d{4}$/, '')
      // Remove common quality indicators and everything after
      .replace(/[._-](480p|720p|1080p|2160p|4k).*$/i, '')
      .replace(/[._-](bluray|brrip|webrip|web-dl|webdl|hdtv|dvdrip).*$/i, '')
      // Remove codec info and everything after
      .replace(/[._-](x264|x265|h264|h265|hevc|xvid|divx|avc).*$/i, '')
      // Remove release group tags (usually at the end like -RARBG, -YTS, etc.)
      .replace(/-[A-Z0-9]+$/, '')
      // Replace separators with spaces
      .replace(/[._+\-]+/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim();

    if (year && q && !q.includes(year)) {
      q = `${q} ${year}`;
    }

    return q;
  }

  async searchMultipleTypes(query: string, mediaType: 'movie' | 'tv' | 'all' = 'all'): Promise<TmdbResult[]> {
    if (!globalSettings.getTmdbAccessToken()) {
      return [];
    }

    const cleanedTitle = this.cleanTitle(query);


    try {
      return await this.searchWithTitle(cleanedTitle, query, mediaType);
    } catch (error) {

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
          // Déterminer le type réel du média (important pour la recherche 'multi')
          const actualType = type === 'multi' ? item.media_type : type;
          
          // On ignore ce qui n'est ni un film ni une série (ex: les fiches d'acteurs)
          if (actualType !== 'movie' && actualType !== 'tv') return;

          results.push({
            id: item.id,
            title: actualType === 'movie' ? item.title : item.name,
            originalTitle: actualType === 'movie' ? item.original_title : item.original_name,
            releaseDate: actualType === 'movie' ? item.release_date : item.first_air_date,
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
            type: actualType as 'movie' | 'tv',
            overview: item.overview,
            voteAverage: item.vote_average,
            genres: item.genre_ids ? item.genre_ids.map((id: number) => ({ id, name: '' })) : []
          });
        });
      } catch (error) {
      }
    }

    // Trier par popularité (vote_average)
    return results.sort((a, b) => b.voteAverage - a.voteAverage);
  }

  getTmdbUrl(id: number, type: 'movie' | 'tv'): string {
    return `https://www.themoviedb.org/${type}/${id}`;
  }

  /**
   * Récupère les détails complets d'un film
   */
  async getMovieDetails(id: string | number): Promise<any> {
    const url = new URL(`${this.BASE_URL}/movie/${id}`);
    url.searchParams.append('language', 'fr-FR');
    url.searchParams.append('append_to_response', 'credits,videos,recommendations');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Récupère les détails complets d'une série TV
   */
  async getTvDetails(id: string | number): Promise<any> {
    const url = new URL(`${this.BASE_URL}/tv/${id}`);
    url.searchParams.append('language', 'fr-FR');
    url.searchParams.append('append_to_response', 'credits,videos,recommendations');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Récupère les détails d'une saison spécifique d'une série TV
   */
  async getTvSeasonDetails(id: string | number, seasonNumber: number): Promise<any> {
    const url = new URL(`${this.BASE_URL}/tv/${id}/season/${seasonNumber}`);
    url.searchParams.append('language', 'fr-FR');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Alias pour searchMultipleTypes pour maintenir la compatibilité avec SearchPage.tsx
   * @param query Requête de recherche
   * @param mediaType Type de média (film, série ou les deux)
   * @param isAnime Indique si la recherche concerne des animes
   */
  async searchSuggestions(query: string, mediaType: 'movie' | 'tv' | 'all' = 'all', _isAnime: boolean = false): Promise<TmdbResult[]> {
    // Simplement appeler searchMultipleTypes qui a la même fonctionnalité
    return this.searchMultipleTypes(query, mediaType);
  }
}

export const tmdbAPI = new TmdbAPI();
export default tmdbAPI;
