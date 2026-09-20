import fetch from 'node-fetch';
import { getSetting } from '../../services/settings/index.js';
import { getAppCache, setAppCache } from '../../services/core/app-cache.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const BROWSE_CACHE_TTL_MINUTES = 180;

const cache = new Map();

function cacheKey(path, params) {
  const qs = new URLSearchParams(params || {}).toString();
  return `${path}?${qs}`;
}

async function getTmdbToken() {
  const token = await getSetting('tmdb_access_token');
  if (!token || typeof token !== 'string') {
    return null;
  }
  return token;
}

/**
 * Test connexion TMDB (admin). Accepte access_token / tmdb_access_token en body.
 */
export async function testTmdbHandler(req, res) {
  try {
    const body = req.body || {};
    let token =
      typeof body.access_token === 'string'
        ? body.access_token.trim()
        : typeof body.tmdb_access_token === 'string'
          ? body.tmdb_access_token.trim()
          : '';

    if (!token) {
      token = String((await getTmdbToken()) || '').trim();
    }

    if (!token) {
      return res.status(400).json({ success: false, error: 'TMDB non configuré' });
    }

    const response = await fetch('https://api.themoviedb.org/3/configuration', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `HTTP ${response.status}`,
      });
    }

    const data = await response.json().catch(() => ({}));
    return res.json({
      success: true,
      imagesBaseUrl: data?.images?.secure_base_url || null,
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Échec de connexion TMDB',
    });
  }
}

