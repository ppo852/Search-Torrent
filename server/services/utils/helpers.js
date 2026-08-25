/**
 * Utilitaires partagés pour les services Backend
 */
import { getSetting } from '../settings/index.js';

/**
 * Pad a number with leading zeros
 */
export function pad2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '00';
  return String(v).padStart(2, '0');
}

/**
 * Parse a date string to milliseconds
 */
export function parseDateToMs(value) {
  if (!value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Normalize a string for comparison (lowercase, no accents, alphanumeric only)
 */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/gi, ' ')
    .trim();
}

/**
 * Simplify a title for search (remove special chars)
 */
export function simplifyTitle(title) {
  return String(title || '')
    .replace(/[,\-:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Films et Animation partagent la logique « movie-like » (inventaire, etc.)
 */
export function isMovieLikeMediaType(mediaType) {
  return mediaType === 'movie' || mediaType === 'animation';
}

/**
 * Profil qualité assigné au type de média.
 * Animation → animation_profile_id puis repli movie_profile_id
 * Anime → anime_profile_id puis repli tv_profile_id
 */
export function loadAssignedQualityProfile(mediaType, qualityProfiles, assignments) {
  const a = assignments || {};
  let assignedId = null;

  switch (mediaType) {
    case 'animation':
      assignedId = a.animation_profile_id || a.movie_profile_id;
      break;
    case 'anime':
      assignedId = a.anime_profile_id || a.tv_profile_id;
      break;
    case 'movie':
      assignedId = a.movie_profile_id;
      break;
    case 'tv':
    default:
      assignedId = a.tv_profile_id;
      break;
  }

  if (!assignedId) return null;
  return (qualityProfiles || []).find((p) => p?.id === assignedId) || null;
}

/**
 * Helper to pick the best download link from a Prowlarr result
 */
export function pickBestProwlarrLink(item) {
  const downloadUrl = item?.downloadUrl;
  const guid = item?.guid;
  const magnetUri = item?.magnetUrl || item?.magnet;

  const isMagnet = (v) => typeof v === 'string' && v.startsWith('magnet:?');
  const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

  // Prefer magnets over HTTP links
  if (isMagnet(magnetUri)) return magnetUri;
  if (isMagnet(downloadUrl)) return downloadUrl;
  if (isMagnet(guid)) return guid;

  if (isHttp(downloadUrl)) return downloadUrl;
  if (isHttp(guid)) return guid;
  return null;
}
