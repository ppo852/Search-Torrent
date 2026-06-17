import { run } from '../core/db.js';

export async function upsertMany(items) {
  const now = new Date().toISOString();
  if (!items || items.length === 0) return;

  try {
    await run('BEGIN TRANSACTION');
    for (const item of items) {
      await run(
        `INSERT INTO local_media_inventory (
          id, media_kind, title, title_normalized, tmdb_id, year, season, episode,
          path, size, mtime_ms, last_seen_at, tmdb_resolve_attempts
        ) VALUES (
          COALESCE(?, lower(hex(randomblob(16)))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0)
        )
        ON CONFLICT(path) DO UPDATE SET
          media_kind=excluded.media_kind,
          title=excluded.title,
          title_normalized=excluded.title_normalized,
          tmdb_id=excluded.tmdb_id,
          year=excluded.year,
          season=excluded.season,
          episode=excluded.episode,
          size=excluded.size,
          mtime_ms=excluded.mtime_ms,
          last_seen_at=excluded.last_seen_at,
          tmdb_resolve_attempts=CASE
            WHEN excluded.mtime_ms IS NOT local_media_inventory.mtime_ms
              OR excluded.size IS NOT local_media_inventory.size
            THEN 0
            ELSE COALESCE(local_media_inventory.tmdb_resolve_attempts, 0)
          END`,
        [
          item.id || null,
          item.media_kind,
          item.title || null,
          item.title_normalized || null,
          item.tmdb_id || null,
          item.year ?? null,
          item.season ?? null,
          item.episode ?? null,
          item.path,
          item.size ?? null,
          item.mtime_ms ?? null,
          now,
          item.tmdb_resolve_attempts ?? null
        ]
      );
    }
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

/**
 * Delete inventory rows whose path was not seen in the current scan.
 * Safety: Only deletes rows under /media/* to avoid wiping unrelated records.
 */
export async function deleteMissingPaths(pathsToKeep) {
  const keep = Array.isArray(pathsToKeep) ? pathsToKeep : [];
  if (keep.length === 0) {
    // Safety: do not purge if scan produced no keep paths
    return;
  }

  // Build a Set for fast lookup
  const keepSet = new Set(keep);

  // Get all paths currently in DB under /media/*
  const { query } = await import('../core/db.js');
  const rows = await query(`SELECT path FROM local_media_inventory WHERE path LIKE '/media/%'`);
  
  // Find paths to delete (in DB but not in keepSet)
  const toDelete = rows.filter(row => !keepSet.has(row.path)).map(row => row.path);
  
  if (toDelete.length === 0) {
    return;
  }

  // Delete in chunks to avoid SQLite parameter limits
  const chunkSize = 400;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    await run(
      `DELETE FROM local_media_inventory WHERE path IN (${placeholders})`,
      chunk
    );
  }
}

export async function getAllRecordsByPath() {
  const { query } = await import('../core/db.js');
  const rows = await query(`SELECT * FROM local_media_inventory`);
  const map = new Map();
  for (const r of rows || []) {
    map.set(r.path, r);
  }
  return map;
}

export async function deleteByPath(filePath) {
  const norm = String(filePath || '').replace(/\\/g, '/');
  await run(`DELETE FROM local_media_inventory WHERE path = ?`, [norm]);
}

export default {
  upsertMany,
  deleteMissingPaths,
  getAllRecordsByPath,
  deleteByPath
};
