// Types pour les composants RSS

// Interface pour les flux RSS
export interface RssFeed {
  id: string;
  feed_name: string;
  feed_url: string;
}

// Interface pour les éléments RSS avec données TMDB optionnelles
export interface RssFeedItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  size: number;
  category: string;
  torrent: string;
  feedName: string;
  tmdb?: {
    tmdb_id?: number;
    media_type?: 'movie' | 'tv';
    title?: string;
    poster_path?: string;
  } | null;
  // Pour la rétrocompatibilité avec le code existant
  tmdbPoster?: string | null;
  tmdbId?: number;
  tmdbType?: 'movie' | 'tv';
  torznab_attr?: {
    seeders: number;
    peers: number;
    grabs: number;
    downloadvolumefactor: number;
    uploadvolumefactor: number;
  };
}

// Interface pour la réponse API avec statut TMDB
export interface RssApiResponse {
  items: RssFeedItem[];
  tmdbAvailable: boolean;
  fromExpiredCache?: boolean;
}

// Interface pour les éléments groupés par catégorie
export interface GroupedItems {
  [category: string]: RssFeedItem[];
}

// Interface pour les props du composant TitleWithPoster
export interface TitleWithPosterProps {
  poster: string | null | undefined;
  originalTitle: string;
  tmdbAvailable?: boolean;
}
