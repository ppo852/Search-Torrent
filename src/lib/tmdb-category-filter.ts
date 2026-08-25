/** Genre TMDB Animation (films animés + séries animées). */
export const TMDB_ANIMATION_GENRE_ID = 16;

export function hasTmdbAnimationGenre(
  item: { genres?: Array<{ id: number }> | null } | null | undefined
): boolean {
  return Boolean(item?.genres?.some((g) => g.id === TMDB_ANIMATION_GENRE_ID));
}

/**
 * Filtre les résultats TMDB selon la catégorie de recherche UI.
 * movies / animation = films ; tv / anime = séries.
 */
export function filterTmdbBySearchCategory<
  T extends { type?: string; genres?: Array<{ id: number }> }
>(items: T[], category?: string | null): T[] {
  if (!category) return items;

  if (category === 'tv') {
    return items.filter((item) => !hasTmdbAnimationGenre(item));
  }
  if (category === 'anime') {
    return items.filter((item) => item.type === 'tv' && hasTmdbAnimationGenre(item));
  }
  if (category === 'movies') {
    return items.filter((item) => item.type === 'movie' && !hasTmdbAnimationGenre(item));
  }
  if (category === 'animation') {
    return items.filter((item) => item.type === 'movie' && hasTmdbAnimationGenre(item));
  }

  return items;
}
