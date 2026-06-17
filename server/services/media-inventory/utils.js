// Utilities for media-inventory: shared normalization and parsing wrappers
import path from 'path';

export const MEDIA_MARKERS_REGEX = /\b(19\d{2}|20\d{2}|S\d+(?:E\d+)?|[0-9]+x[0-9]+|multi|vff|vfq|vfi|vf|vostfr|vo|french|truefrench|bluray|brrip|dvdrip|hdtv|web-?dl|webrip|720p|1080p|2160p|4k|xvid|divx|x264|x265|h264|h265|hevc|ac3|dts|aac|synd)\b/i;

export function normalizeTitleForDb(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Aggressive cleaning: cuts the title at the first occurrence of a technical marker.
 */
export function cleanMediaTitle(source) {
  if (!source) return '';
  let s = String(source);
  
  // Remove site tags at the beginning (e.g. [Torrent911])
  s = s.replace(/^(?:\[[^\]]+\]\s*)+/g, '');

  // Split title at the first technical marker (S01, 1080p, x264, etc.)
  const match = s.match(MEDIA_MARKERS_REGEX);
  if (match && match.index != null && match.index > 2) {
    s = s.slice(0, match.index);
  }

  return s
    .replace(/[._\-]+/g, ' ')
    .replace(/[()]/g, '')
    .trim();
}

/**
 * Searches the download history to automatically link a file with its TMDB ID.
 */
export async function matchTmdbIdFromHistory(filePath, kind) {
  try {
    const { get } = await import('../core/db.js');
    const filename = path.basename(filePath);
    
    if (kind === 'movie') {
      const match = await get(
        `SELECT tmdb_id FROM media_requests 
         WHERE ? LIKE '%' || matched_torrent_name || '%' OR matched_torrent_name LIKE '%' || ? || '%'
         LIMIT 1`,
        [filename, filename]
      );
      return match?.tmdb_id || null;
    } else {
      const match = await get(
        `SELECT r.tmdb_id 
         FROM tv_episode_downloads d
         JOIN tv_season_requests r ON d.tv_season_request_id = r.id
         WHERE ? LIKE '%' || d.torrent_name || '%' OR d.torrent_name LIKE '%' || ? || '%'
         LIMIT 1`,
        [filename, filename]
      );
      return match?.tmdb_id || null;
    }
  } catch {
    return null;
  }
}

// Lightweight wrapper around parse-torrent-name with graceful fallback
export async function parseTorrentSafe(name) {
  const src = String(name || '').trim();
  if (!src) {
    return { ok: false };
  }

  let ptn;
  try {
    const mod = await import('parse-torrent-name');
    ptn = mod?.default || mod;
  } catch (err) {
    return { ok: false };
  }

  try {
    // Pre-clean: replace French tags with 'FRENCH' so ptn recognizes them as tags to exclude
    const cleanSrc = src.replace(/\b(multi|vff|vfq|vfi|vostfr|truefrench)\b/gi, 'FRENCH');
    const parsed = ptn(cleanSrc) || {};
    const title = String(parsed.title || '').trim();
    const yearNum = Number(parsed.year);
    let seasonNum = Number(parsed.season);
    let episodeNum = Number(parsed.episode);

    // Fallback regex for 3/4-digit episodes or other missing season/episode numbers
    if (!Number.isInteger(episodeNum) || episodeNum <= 0) {
      // Try matching SxxExxx (standard or 3/4 digits)
      const sxeMatch = src.match(/\bS(\d{1,2})[\s._-]*E(\d{1,4})\b/i);
      if (sxeMatch) {
        seasonNum = Number(sxeMatch[1]);
        episodeNum = Number(sxeMatch[2]);
      } else {
        // Try matching xxNxxx (like 03x103)
        const xMatch = src.match(/\b(\d{1,2})x(\d{1,4})\b/i);
        if (xMatch) {
          seasonNum = Number(xMatch[1]);
          episodeNum = Number(xMatch[2]);
        }
      }
    }

    const hasTitle = title.length >= 2;
    const plausibleYear = Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2100;

    return {
      ok: hasTitle || plausibleYear,
      title: hasTitle ? title : null,
      year: plausibleYear ? yearNum : null,
      season: Number.isInteger(seasonNum) && seasonNum > 0 ? seasonNum : null,
      episode: Number.isInteger(episodeNum) && episodeNum > 0 ? episodeNum : null,
      raw: parsed
    };
  } catch {
    return { ok: false };
  }
}
