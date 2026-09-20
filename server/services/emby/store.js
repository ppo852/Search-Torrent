import { run, query, get, withDbExclusive } from '../core/db.js';
import { normalizeTitleForDb, coerceYear } from '../media-inventory/utils.js';

let schemaReady = false;

export async function ensureEmbySchema() {
  if (schemaReady) return;
  await run(`CREATE TABLE IF NOT EXISTS emby_media_inventory (
    id TEXT PRIMARY KEY,
    emby_item_id TEXT NOT NULL UNIQUE,
    library_id TEXT,
    media_kind TEXT NOT NULL,
    title TEXT,
    title_normalized TEXT,
    year INTEGER,
    season INTEGER,
    episode INTEGER,
    tmdb_id INTEGER,
    updated_at TEXT NOT NULL
  )`);
  await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_tmdb ON emby_media_inventory(media_kind, tmdb_id, season, episode)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_title ON emby_media_inventory(media_kind, title_normalized, year, season, episode)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_library ON emby_media_inventory(library_id)`);
  schemaReady = true;
}

/**
 * Upsert Emby sans BEGIN/COMMIT (évite les conflits avec le scan disque).
 * Sérialisé via withDbExclusive.
 */
export async function upsertEmbyItems(items) {
  if (!items || items.length === 0) return;
  const now = new Date().toISOString();

  return withDbExclusive(async () => {
    for (const item of items) {
      await run(
        `INSERT INTO emby_media_inventory (
          id, emby_item_id, library_id, media_kind, title, title_normalized,
          year, season, episode, tmdb_id, updated_at
        ) VALUES (
          COALESCE(?, lower(hex(randomblob(16)))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(emby_item_id) DO UPDATE SET
          library_id=excluded.library_id,
          media_kind=excluded.media_kind,
          title=excluded.title,
          title_normalized=excluded.title_normalized,
          year=excluded.year,
          season=excluded.season,
          episode=excluded.episode,
          tmdb_id=excluded.tmdb_id,
          updated_at=excluded.updated_at`,
        [
          item.id || null,
          item.emby_item_id,
          item.library_id || null,
          item.media_kind,
          item.title || null,
          item.title_normalized || null,
          item.year ?? null,
          item.season ?? null,
          item.episode ?? null,
          item.tmdb_id ?? null,
          now,
        ]
      );
    }
  });
}

/**
 * Supprime les lignes Emby absentes du dernier sync.
 */
export async function deleteMissingEmbyItems(itemIdsToKeep, options = {}) {
  const keep = Array.isArray(itemIdsToKeep) ? itemIdsToKeep.map(String) : [];
  if (keep.length === 0 && !options.allowEmptyPurge) {
    return 0;
  }

  const keepSet = new Set(keep);

  const rows = await query(`SELECT emby_item_id FROM emby_media_inventory`);
  const toDelete = (rows || [])
    .map((r) => String(r.emby_item_id))
    .filter((id) => !keepSet.has(id));

  if (toDelete.length === 0) return 0;

  const chunkSize = 400;
  let deleted = 0;
  await withDbExclusive(async () => {
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      await run(
        `DELETE FROM emby_media_inventory WHERE emby_item_id IN (${placeholders})`,
        chunk
      );
      deleted += chunk.length;
    }
  });
  return deleted;
}

export async function countEmbyItems() {
  const row = await get(`SELECT COUNT(*) as count FROM emby_media_inventory`);
  return Number(row?.count) || 0;
}

/** ISO timestamp du dernier upsert Emby (fallback si pas de setting). */
export async function getLatestEmbyUpdatedAt() {
  const row = await get(`SELECT MAX(updated_at) as max_at FROM emby_media_inventory`);
  return row?.max_at ? String(row.max_at) : null;
}

function mapEmbyRow(r) {
  return {
    id: r.id,
    emby_item_id: r.emby_item_id,
    library_id: r.library_id,
    media_kind: r.media_kind,
    title: r.title,
    year: r.year,
    season: r.season,
    episode: r.episode,
    tmdb_id: r.tmdb_id,
    path: null,
    source: 'emby',
  };
}

/**
 * Présence dans l'inventaire Emby (même logique que le disque : TMDB puis titre).
 */
export async function findEmbyMatches({ kind, title, year, season, episode, tmdb_id }) {
  await ensureEmbySchema();
  const mediaKind = String(kind || '').toLowerCase() === 'movie' ? 'movie' : 'tv';

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

    const rowsById = await query(
      `SELECT id, emby_item_id, library_id, media_kind, title, year, season, episode, tmdb_id
       FROM emby_media_inventory
       WHERE ${whereById.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT 25`,
      paramsById
    );
    if ((rowsById || []).length > 0) {
      return rowsById.map(mapEmbyRow);
    }
  }

  const titleNorm = normalizeTitleForDb(title);
  if (!titleNorm) return [];

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
    `SELECT id, emby_item_id, library_id, media_kind, title, year, season, episode, tmdb_id
     FROM emby_media_inventory
     WHERE ${where.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT 25`,
    params
  );

  return (rows || []).map(mapEmbyRow);
}

/**
 * Épisodes présents dans Emby pour une saison (TMDB ID, sinon titre).
 */
export async function findEmbySeasonEpisodes({ tmdb_id, title, season }) {
  await ensureEmbySchema();
  const s = Number(season);
  if (!Number.isInteger(s)) return [];

  const episodeSet = new Set();
  const id = Number(tmdb_id);
  const hasTmdbId = Number.isInteger(id) && id > 0;

  if (hasTmdbId) {
    const rowsById = await query(
      `SELECT episode FROM emby_media_inventory
       WHERE media_kind = 'tv' AND tmdb_id = ? AND season = ?`,
      [id, s]
    );
    for (const r of rowsById || []) {
      if (r.episode != null) episodeSet.add(r.episode);
    }
    return Array.from(episodeSet);
  }

  const titleNorm = normalizeTitleForDb(title);
  if (titleNorm) {
    const rowsByTitle = await query(
      `SELECT episode FROM emby_media_inventory
       WHERE media_kind = 'tv' AND title_normalized = ? AND season = ?`,
      [titleNorm, s]
    );
    for (const r of rowsByTitle || []) {
      if (r.episode != null) episodeSet.add(r.episode);
    }
  }

  return Array.from(episodeSet);
}

