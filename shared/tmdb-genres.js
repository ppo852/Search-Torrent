/**
 * Genres TMDB — libellés FR + détection émissions (Talk / Reality / News).
 * Les IDs sont stables ; les noms API restent parfois en anglais même en fr-FR.
 */

export const TMDB_TV_NEWS_GENRE_ID = 10763;
export const TMDB_TV_REALITY_GENRE_ID = 10764;
export const TMDB_TV_TALK_GENRE_ID = 10767;

/** Émissions / plateaux : date d’épisode dans le release ≠ année de 1ʳᵉ diffusion. */
export const TMDB_BROADCAST_EPISODIC_GENRE_IDS = new Set([
  TMDB_TV_NEWS_GENRE_ID,
  TMDB_TV_REALITY_GENRE_ID,
  TMDB_TV_TALK_GENRE_ID,
]);

/** Libellés FR par id TMDB (films + séries). */
export const TMDB_GENRE_LABELS_FR = {
  28: 'Action',
  12: 'Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  14: 'Fantastique',
  36: 'Histoire',
  27: 'Horreur',
  10402: 'Musique',
  9648: 'Mystère',
  10749: 'Romance',
  878: 'Science-Fiction',
  10770: 'Téléfilm',
  53: 'Thriller',
  10752: 'Guerre',
  37: 'Western',
  // TV
  10759: 'Action & Aventure',
  10762: 'Enfants',
  10763: 'Infos',
  10764: 'Télé-réalité',
  10765: 'Science-Fiction & Fantastique',
  10766: 'Feuilleton',
  10767: 'Émission',
  10768: 'Guerre & Politique',
};

/** Secours si l’API renvoie un nom EN sans id connu. */
const TMDB_GENRE_NAME_FR = {
  talk: 'Émission',
  'talk-show': 'Émission',
  'talk show': 'Émission',
  reality: 'Télé-réalité',
  news: 'Infos',
  soap: 'Feuilleton',
  kids: 'Enfants',
  'sci-fi & fantasy': 'Science-Fiction & Fantastique',
  'science fiction': 'Science-Fiction',
  'action & adventure': 'Action & Aventure',
  'war & politics': 'Guerre & Politique',
  adventure: 'Aventure',
  comedy: 'Comédie',
  documentary: 'Documentaire',
  drama: 'Drame',
  family: 'Familial',
  fantasy: 'Fantastique',
  history: 'Histoire',
  horror: 'Horreur',
  music: 'Musique',
  mystery: 'Mystère',
  romance: 'Romance',
  thriller: 'Thriller',
  war: 'Guerre',
  western: 'Western',
  'tv movie': 'Téléfilm',
  animation: 'Animation',
  action: 'Action',
  crime: 'Crime',
};

export function isBroadcastEpisodicGenres(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return false;
  return genres.some((g) => TMDB_BROADCAST_EPISODIC_GENRE_IDS.has(Number(g?.id)));
}

export function getTmdbGenreLabel(genre) {
  if (!genre) return '';
  const byId = TMDB_GENRE_LABELS_FR[Number(genre.id)];
  if (byId) return byId;
  const raw = String(genre.name || '').trim();
  if (!raw) return '';
  const mapped = TMDB_GENRE_NAME_FR[raw.toLowerCase()];
  return mapped || raw;
}
