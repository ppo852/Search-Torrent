import { query, run } from '../core/db.js';
import logger from '../core/logger.js';
import scanner from './scanner.js';
import fetch from 'node-fetch';
import { getSetting } from '../settings/index.js';
import { cleanMediaTitle, normalizeTitleForDb, coerceYear } from './utils.js';
import userService from '../users/index.js';
import { deleteByPath } from './store.js';
import { findEmbyMatches, findEmbySeasonEpisodes } from '../emby/store.js';


// normalizeTitle is now provided by utils.normalizeTitleForDb

/** Migration douce colonnes inventaire local (tmdb_id, etc.) — appelée avant scan et APIs qui lisent ces colonnes. */
export async function ensureSchema() {
  try {
    const cols = await query(`PRAGMA table_info(local_media_inventory)`);
    const names = new Set((cols || []).map((c) => c.name));
    if (!names.has('tmdb_id')) {
      await run(`ALTER TABLE local_media_inventory ADD COLUMN tmdb_id INTEGER NULL`);
    }
    if (!names.has('original_title')) {
      await run(`ALTER TABLE local_media_inventory ADD COLUMN original_title TEXT NULL`);
    }
    if (!names.has('tmdb_resolve_attempts')) {
      await run(`ALTER TABLE local_media_inventory ADD COLUMN tmdb_resolve_attempts INTEGER NOT NULL DEFAULT 0`);
    }
    // Indexes for performance and upsert reliability
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_path ON local_media_inventory(path)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_kind_title ON local_media_inventory(media_kind, title_normalized, year)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_tmdb ON local_media_inventory(media_kind, tmdb_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_inventory_tv_season_ep ON local_media_inventory(media_kind, title_normalized, season, episode)`);
  } catch (err) {
    logger.warn('ensureSchema local_media_inventory:', err?.message || err);
  }
}

export async function isPresent({ kind, title, year, season, episode, tmdb_id }) {
  const mediaKind = String(kind || '').toLowerCase() === 'movie' ? 'movie' : 'tv';

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

    logger.debug('inventory', '[isPresent][by_tmdb_id] input', {
      mediaKind,
      tmdb_id: id,
      title,
      season,
      episode,
      where: whereById.join(' AND '),
      params: paramsById
    });

    const rowsById = await query(
      `SELECT id, media_kind, title, year, season, episode, path, size, mtime_ms, tmdb_id
       FROM local_media_inventory
       WHERE ${whereById.join(' AND ')}
       ORDER BY mtime_ms DESC
       LIMIT 25`,
      paramsById
    );
    logger.debug('inventory', '[isPresent][by_tmdb_id] result', {
      count: (rowsById || []).length,
      matches: (rowsById || []).slice(0, 3).map((r) => ({
        title: r.title,
        season: r.season,
        episode: r.episode,
        path: r.path,
        tmdb_id: r.tmdb_id
      }))
    });
    if ((rowsById || []).length > 0) {
      return {
        present: true,
        matches: rowsById.map((r) => ({ ...r, source: 'disk' })),
      };
    }
  }

  const titleNorm = normalizeTitleForDb(title);
  if (titleNorm) {
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

    logger.debug('inventory', '[isPresent][by_title] input', {
      mediaKind,
      title,
      title_normalized: titleNorm,
      year,
      season,
      episode,
      where: where.join(' AND '),
      params
    });
    logger.debug('inventory', '[isPresent][by_title] result', {
      count: (rows || []).length,
      matches: (rows || []).slice(0, 3).map((r) => ({
        title: r.title,
        season: r.season,
        episode: r.episode,
        path: r.path,
        tmdb_id: r.tmdb_id
      }))
    });

    if ((rows || []).length > 0) {
      return {
        present: true,
        matches: rows.map((r) => ({ ...r, source: 'disk' })),
      };
    }
  }

  // Fallback Emby (disque OU Emby)
  try {
    const embyMatches = await findEmbyMatches({
      kind: mediaKind,
      title,
      year,
      season,
      episode,
      tmdb_id,
    });
    if (embyMatches.length > 0) {
      logger.debug('inventory', '[isPresent][emby] hit', {
        count: embyMatches.length,
        title,
        tmdb_id,
      });
      return { present: true, matches: embyMatches };
    }
  } catch (err) {
    logger.debug('inventory', '[isPresent][emby] skip', err?.message || err);
  }

  return { present: false, matches: [] };
}

/**
 * Disque OU Emby : par TMDB ID si fourni, sinon fallback titre.
 * Si tmdb_id > 0 : ID + fallback disque (même titre, tmdb_id vide).
 */
export async function getSeasonPresence({ tmdb_id, title, season }) {
  const s = Number(season);
  if (!Number.isInteger(s)) return [];

  const dbg = String(process.env.DEBUG_MEDIA_INVENTORY || '').toLowerCase() === '1';
  const id = Number(tmdb_id);
  const episodeSet = new Set();
  const hasTmdbId = Number.isInteger(id) && id > 0;
  const titleNorm = title ? normalizeTitleForDb(title) : '';

  if (hasTmdbId) {
    const rowsById = await query(
      `SELECT episode FROM local_media_inventory
       WHERE media_kind = 'tv' AND tmdb_id = ? AND season = ?`,
      [id, s]
    );
    for (const r of rowsById || []) {
      if (r.episode != null) episodeSet.add(r.episode);
    }

    // Fallback disque : fichiers non tagués TMDB, même titre
    if (titleNorm) {
      const rowsUntagged = await query(
        `SELECT episode FROM local_media_inventory
         WHERE media_kind = 'tv' AND title_normalized = ? AND season = ?
           AND (tmdb_id IS NULL OR tmdb_id = 0)`,
        [titleNorm, s]
      );
      for (const r of rowsUntagged || []) {
        if (r.episode != null) episodeSet.add(r.episode);
      }
    }
  } else if (titleNorm) {
    const rowsByTitle = await query(
      `SELECT episode FROM local_media_inventory
       WHERE media_kind = 'tv' AND title_normalized = ? AND season = ?`,
      [titleNorm, s]
    );
    for (const r of rowsByTitle || []) {
      if (r.episode != null) episodeSet.add(r.episode);
    }
  }

  try {
    const embyEps = await findEmbySeasonEpisodes({
      tmdb_id: hasTmdbId ? id : null,
      title: hasTmdbId ? null : title,
      season: s,
    });
    for (const ep of embyEps || []) {
      if (ep != null) episodeSet.add(ep);
    }
  } catch (err) {
    logger.debug('inventory', '[getSeasonPresence][emby] skip', err?.message || err);
  }

  const episodes = Array.from(episodeSet);

  if (dbg) {
    logger.debug('inventory', `Found ${episodes.length} episodes for ${title || id} S${s}`);
  }

  return episodes;
}

async function collectMergedPaths() {
  const moviesPathsSet = new Set();
  const seriesPathsSet = new Set();
  const animePathsSet = new Set();
  const animationPathsSet = new Set();

  const addPaths = (val, set) => {
    if (typeof val === 'string' && val.trim()) {
      val.split(':').map((p) => p.trim()).filter(Boolean).forEach((p) => set.add(p));
    }
  };

  try {
    const users = await userService.getAllUsers();
    for (const u of users) {
      addPaths(u.download_path_movies, moviesPathsSet);
      addPaths(u.download_path_series, seriesPathsSet);
      addPaths(u.download_path_anime, animePathsSet);
      addPaths(u.download_path_animation, animationPathsSet);
    }
  } catch (err) {
    logger.error('inventory', 'Error fetching user paths for scan:', err);
  }

  return {
    mergedMoviesPath: Array.from(moviesPathsSet).join(':'),
    mergedSeriesPath: Array.from(seriesPathsSet).join(':'),
    mergedAnimePath: Array.from(animePathsSet).join(':'),
    mergedAnimationPath: Array.from(animationPathsSet).join(':'),
  };
}

export async function scanNow() {
  await ensureSchema();

  const {
    mergedMoviesPath,
    mergedSeriesPath,
    mergedAnimePath,
    mergedAnimationPath,
  } = await collectMergedPaths();

  if (mergedMoviesPath || mergedSeriesPath || mergedAnimePath || mergedAnimationPath) {
    logger.info(
      'inventory',
      `Starting scan on merged paths: Movies[${mergedMoviesPath}] Series[${mergedSeriesPath}] Anime[${mergedAnimePath}] Animation[${mergedAnimationPath}]`
    );
  } else {
    logger.warn('inventory', 'No scan paths found (global or user-specific)');
  }

  const summary = await scanner.scanAndSync({
    moviesPath: mergedMoviesPath,
    seriesPath: mergedSeriesPath,
    animePath: mergedAnimePath,
    animationPath: mergedAnimationPath,
  });

  try {
    const res = await resolveMissingTmdbIds({ limit: 100 });
    if (res) {
      logger.debug('inventory', 'TMDB resolver done', res);
    }
  } catch {
    // ignore resolver errors
  }
  return summary;
}

// Note: upsertMany/deleteMissingPaths are implemented in server/services/media-inventory/store.js

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

// Max TMDB API resolution tries per inventory row (then abandoned, anti-doublon still uses title/year/S/E)
const MAX_TMDB_RESOLVE_ATTEMPTS = 2;

async function incrementTmdbResolveAttempts(rowId) {
  await run(
    `UPDATE local_media_inventory
     SET tmdb_resolve_attempts = COALESCE(tmdb_resolve_attempts, 0) + 1
     WHERE id = ?`,
    [rowId]
  );
}

async function resolveTmdbForRow(row, token) {
  const title = cleanMediaTitle(row.title || '');
  if (!title) {
    await incrementTmdbResolveAttempts(row.id);
    const nextAttempts = (row.tmdb_resolve_attempts ?? 0) + 1;
    return { resolved: false, abandoned: nextAttempts >= MAX_TMDB_RESOLVE_ATTEMPTS };
  }

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
    logger.debug('inventory', 'TMDB search', { kind: isTv ? 'tv' : 'movie', q, year: opts.year || null, language: opts.language || 'en-US', count: arr.length });
    return arr;
  };

  const tryScoredBest = (results) => {
    let best = null;
    let bestScore = 0;
    let bestTitleScore = 0;
    let bestRelYear = null;
    for (const r of results) {
      const isTv = row.media_kind === 'tv';
      const rTitle = cleanMediaTitle(
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

  let results = [];
  try { results = await runSearch(title, { year: row.year, language: 'en-US' }); } catch {}
  let { best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results);

  if (!(best && (bestScore >= 0.85 || (bestTitleScore >= 0.8 && row.year && bestRelYear === row.year)))) {
    try { results = await runSearch(title, { language: 'en-US' }); } catch {}
    ({ best, bestScore, bestTitleScore, bestRelYear } = tryScoredBest(results));
  }

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
       SET tmdb_id = ?, original_title = ?, tmdb_resolve_attempts = 0
       WHERE id = ?`,
      [best.id,
        (isTv ? (best.original_name || best.name) : (best.original_title || best.title)) || null,
        row.id]
    );
    logger.info('TMDB resolved', {
      local: { title: row.title, year: row.year, kind: row.media_kind },
      match: {
        id: best.id,
        title: isTv ? (best.name || best.original_name) : best.title,
        release_date: isTv ? best.first_air_date : best.release_date
      },
      score: Number(bestScore.toFixed(3))
    });
    return { resolved: true, abandoned: false };
  }

  await incrementTmdbResolveAttempts(row.id);
  const nextAttempts = (row.tmdb_resolve_attempts ?? 0) + 1;
  if (nextAttempts >= MAX_TMDB_RESOLVE_ATTEMPTS) {
    logger.debug('inventory', 'TMDB resolve abandoned', {
      local: { title: row.title, year: row.year, kind: row.media_kind },
      bestScore: Number((bestScore || 0).toFixed(3))
    });
    return { resolved: false, abandoned: true };
  }

  logger.debug('inventory', 'TMDB unresolved', {
    local: { title: row.title, year: row.year, kind: row.media_kind },
    bestScore: Number((bestScore || 0).toFixed(3)),
    attempts: nextAttempts
  });
  return { resolved: false, abandoned: false };
}

