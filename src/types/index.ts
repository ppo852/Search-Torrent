export interface SearchResult {
  name: string;
  link: string;
  size: number;
  seeds: number;
  leech: number;
  engine_url: string;
  desc_link: string;
  category: string;
  categoryId?: number;
  publishDate?: string;
  is_compatible?: boolean;
  incompatible_reason?: string | null;
}

export interface Config {
  prowlarr: {
    apiKey: string;
    url: string;
  };
  qbittorrent: {
    url: string;
    username?: string;
    password?: string;
  };
  user: {
    id: string;
    name: string;
  };
}

export type SortOption = 'name' | 'size' | 'seeds' | 'leech' | 'date';

export type CategoryType = 'all' | 'movies' | 'tv' | 'anime' | 'music' | 'software' | 'books';

export interface TmdbResult {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string;
  posterPath: string;
  type: 'movie' | 'tv';
  overview: string;
  voteAverage: number;
  genres?: { id: number; name: string }[]; // Ajouté pour filtrage
}