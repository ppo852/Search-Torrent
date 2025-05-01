export interface SearchResult {
  name: string;
  link: string;
  size: number;
  seeds: number;
  leech: number;
  engine_url: string;
  desc_link: string;
  category: string;
  publishDate?: string; // Champ optionnel pour la date de publication
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

export type SortOption = 'name' | 'size' | 'seeds' | 'leech';

export type CategoryType = 'all' | 'movies' | 'tv' | 'anime' | 'music' | 'software' | 'books';

export type SubCategoryType = 'all' | 'sd' | 'hd' | 'uhd' | 'bluray';

export interface TmdbResult {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string;
  posterPath: string;
  type: 'movie' | 'tv';
  overview: string;
  voteAverage: number;
}

// Mapping des catégories principales
export const CATEGORY_MAPPING: Record<CategoryType, number[]> = {
  all: [],
  movies: [2000, 2030, 2040, 2045, 2050, 2060, 2070],  // Films SD, HD, UHD, BluRay, etc.
  tv: [5000, 5030, 5040, 5045, 5050, 5060],  // Séries SD, HD, UHD, etc.
  anime: [5070],
  music: [3000, 3010, 3020, 3030, 3040, 3050],  // MP3, FLAC, etc.
  software: [4000, 4050, 4060],  // PC, Mac, etc.
  books: [7000, 7020, 7030]  // Ebooks, Magazines, etc.
};

// Mapping des sous-catégories
export const SUBCATEGORY_MAPPING: Record<CategoryType, Record<SubCategoryType, number[]>> = {
  movies: {
    all: [2030, 2040, 2045, 2050],
    sd: [2030],
    hd: [2040],
    uhd: [2045],
    bluray: [2050]
  },
  tv: {
    all: [5030, 5040, 5045],
    sd: [5030],
    hd: [5040],
    uhd: [5045],
    bluray: []
  },
  anime: {
    all: [5070],
    sd: [],
    hd: [],
    uhd: [],
    bluray: []
  },
  music: {
    all: [3000],
    sd: [],
    hd: [],
    uhd: [],
    bluray: []
  },
  software: {
    all: [4000],
    sd: [],
    hd: [],
    uhd: [],
    bluray: []
  },
  books: {
    all: [7000],
    sd: [],
    hd: [],
    uhd: [],
    bluray: []
  },
  all: {
    all: [],
    sd: [],
    hd: [],
    uhd: [],
    bluray: []
  }
};