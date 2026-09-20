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

export type SortOption = 'name' | 'size' | 'seeds' | 'date';

export type CategoryType = 'all' | 'movies' | 'tv' | 'anime' | 'animation' | 'music' | 'software' | 'books';

export interface TmdbResult {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string;
  posterPath: string;
  backdropPath?: string | null;
  type: 'movie' | 'tv';
  overview: string;
  voteAverage: number;
  genres?: { id: number; name: string }[]; // Ajouté pour filtrage
}

/** Demande de surveillance d'une saison (table tv_season_requests). */
export interface TvSeasonRequest {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'tv' | 'anime';
  title: string;
  poster_url: string | null;
  season_number: number;
  status?: string;
  next_episode_number?: number;
  last_checked_at?: string | null;
  last_error?: string | null;
  matched_torrent_name?: string | null;
  matched_torrent_magnet?: string | null;
  matched_torrent_size?: number | null;
  matched_torrent_seeds?: number | null;
  created_at: string;
  requested_by?: string | null;
}

/** Réponse GET /api/library/tv/:id/presence — état des épisodes sur disque / qBit. */
export interface TvSeasonPresence {
  id?: string;
  tmdb_id?: number;
  season_number?: number;
  present_episodes: number[];
  downloading_episodes: number[];
  error_episodes?: number[];
  missing_episodes: number[];
  next_episode_number?: number;
  status?: string;
}

/** Statuts possibles pour une demande film (`media_requests`). */
export type MediaRequestStatus =
  | 'pending'
  | 'found'
  | 'sent_to_qbit'
  | 'downloading'
  | 'error'
  | 'completed'
  | 'monitoring'
  | 'already_available';

/** Utilisateur renvoyé par GET/PUT /api/users (administration). */
export interface AdminUser {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  qbit_url?: string;
  has_qbit_api_key?: boolean;
  download_path_movies?: string;
  download_path_series?: string;
  download_path_anime?: string;
  download_path_animation?: string;
  allow_force_interactive_download?: boolean;
}

/** Session connectée (authStore / login). */
export interface SessionUser {
  id: string;
  username: string;
  is_admin: boolean;
  allow_force_interactive_download?: boolean;
  qbit_url?: string;
  last_seen_app_version?: string | null;
  /** password = login Search ; organizr = session liée au cookie Organizr */
  auth_via?: 'password' | 'organizr';
}