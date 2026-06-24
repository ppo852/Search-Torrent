export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name?: string;
  official?: boolean;
  iso_639_1?: string;
  iso_3166_1?: string;
  published_at?: string;
}

function isPlayable(video: TmdbVideo): boolean {
  return Boolean(video.key && (video.site === 'YouTube' || video.site === 'Vimeo'));
}

function isSeasonTrailer(name?: string): boolean {
  const n = String(name || '');
  return /\bseason\s*\d|\bsaison\s*\d|\b\d(?:st|nd|rd|th)\s+season\b/i.test(n);
}

function isMainOfficialTrailerName(name?: string): boolean {
  const n = String(name || '').trim();
  return /trailer officiel/i.test(n) || /^official trailer\b/i.test(n);
}

function byPublishedAtDesc(a: TmdbVideo, b: TmdbVideo): number {
  const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
  const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
  return bTime - aTime;
}

/** Aligné TMDB FR : FR / officiel d'abord, pas seulement en. */
function localeFitScore(video: TmdbVideo): number {
  const name = String(video.name || '').toLowerCase();
  const region = video.iso_3166_1?.toUpperCase();
  const lang = video.iso_639_1?.toLowerCase();

  if (region === 'FR' || lang === 'fr' || name.includes('officiel')) return 0;
  if (lang === 'en' || /\bofficial trailer\b/.test(name)) return 1;
  return 2;
}

function compareTrailers(a: TmdbVideo, b: TmdbVideo): number {
  const officialDiff = Number(b.official) - Number(a.official);
  if (officialDiff) return officialDiff;

  const seasonDiff = Number(isSeasonTrailer(a.name)) - Number(isSeasonTrailer(b.name));
  if (seasonDiff) return seasonDiff;

  const localeDiff = localeFitScore(a) - localeFitScore(b);
  if (localeDiff) return localeDiff;

  const nameDiff = Number(isMainOfficialTrailerName(b.name)) - Number(isMainOfficialTrailerName(a.name));
  if (nameDiff) return nameDiff;

  const typeDiff = (a.type === 'Trailer' ? 0 : 1) - (b.type === 'Trailer' ? 0 : 1);
  if (typeDiff) return typeDiff;

  return byPublishedAtDesc(a, b);
}

function pickBestFrom(candidates: TmdbVideo[]): TmdbVideo | null {
  if (!candidates.length) return null;
  return [...candidates].sort(compareTrailers)[0];
}

function getTrailerCandidates(videos: TmdbVideo[]): TmdbVideo[] {
  const playable = videos.filter(isPlayable);
  if (!playable.length) return [];

  const trailers = playable.filter((v) => v.type === 'Trailer');
  const pool = trailers.length ? trailers : playable.filter((v) => v.type === 'Teaser');
  return pool.length ? pool : playable;
}

/**
 * Sélection proche TMDB (locale FR) : trailer série principal, pas saison récente geo-bloquée.
 */
export function pickBestTrailer(videos: TmdbVideo[]): TmdbVideo | null {
  return pickBestFrom(getTrailerCandidates(videos));
}

/** Gate fetch FR : au moins une vidéo YouTube/Vimeo de type Trailer ou Teaser. */
export function hasPlayableTrailer(videos: TmdbVideo[]): boolean {
  return getTrailerCandidates(videos).length > 0;
}

export function getVideoEmbedUrl(video: TmdbVideo): string | null {
  if (video.site === 'YouTube') {
    return `https://www.youtube.com/embed/${video.key}?autoplay=1&rel=0`;
  }
  if (video.site === 'Vimeo') {
    return `https://player.vimeo.com/video/${video.key}?autoplay=1`;
  }
  return null;
}
