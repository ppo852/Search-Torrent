import fetch from 'node-fetch';
import { getSetting } from '../../services/settings/index.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

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

export async function getNewestMediaHandler(req, res) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 40;

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

    res.json(combined.slice(0, limit));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}
