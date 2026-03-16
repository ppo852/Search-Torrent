import { query, run } from '../core/db.js';
import scanner from './scanner.js';
import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';
import { normalizeTitleForSearch, normalizeTitleForDb } from './utils.js';

// normalizeTitle is now provided by utils.normalizeTitleForDb

async function ensureSchema() {
  try {
    const cols = await query(`PRAGMA table_info(local_media_inventory)`);
    const names = new Set((cols || []).map((c) => c.name));
    if (!names.has('tmdb_id')) {
      await run(`ALTER TABLE local_media_inventory ADD COLUMN tmdb_id INTEGER NULL`);
    }
    if (!names.has('original_title')) {
      await run(`ALTER TABLE local_media_inventory ADD COLUMN original_title TEXT NULL`);
    }
    // Indexes for performance and upsert reliability
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_path ON local_media_inventory(path)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_kind_title ON local_media_inventory(media_kind, title_normalized, year)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_tmdb ON local_media_inventory(media_kind, tmdb_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_tv_season_ep ON local_media_inventory(media_kind, title_normalized, season, episode)`);
  } catch (err) {
    // ignore
  }
}

function coerceYear(value) {
  const y = Number(value);
  if (!Number.isInteger(y)) return null;
  if (y < 1900 || y > 2100) return null;
  return y;
}

export async function isPresent({ kind, title, year, season, episode, tmdb_id }) {
  const mediaKind = String(kind || '').toLowerCase() === 'movie' ? 'movie' : 'tv';

  const dbg = String(process.env.DEBUG_MEDIA_INVENTORY || '').toLowerCase() === '1';

  // If tmdb_id provided, prioritize ID matching (do this before any title checks)
  const id = Number(tmdb_id);
  if (Number.isInteger(id) && id > 0) {
    const paramsById = [mediaKind, id];
    const whereById = ['media_kind = ?', 'tmdb_id = ?'];

    if (mediaKind === 'tv') {
      const s = Number(season);
      const e = Number(episode);
      if (Number.isInteger(s) && s > 0) {
        whereById.push('season = ?');
        paramsById.push(s);
      }
      if (Number.isInteger(e) && e > 0) {
        whereById.push('episode = ?');
        paramsById.push(e);
      }
    }

    if (dbg) {
      console.log('[isPresent][by_tmdb_id] input', {
        mediaKind,
        tmdb_id: id,
        title,
        season,
        episode,
        where: whereById.join(' AND '),
        params: paramsById
      });
    }

    const rowsById = await query(
      `SELECT id, media_kind, title, year, season, episode, path, size, mtime_ms, tmdb_id
       FROM local_media_inventory
       WHERE ${whereById.join(' AND ')}
       ORDER BY mtime_ms DESC
       LIMIT 25`,
      paramsById
    );
    if (dbg) {
      console.log('[isPresent][by_tmdb_id] result', {
        count: (rowsById || []).length,
        matches: (rowsById || []).slice(0, 3).map((r) => ({
          title: r.title,
          season: r.season,
          episode: r.episode,
          path: r.path,
          tmdb_id: r.tmdb_id
        }))
      });
    }
    if ((rowsById || []).length > 0) return { present: true, matches: rowsById };
  }

  const titleNorm = normalizeTitleForDb(title);
  if (!titleNorm) return { present: false, matches: [] };

  const params = [mediaKind, titleNorm];
  const where = ['media_kind = ?', 'title_normalized = ?'];

  const y = coerceYear(year);
  if (y != null) {
    where.push('year = ?');
    params.push(y);
  }

  if (mediaKind === 'tv') {
    const s = Number(season);
    const e = Number(episode);
    if (Number.isInteger(s) && s > 0) {
      where.push('season = ?');
      params.push(s);
    }
    if (Number.isInteger(e) && e > 0) {
      where.push('episode = ?');
      params.push(e);
    }
  }

  const rows = await query(
    `SELECT id, media_kind, title, year, season, episode, path, size, mtime_ms, tmdb_id
     FROM local_media_inventory
     WHERE ${where.join(' AND ')}
     ORDER BY mtime_ms DESC
     LIMIT 25`,
    params
  );

  if (dbg) {
    console.log('[isPresent][by_title] input', {
      mediaKind,
      title,
      title_normalized: titleNorm,
      year,
      season,
      episode,
      where: where.join(' AND '),
      params
    });
    console.log('[isPresent][by_title] result', {
      count: (rows || []).length,
      matches: (rows || []).slice(0, 3).map((r) => ({
        title: r.title,
        season: r.season,
        episode: r.episode,
        path: r.path,
        tmdb_id: r.tmdb_id
      }))
    });
  }

  if ((rows || []).length > 0) {
    return { present: true, matches: rows };
  }

  return { present: false, matches: [] };
}

export async function scanNow({ moviesPath, seriesPath }) {
  await ensureSchema();
  const summary = await scanner.scanAndSync({ moviesPath, seriesPath });
  try {
    const res = await resolveMissingTmdbIds({ limit: 100 });
    if (res) {
      console.log('[media-inventory] TMDB resolver done', res);
    }
  } catch {
    // ignore resolver errors
  }
  return summary;
}

// Note: upsertMany/deleteMissingPaths are implemented in server/services/media-inventory/store.js

export default {
  isPresent,
  scanNow
};

// similarity helper kept minimal within resolver scope
function similarity(a, b) {
  const ta = new Set(String(a || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(String(b || '').toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const denom = Math.max(ta.size, tb.size);
  return inter / denom;
}

async function resolveMissingTmdbIds({ limit = 100 } = {}) {
  const token = await getSetting('tmdb_access_token');
  if (!token) {
    console.warn('[media-inventory] TMDB resolver skipped: tmdb_access_token not set');
    return { candidates: 0, resolved: 0 };
  }

  const candidates = await query(
    `SELECT id, media_kind, title, title_normalized, year
     FROM local_media_inventory
     WHERE tmdb_id IS NULL AND media_kind IN ('movie', 'tv')
     ORDER BY mtime_ms DESC
     LIMIT ?`,
    [limit]
  );

  let resolved = 0;
  for (const row of candidates || []) {
    const title = normalizeTitleForSearch(row.title || '');
    if (!title) continue;
    
    const runSearch = async (q, opts = {}) => {
      const isTv = row.media_kind === 'tv';
      const url = new URL(isTv ? 'https://api.themoviedb.org/3/search/tv' : 'https://api.themoviedb.org/3/search/movie');
      url.searchParams.set('query', q);
      if (!isTv && opts.year) url.searchParams.set('year', String(opts.year));
      url.searchParams.set('language', opts.language || 'en-US');
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${String(token)}`, 'Content-Type': 'application/json' }
      });
      if (!resp.ok) return [];
      const data = await resp.json().catch(() => ({}));
      const arr = Array.isArray(data?.results) ? data.results : [];
      console.log('[media-inventory] TMDB search', { kind: isTv ? 'tv' : 'movie', q, year: opts.year || null, language: opts.language || 'en-US', count: arr.length });
      return arr;
    };

    const tryScoredBest = (results) => {
      let best = null;
      let bestScore = 0;
      let bestTitleScore = 0;
      let bestRelYear = null;
      for (const r of results) {
        const isTv = row.media_kind === 'tv';
        const rTitle = normalizeTitleForSearch(
          isTv ? (r?.name || r?.original_name || '') : (r?.title || r?.original_title || '')
        );
        const scoreTitle = similarity(title, rTitle);
        const relYear = isTv
          ? (r?.first_air_date ? Number(String(r.first_air_date).slice(0, 4)) : null)
          : (r?.release_date ? Number(String(r.release_date).slice(0, 4)) : null);

        const scoreYear = (!isTv && row.year)
          ? (relYear != null && Math.abs(relYear - row.year) <= 1 ? 1 : 0)
          : 0.5;

        const score = 0.7 * scoreTitle + 0.3 * scoreYear;
        if (score > bestScore) { bestScore = score; best = r; bestTitleScore = scoreTitle; bestRelYear = relYear; }
      }
      return { best, bestScore, bestTitleScore, bestRelYear };
    };

    // Phase 1: query with year (en-US) for movies; TV ignores year
    let results = [];
    try { results = await runSearch(title, { year: row.year, language: 'en-US' }); } catch {}
    let { best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results);

    // Phase 2: if not confident, try without year (en-US)
    if (!(best && (bestScore >= 0.85 || (bestTitleScore >= 0.8 && row.year && bestRelYear === row.year)))) {
      try { results = await runSearch(title, { language: 'en-US' }); } catch {}
      ({ best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results));
    }

    // Phase 3: if still not confident, try fr-FR
    if (!(best && (bestScore >= 0.85 || (bestTitleScore >= 0.8 && row.year && bestRelYear === row.year)))) {
      try { results = await runSearch(title, { year: row.year, language: 'fr-FR' }); } catch {}
      ({ best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results));
      if (!(best && (bestScore >= 0.85 || (bestTitleScore >= 0.8 && row.year && bestRelYear === row.year)))) {
        try { results = await runSearch(title, { language: 'fr-FR' }); } catch {}
        ({ best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results));
      }
    }

    const isTv = row.media_kind === 'tv';
    const confident = isTv
      ? (bestScore >= 0.85 || bestTitleScore >= 0.85)
      : (bestScore >= 0.85 || (bestTitleScore >= 0.8 && row.year && bestRelYear === row.year));

    if (best && Number.isInteger(best?.id) && confident) {
      await run(
        `UPDATE local_media_inventory
         SET tmdb_id = ?, original_title = ?
         WHERE id = ?`,
        [best.id,
         (isTv ? (best.original_name || best.name) : (best.original_title || best.title)) || null,
         row.id]
      );
      resolved++;
      console.log('[media-inventory] TMDB resolved', {
        local: { title: row.title, year: row.year, kind: row.media_kind },
        match: {
          id: best.id,
          title: isTv ? (best.name || best.original_name) : best.title,
          release_date: isTv ? best.first_air_date : best.release_date
        },
        score: Number(bestScore.toFixed(3))
      });
    } else {
      console.log('[media-inventory] TMDB unresolved', { local: { title: row.title, year: row.year, kind: row.media_kind }, bestScore: Number((bestScore || 0).toFixed(3)) });
    }
  }
  return { candidates: (candidates || []).length, resolved };
}
