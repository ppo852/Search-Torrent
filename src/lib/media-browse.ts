/** Limite d’aperçu accueil (rangées TMDB + RSS « à télécharger »). */
export const MEDIA_PREVIEW_LIMIT = 8;

/** State React Router pour un retour contextuel depuis une fiche média. */
export type MediaBrowseReturnState = {
  from: string;
  fromLabel: string;
};

export function buildMediaBrowseState(from: string, fromLabel: string): MediaBrowseReturnState {
  return { from, fromLabel };
}
