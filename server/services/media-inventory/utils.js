// Utilities for media-inventory: shared normalization and parsing wrappers

export function normalizeTitleForDb(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

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
    // Dependency not available; caller should fallback
    return { ok: false };
  }

  try {
    const parsed = ptn(src) || {};
    const title = String(parsed.title || '').trim();
    const yearNum = Number(parsed.year);
    const seasonNum = Number(parsed.season);
    const episodeNum = Number(parsed.episode);

    const hasTitle = title.length >= 2;
    const plausibleYear = Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2100;

    // Consider it OK if we have a title, year optional for TV or sometimes movies
    const ok = hasTitle || plausibleYear;

    return {
      ok,
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
