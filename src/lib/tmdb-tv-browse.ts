/** Config rangées séries TMDB (accueil + Voir plus). */

export type TmdbTvBrowseKind = 'recent-streaming' | 'trending';

export type TmdbTvBrowseSection = {
  kind: TmdbTvBrowseKind;
  slug: string;
  title: string;
  browsePath: string;
  emptyLabel: string;
};

export const TMDB_TV_BROWSE_SECTIONS: TmdbTvBrowseSection[] = [
  {
    kind: 'recent-streaming',
    slug: 'recents-plateformes',
    title: 'Séries récentes — plateformes',
    browsePath: '/series/recents-plateformes',
    emptyLabel: 'Aucune série récente sur les plateformes',
  },
  {
    kind: 'trending',
    slug: 'tendance',
    title: 'Séries tendance',
    browsePath: '/series/tendance',
    emptyLabel: 'Aucune série tendance pour le moment',
  },
];

export function getTvBrowseSectionBySlug(slug: string): TmdbTvBrowseSection | null {
  return TMDB_TV_BROWSE_SECTIONS.find((s) => s.slug === slug) || null;
}
