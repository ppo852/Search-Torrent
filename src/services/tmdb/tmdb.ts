import { useAuthStore } from '../../stores/authStore';
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
  private getAuthHeaders() {
    const token = useAuthStore.getState().token;
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  }

  private async apiGet(path: string): Promise<any> {
    const response = await fetch(`/api/tmdb${path}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  }

  private async ensureConfigured(): Promise<boolean> {
    if (globalSettings.isTmdbConfigured()) {
      return true;
    }
    try {
      await globalSettings.load();
    } catch {
      return false;
    }
    return globalSettings.isTmdbConfigured();
  }

  private cleanTitle(title: string): string {
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';

    let q = title
      .replace(/\{imdb-[^\}]+\}/gi, '')
      .replace(/\[tvdbid-[^\]]+\]/gi, '')
      .replace(/\{tmdb-[^\}]+\}/gi, '')
      .replace(/\[tmdbid-[^\]]+\]/gi, '')
      .replace(/\(\d{4}\).*$/, '')
      .replace(/[._-]\d{4}[._-].*$/, '')
      .replace(/[._-]\d{4}$/, '')
      .replace(/[._-](480p|720p|1080p|2160p|4k).*$/i, '')
      .replace(/[._-](bluray|brrip|webrip|web-dl|webdl|hdtv|dvdrip).*$/i, '')
      .replace(/[._-](x264|x265|h264|h265|hevc|xvid|divx|avc).*$/i, '')
      .replace(/-[A-Z0-9]+$/, '')
      .replace(/[._+\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (year && q && !q.includes(year)) {
      q = `${q} ${year}`;
    }

    return q;
  }

  async searchMultipleTypes(query: string, mediaType: 'movie' | 'tv' | 'all' = 'all'): Promise<TmdbResult[]> {
    if (!(await this.ensureConfigured())) {
      return [];
    }

    const cleanedTitle = this.cleanTitle(query);

    try {
      return await this.searchWithTitle(cleanedTitle, query, mediaType);
    } catch {
      return [];
    }
  }

  async searchWithTitle(
    query: string,
    originalQuery: string,
    mediaType: 'movie' | 'tv' | 'all' = 'all'
  ): Promise<TmdbResult[]> {
    const params = new URLSearchParams({
      q: query,
      mediaType,
      originalQuery
    });
    return this.apiGet(`/search?${params.toString()}`);
  }

  getTmdbUrl(id: number, type: 'movie' | 'tv'): string {
    return `https://www.themoviedb.org/${type}/${id}`;
  }

  async getMovieDetails(id: string | number): Promise<any> {
    return this.apiGet(`/movie/${id}`);
  }

  async getTvDetails(id: string | number): Promise<any> {
    return this.apiGet(`/tv/${id}`);
  }

  async getTvSeasonDetails(id: string | number, seasonNumber: number): Promise<any> {
    return this.apiGet(`/tv/${id}/season/${seasonNumber}`);
  }

  async searchSuggestions(
    query: string,
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    _isAnime: boolean = false
  ): Promise<TmdbResult[]> {
    return this.searchMultipleTypes(query, mediaType);
  }
}

export const tmdbAPI = new TmdbAPI();
export default tmdbAPI;
