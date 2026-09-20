import type { TmdbResult } from '../types';
import { RSS_HOME_HOURS } from '../../shared/rss-home-hours.js';

export { RSS_HOME_HOURS };

export type RssHomeSectionKey = 'films' | 'animations' | 'series' | 'anime';

export interface HomeRssItem {
  tmdb: {
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    release_date?: string;
    vote_average?: number;
  };
}

export interface RecentHomeResponse {
  films: HomeRssItem[];
  animations: HomeRssItem[];
  series: HomeRssItem[];
  anime: HomeRssItem[];
  hours: number;
  /** false = token TMDB absent → séries/anime home non enrichis */
  tmdbConfigured: boolean;
}

export type RssHomeSectionConfig = {
  key: RssHomeSectionKey;
  title: string;
  browsePath: string;
  mediaType: 'movie' | 'tv';
  accentBarClass: string;
  loadingLabel: string;
  errorLabel: string;
  emptyLabel: string;
};

export const RSS_HOME_SECTIONS: RssHomeSectionConfig[] = [
  {
    key: 'films',
    title: 'Nouveaux films à télécharger',
    browsePath: '/a-telecharger/films',
    mediaType: 'movie',
    accentBarClass: 'before:bg-gradient-to-b before:from-orange-500 before:to-red-600',
    loadingLabel: 'Chargement des nouveaux films...',
    errorLabel: 'Impossible de charger les nouveaux films',
    emptyLabel: 'Aucun nouveau film à télécharger',
  },
  {
    key: 'animations',
    title: 'Nouvelles animations à télécharger',
    browsePath: '/a-telecharger/animations',
    mediaType: 'movie',
    accentBarClass: 'before:bg-gradient-to-b before:from-violet-500 before:to-purple-600',
    loadingLabel: 'Chargement des nouvelles animations...',
    errorLabel: 'Impossible de charger les nouvelles animations',
    emptyLabel: 'Aucune nouvelle animation à télécharger',
  },
  {
    key: 'series',
    title: 'Nouvelles séries à télécharger',
    browsePath: '/a-telecharger/series',
    mediaType: 'tv',
    accentBarClass: 'before:bg-gradient-to-b before:from-blue-500 before:to-indigo-600',
    loadingLabel: 'Chargement des nouvelles séries...',
    errorLabel: 'Impossible de charger les nouvelles séries',
    emptyLabel: 'Aucune nouvelle série à télécharger',
  },
  {
    key: 'anime',
    title: 'Nouveaux animes à télécharger',
    browsePath: '/a-telecharger/anime',
    mediaType: 'tv',
    accentBarClass: 'before:bg-gradient-to-b before:from-pink-500 before:to-purple-600',
    loadingLabel: 'Chargement des nouveaux animes...',
    errorLabel: 'Impossible de charger les nouveaux animes',
    emptyLabel: 'Aucun nouvel anime à télécharger',
  },
];

export function homeRssItemToTmdbResult(
  item: HomeRssItem,
  mediaType: 'movie' | 'tv'
): TmdbResult {
  return {
    id: item.tmdb.tmdb_id,
    title: item.tmdb.title,
    originalTitle: item.tmdb.title,
    releaseDate: item.tmdb.release_date || '',
    posterPath: item.tmdb.poster_url || '',
    type: mediaType,
    overview: '',
    voteAverage: item.tmdb.vote_average ?? 0,
  };
}
