// Utilities for media-inventory: shared normalization and parsing wrappers
<<<<<<< HEAD
import path from 'path';

export const MEDIA_MARKERS_REGEX = /\b(19\d{2}|20\d{2}|S\d+(?:E\d+)?|[0-9]+x[0-9]+|multi|vff|vfq|vfi|vf|vostfr|vo|french|truefrench|bluray|brrip|dvdrip|hdtv|web-?dl|webrip|720p|1080p|2160p|4k|xvid|divx|x264|x265|h264|h265|hevc|ac3|dts|aac|synd)\b/i;
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

export function normalizeTitleForDb(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

<<<<<<< HEAD
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
=======
// Normalization for building clean search queries from noisy titles
export function normalizeTitleForSearch(value) {
  let s = String(value || '');
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/[\[(][^\])]+[\])]/g, ' ');
  s = s.replace(/[^a-zA-Z0-9]+/g, ' ');
  s = s.replace(/\bblu\s*ray\b/gi, 'bluray')
       .replace(/\bweb\s*dl\b/gi, 'webdl')
       .replace(/\bxvi\s*d\b/gi, 'xvid')
       .replace(/\bh\s*264\b/gi, 'h264')
       .replace(/\bh\s*265\b/gi, 'h265');
  const rawTokens = s.trim().split(/\s+/);
  const clean = [];
  const techSet = new Set([
    'french','truefrench','subfrench','vostfr','vf','vo',
    '480p','720p','1080p','2160p','4k','8k',
    'bluray','brrip','webrip','webdl','web','hdtv','dvdrip','hdrip','remux',
    'x264','x265','h264','h265','hevc','xvid','divx','avc','aac','ac3','dts','atmos',
    'mkv','mp4','avi','mov'
  ]);
  const providerIds = new Set(['imdb','tvdbid','tmdb','tmdbid']);
  let i = 0;
  while (i < rawTokens.length) {
    const t = rawTokens[i];
    const lower = t.toLowerCase();
    const isYear = /^(19\d{2}|20\d{2})$/.test(lower);
    if (providerIds.has(lower)) { i += 2; continue; }
    if (techSet.has(lower)) break;
    if (isYear && clean.length > 0) break;
    clean.push(t);
    i++;
  }
  return clean.join(' ').trim();
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
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
<<<<<<< HEAD
=======
    // Dependency not available; caller should fallback
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    return { ok: false };
  }

  try {
<<<<<<< HEAD
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
=======
    const parsed = ptn(src) || {};
    const title = String(parsed.title || '').trim();
    const yearNum = Number(parsed.year);
    const seasonNum = Number(parsed.season);
    const episodeNum = Number(parsed.episode);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

    const hasTitle = title.length >= 2;
    const plausibleYear = Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2100;

<<<<<<< HEAD
    return {
      ok: hasTitle || plausibleYear,
=======
    // Consider it OK if we have a title, year optional for TV or sometimes movies
    const ok = hasTitle || plausibleYear;

    return {
      ok,
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
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