async function resolveMissingTmdbIds({ limit = 100 } = {}) {
  const token = await getSetting('tmdb_access_token');
  if (!token) {
    console.warn('[media-inventory] TMDB resolver skipped: tmdb_access_token not set');
    return { candidates: 0, resolved: 0, abandoned: 0 };
  }

  const candidates = await query(
    `SELECT id, media_kind, title, title_normalized, year, tmdb_resolve_attempts
     FROM local_media_inventory
     WHERE tmdb_id IS NULL
       AND media_kind IN ('movie', 'tv')
       AND COALESCE(tmdb_resolve_attempts, 0) < ?
     ORDER BY mtime_ms DESC
     LIMIT ?`,
    [MAX_TMDB_RESOLVE_ATTEMPTS, limit]
  );

  let resolved = 0;
  let abandoned = 0;
  for (const row of candidates || []) {
    const result = await resolveTmdbForRow(row, token);
    if (result.resolved) resolved++;
    if (result.abandoned) abandoned++;
  }
  return { candidates: (candidates || []).length, resolved, abandoned };
}

export async function ingestFile(filePath) {
  await ensureSchema();
  const paths = await collectMergedPaths();
  const record = await scanner.ingestSingleFile(filePath, {
    moviesPath: paths.mergedMoviesPath,
    seriesPath: paths.mergedSeriesPath,
    animePath: paths.mergedAnimePath,
    animationPath: paths.mergedAnimationPath,
  });

  if (!record) return null;

  if (!record.tmdb_id) {
    const rows = await query(
      `SELECT id, media_kind, title, title_normalized, year, tmdb_id, tmdb_resolve_attempts
       FROM local_media_inventory
       WHERE path = ?`,
      [record.path]
    );
    const token = await getSetting('tmdb_access_token');
    if (token && rows?.[0] && !rows[0].tmdb_id) {
      await resolveTmdbForRow(rows[0], token);
    }
  }

  return record;
}

export async function removeFile(filePath) {
  await ensureSchema();
  await deleteByPath(filePath);
}

export default {
  ensureSchema,
  isPresent,
  getSeasonPresence,
  scanNow,
  ingestFile,
  removeFile,
};