async function fetchTmdb(path, params) {
  const key = cacheKey(path, params);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const token = await getTmdbToken();
  if (!token) {
    throw new Error("TMDB n'est pas configuré (token manquant)");
  }

  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') {
      url.searchParams.append(k, String(v));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TMDB API error: ${response.status}${text ? ` - ${text}` : ''}`);
  }

  const data = await response.json();
  cache.set(key, { expiresAt: now + ONE_HOUR_MS, data });
  return data;
}

function mapTmdbListResult(items, type) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((item) => {
    const title = type === 'movie' ? item.title : item.name;
    const originalTitle = type === 'movie' ? item.original_title : item.original_name;
    const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;

    return {
      id: item.id,
      title: title || '',
      originalTitle: originalTitle || title || '',
      releaseDate: releaseDate || '',
      posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      type,
      overview: item.overview || '',
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : 0
    };
  });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function cleanTitle(title) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  let q = title
    .replace(/\{imdb-[^\}]+\}/gi, '')
    .replace(/\[tvdbid-[^\]]+\]/gi, '')
    .replace(/\{tmdb-[^\}]+\}/gi, '')
    .replace(/\[tmdbid-[^\]]+\]/gi, '')
    .replace(/\(\d{4}\).*$/, '')
    .replace(/[._-]\d{4}[._-].*$/, '')
    .replace(/[._-]\d{4}$/, '')
    .replace(/[._-](480p|720p|1080p|2160p|4k).*$/i, '')
    .replace(/[._-](bluray|brrip|webrip|web-dl|webdl|hdtv|dvdrip).*$/i, '')
    .replace(/[._-](x264|x265|h264|h265|hevc|xvid|divx|avc).*$/i, '')
    .replace(/-[A-Z0-9]+$/, '')
    .replace(/[._+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (year && q && !q.includes(year)) {
    q = `${q} ${year}`;
  }

  return q;
}

function mapSearchResultItem(item, type) {
  return {
    id: item.id,
    title: type === 'movie' ? item.title : item.name,
    originalTitle: type === 'movie' ? item.original_title : item.original_name,
    releaseDate: type === 'movie' ? item.release_date : item.first_air_date,
    posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
    type,
    overview: item.overview || '',
    voteAverage: typeof item.vote_average === 'number' ? item.vote_average : 0,
    genres: Array.isArray(item.genre_ids)
      ? item.genre_ids.map((id) => ({ id, name: '' }))
      : []
  };
}

function hasPlayableTrailer(videos) {
  return videos.some(
    (v) =>
      v?.key &&
      (v.site === 'YouTube' || v.site === 'Vimeo') &&
      (v.type === 'Trailer' || v.type === 'Teaser')
  );
}

/** Langues vidéo TMDB à fusionner (FR d’abord côté pickBestTrailer). */
const VIDEO_INCLUDE_LANGUAGES = 'fr,en,nl,de,es,it,pt,ja,ko,zh,null';

async function fetchVideosForMedia(mediaType, id) {
  const fr = await fetchTmdb(`/${mediaType}/${id}/videos`, {
    language: 'fr-FR',
    include_video_language: VIDEO_INCLUDE_LANGUAGES,
  });
  const frResults = Array.isArray(fr?.results) ? fr.results : [];
  if (hasPlayableTrailer(frResults)) {
    return fr;
  }

  // Fallback : sans language UI, mais toutes langues vidéo (ex. BA NL sans FR/EN).
  return fetchTmdb(`/${mediaType}/${id}/videos`, {
    include_video_language: VIDEO_INCLUDE_LANGUAGES,
  });
}

export async function searchTmdbHandler(req, res) {
  try {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      return res.json([]);
    }

    const mediaType = req.query.mediaType === 'movie' || req.query.mediaType === 'tv'
      ? req.query.mediaType
      : 'all';
    const originalQuery = typeof req.query.originalQuery === 'string'
      ? req.query.originalQuery
      : rawQuery;
    const query = cleanTitle(rawQuery);
    const isAnime = /anime|アニメ/.test(originalQuery.toLowerCase());
    const types = mediaType === 'all' ? ['movie', 'tv'] : [mediaType];
    const results = [];

    for (const type of types) {
      try {
        const params = {
          query,
          language: 'fr-FR',
          include_adult: 'false'
        };
        if (isAnime) {
          params.with_genres = '16';
        }

        const data = await fetchTmdb(`/search/${type}`, params);
        for (const item of data?.results || []) {
          results.push(mapSearchResultItem(item, type));
        }
      } catch {
        // ignore per-type failures
      }
    }

    results.sort((a, b) => b.voteAverage - a.voteAverage);
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}

export async function getMovieDetailsHandler(req, res) {
  try {
    const data = await fetchTmdb(`/movie/${req.params.id}`, { language: 'fr-FR' });
    const videos = await fetchVideosForMedia('movie', req.params.id);
    res.json({ ...data, videos });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}

export async function getTvDetailsHandler(req, res) {
  try {
    const data = await fetchTmdb(`/tv/${req.params.id}`, { language: 'fr-FR' });
    const videos = await fetchVideosForMedia('tv', req.params.id);
    res.json({ ...data, videos });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}

export async function getTvSeasonDetailsHandler(req, res) {
  try {
    const data = await fetchTmdb(
      `/tv/${req.params.id}/season/${req.params.seasonNumber}`,
      { language: 'fr-FR' }
    );
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}

const MOVIE_BROWSE_KINDS = new Set(['upcoming-cinema', 'recent-streaming', 'now-playing']);
/** Fenêtre « vient de sortir » pour les plateformes (jours). */
const STREAMING_RECENT_DAYS = 90;

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchMovieBrowseList(kind, limit) {
  const today = todayIso();
  const pagesNeeded = Math.min(4, Math.max(1, Math.ceil(limit / 20)));

  if (kind === 'now-playing') {
    const pages = await Promise.all(
      Array.from({ length: pagesNeeded }, (_, i) =>
        fetchTmdb('/movie/now_playing', {
          language: 'fr-FR',
          region: 'FR',
          page: i + 1,
        })
      )
    );
    const raw = pages.flatMap((p) => (Array.isArray(p?.results) ? p.results : []));
    return mapTmdbListResult(
      raw.filter((m) => m.poster_path && m.release_date && m.release_date <= today),
      'movie'
    ).slice(0, limit);
  }

  if (kind === 'upcoming-cinema') {
    const pages = await Promise.all(
      Array.from({ length: pagesNeeded }, (_, i) =>
        fetchTmdb('/movie/upcoming', {
          language: 'fr-FR',
          region: 'FR',
          page: i + 1,
        })
      )
    );
    const raw = pages.flatMap((p) => (Array.isArray(p?.results) ? p.results : []));
    return mapTmdbListResult(
      raw.filter((m) => m.poster_path && m.release_date && m.release_date >= today),
      'movie'
    ).slice(0, limit);
  }

  // recent-streaming : dispo en abonnement (FR) + sortie récente (comme Seerr, filtré récent)
  // without_genres=99 : exclure documentaires (garde animation / fiction)
  const since = daysAgoIso(STREAMING_RECENT_DAYS);
  const pages = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      fetchTmdb('/discover/movie', {
        language: 'fr-FR',
        region: 'FR',
        watch_region: 'FR',
        with_watch_monetization_types: 'flatrate',
        without_genres: '99',
        sort_by: 'primary_release_date.desc',
        include_adult: 'false',
        include_video: 'false',
        'primary_release_date.gte': since,
        'primary_release_date.lte': today,
        page: i + 1,
      })
    )
  );
  const raw = pages.flatMap((p) => (Array.isArray(p?.results) ? p.results : []));
  const seen = new Set();
  const deduped = [];
  for (const m of raw) {
    if (!m?.id || seen.has(m.id)) continue;
    if (!m.poster_path || !m.release_date) continue;
    if (m.release_date < since || m.release_date > today) continue;
    seen.add(m.id);
    deduped.push(m);
  }
  return mapTmdbListResult(deduped, 'movie').slice(0, limit);
}

/**
 * Listes films TMDB pour l’accueil / Voir plus.
 * kind: upcoming-cinema | recent-streaming | now-playing
 */
export async function getMovieBrowseHandler(req, res) {
  try {
    const kind = String(req.query.kind || '');
    if (!MOVIE_BROWSE_KINDS.has(kind)) {
      return res.status(400).json({
        error: 'kind invalide (upcoming-cinema | recent-streaming | now-playing)',
      });
    }

    const parsedLimit = req.query.limit ? Number(req.query.limit) : 40;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(80, Math.max(1, parsedLimit))
      : 40;

    const cacheKey = `tmdb-movie-browse:v3:${kind}:${limit}`;
    const cached = await getAppCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const results = await fetchMovieBrowseList(kind, limit);
    await setAppCache(cacheKey, results, BROWSE_CACHE_TTL_MINUTES);
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}

const TV_BROWSE_KINDS = new Set(['recent-streaming', 'trending']);
/** Reality / Talk / News — bruit plateformes (garde animation / fiction). */
const TV_STREAMING_EXCLUDE_GENRES = '10764,10767,10763';

async function fetchTvBrowseList(kind, limit) {
  const today = todayIso();
  const pagesNeeded = Math.min(4, Math.max(1, Math.ceil(limit / 20)));

  if (kind === 'trending') {
    const pages = await Promise.all(
      Array.from({ length: pagesNeeded }, (_, i) =>
        fetchTmdb('/trending/tv/week', {
          language: 'fr-FR',
          page: i + 1,
        })
      )
    );
    const raw = pages.flatMap((p) => (Array.isArray(p?.results) ? p.results : []));
    return mapTmdbListResult(
      raw.filter((s) => s.poster_path && s.first_air_date && s.first_air_date <= today),
      'tv'
    ).slice(0, limit);
  }

  // recent-streaming : abonnement FR + 1ʳᵉ diffusion récente
  const since = daysAgoIso(STREAMING_RECENT_DAYS);
  const pages = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      fetchTmdb('/discover/tv', {
        language: 'fr-FR',
        watch_region: 'FR',
        with_watch_monetization_types: 'flatrate',
        without_genres: TV_STREAMING_EXCLUDE_GENRES,
        sort_by: 'first_air_date.desc',
        include_adult: 'false',
        include_null_first_air_dates: 'false',
        'first_air_date.gte': since,
        'first_air_date.lte': today,
        page: i + 1,
      })
    )
  );
  const raw = pages.flatMap((p) => (Array.isArray(p?.results) ? p.results : []));
  const seen = new Set();
  const deduped = [];
  for (const s of raw) {
    if (!s?.id || seen.has(s.id)) continue;
    if (!s.poster_path || !s.first_air_date) continue;
    if (s.first_air_date < since || s.first_air_date > today) continue;
    seen.add(s.id);
    deduped.push(s);
  }
  return mapTmdbListResult(deduped, 'tv').slice(0, limit);
}

/**
 * Listes séries TMDB pour l’accueil / Voir plus.
 * kind: recent-streaming | trending
 */
export async function getTvBrowseHandler(req, res) {
  try {
    const kind = String(req.query.kind || '');
    if (!TV_BROWSE_KINDS.has(kind)) {
      return res.status(400).json({
        error: 'kind invalide (recent-streaming | trending)',
      });
    }

    const parsedLimit = req.query.limit ? Number(req.query.limit) : 40;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(80, Math.max(1, parsedLimit))
      : 40;

    const cacheKey = `tmdb-tv-browse:v1:${kind}:${limit}`;
    const cached = await getAppCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const results = await fetchTvBrowseList(kind, limit);
    await setAppCache(cacheKey, results, BROWSE_CACHE_TTL_MINUTES);
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    const status = message.includes('token manquant') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
