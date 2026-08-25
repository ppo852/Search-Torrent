import fetch from 'node-fetch';
import { getSetting } from '../../services/settings/index.js';
import { getAppCache, setAppCache } from '../../services/core/app-cache.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const NEWEST_CACHE_TTL_MINUTES = 60;

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

export async function getNowPlayingMoviesHandler(req, res) {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const data = await fetchTmdb('/movie/now_playing', {
      language: 'fr-FR',
      region: 'FR',
      page: Number.isFinite(page) && page > 0 ? page : 1
    });

    const results = mapTmdbListResult(data?.results, 'movie');
    res.json({ results, page: data?.page || 1, totalPages: data?.total_pages || 1 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

export async function getOnTheAirTvHandler(req, res) {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const data = await fetchTmdb('/tv/on_the_air', {
      language: 'fr-FR',
      page: Number.isFinite(page) && page > 0 ? page : 1
    });

    const results = mapTmdbListResult(data?.results, 'tv');
    res.json({ results, page: data?.page || 1, totalPages: data?.total_pages || 1 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

export async function getUpcomingTvHandler(req, res) {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;

    // Best-effort "à venir": use popular list and keep items with a future first_air_date when available.
    // We fetch a bit more and then cut to 20 client-side.
    const data = await fetchTmdb('/tv/popular', {
      language: 'fr-FR',
      page: Number.isFinite(page) && page > 0 ? page : 1
    });

    const today = todayIso();
    const raw = Array.isArray(data?.results) ? data.results : [];
    const filtered = raw.filter((it) => {
      const d = typeof it?.first_air_date === 'string' ? it.first_air_date : '';
      if (!d) return false;
      return d >= today;
    });

    const results = mapTmdbListResult(filtered, 'tv').slice(0, 20);
    res.json({ results, page: data?.page || 1, totalPages: data?.total_pages || 1 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
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
    (v) => v?.key && (v.site === 'YouTube' || v.site === 'Vimeo')
  );
}

async function fetchVideosForMedia(mediaType, id) {
  const fr = await fetchTmdb(`/${mediaType}/${id}/videos`, { language: 'fr-FR' });
  const frResults = Array.isArray(fr?.results) ? fr.results : [];
  if (hasPlayableTrailer(frResults)) {
    return fr;
  }
  return fetchTmdb(`/${mediaType}/${id}/videos`, {});
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

export async function getNewestMediaHandler(req, res) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 40;
    const cacheKey = `tmdb-newest:${limit}`;
    const cached = await getAppCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch movies and TV shows in parallel
    const [moviesData, tvData] = await Promise.all([
      fetchTmdb('/movie/now_playing', {
        language: 'fr-FR',
        region: 'FR',
        page: 1
      }),
      fetchTmdb('/trending/tv/week', {
        language: 'fr-FR',
        page: 1
      })
    ]);

    const today = todayIso();

    // Filter and map movies (must have poster and be released)
    const movies = mapTmdbListResult(
      (moviesData?.results || []).filter(m => 
        m.poster_path && m.release_date && m.release_date <= today
      ),
      'movie'
    ).slice(0, limit);

    // Filter and map TV shows (must have poster and be released)
    const shows = mapTmdbListResult(
      (tvData?.results || []).filter(s => 
        s.poster_path && s.first_air_date && s.first_air_date <= today
      ),
      'tv'
    ).slice(0, limit);

    // Interleave movies and shows for variety
    const combined = [];
    const maxLength = Math.max(movies.length, shows.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < movies.length) combined.push(movies[i]);
      if (i < shows.length) combined.push(shows[i]);
    }

    const result = combined.slice(0, limit);
    await setAppCache(cacheKey, result, NEWEST_CACHE_TTL_MINUTES);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}
