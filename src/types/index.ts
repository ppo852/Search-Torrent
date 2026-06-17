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
<<<<<<< HEAD
}
=======
}

// Mapping des catégories principales
export const CATEGORY_MAPPING: Record<CategoryType, number[]> = {
  all: [],
  movies: [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080, 2090],
  tv: [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5080, 5090, 5100, 5110],
  anime: [5070],
  music: [3000, 3010, 3020, 3030, 3040, 3050, 3060, 3070],
  software: [4000, 4010, 4020, 4030, 4040, 4050, 4060, 4070, 4080],
  books: [7000, 7010, 7020, 7030, 7040, 7050, 7060, 7070]
};

// Mapping des sous-catégories
export const SUBCATEGORY_MAPPING: Record<CategoryType, Record<SubCategoryType, number[]>> = {
  movies: {
    all: [2030, 2040, 2045, 2050, 2070, 2080, 2090],
    sd: [2030],
    hd: [2040],
    uhd: [2045],
    bluray: [2050]
  },
  tv: {
    all: [5020, 5030, 5040, 5090, 5100, 5110],
    sd: [5020],
    hd: [5030],
    uhd: [5040],
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
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
