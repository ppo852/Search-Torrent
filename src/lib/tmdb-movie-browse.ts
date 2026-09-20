/** Config rangées films TMDB (accueil + Voir plus). */

export type TmdbMovieBrowseKind =
  | 'upcoming-cinema'
  | 'recent-streaming'
  | 'now-playing';

export type TmdbMovieBrowseSection = {
  kind: TmdbMovieBrowseKind;
  /** Segment d’URL /films/:slug */
  slug: string;
  title: string;
  browsePath: string;
  emptyLabel: string;
};

export const TMDB_MOVIE_BROWSE_SECTIONS: TmdbMovieBrowseSection[] = [
  {
    kind: 'upcoming-cinema',
    slug: 'a-venir-cinema',
    title: 'Films à venir — cinéma',
    browsePath: '/films/a-venir-cinema',
    emptyLabel: 'Aucun film à venir au cinéma',
  },
  {
    kind: 'recent-streaming',
    slug: 'recents-plateformes',
    title: 'Films récents — plateformes',
    browsePath: '/films/recents-plateformes',
    emptyLabel: 'Aucun film récent sur les plateformes',
  },
  {
    kind: 'now-playing',
    slug: 'au-cinema',
    title: 'Films au cinéma',
    browsePath: '/films/au-cinema',
    emptyLabel: 'Aucun film au cinéma pour le moment',
  },
];

export function getMovieBrowseSectionBySlug(slug: string): TmdbMovieBrowseSection | null {
  // Ancienne URL « à venir plateformes »
  if (slug === 'a-venir-plateformes') {
    return TMDB_MOVIE_BROWSE_SECTIONS.find((s) => s.kind === 'recent-streaming') || null;
  }
  return TMDB_MOVIE_BROWSE_SECTIONS.find((s) => s.slug === slug) || null;
}
