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
 * Load the quality profile assigned to a media type
 */
export function loadAssignedQualityProfile(mediaType, qualityProfiles, assignments) {
  const isMovie = mediaType === 'movie';
  const assignedId = isMovie ? assignments?.movie_profile_id : assignments?.tv_profile_id;

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
