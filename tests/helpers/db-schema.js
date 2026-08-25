import { run, query } from '../../server/services/core/db.js';

export async function ensureInventorySchema() {
  const cols = await query('PRAGMA table_info(local_media_inventory)');
  const names = new Set((cols || []).map((c) => c.name));
  if (!names.has('tmdb_id')) {
    await run('ALTER TABLE local_media_inventory ADD COLUMN tmdb_id INTEGER NULL');
  }
  if (!names.has('original_title')) {
    await run('ALTER TABLE local_media_inventory ADD COLUMN original_title TEXT NULL');
  }
  if (!names.has('tmdb_resolve_attempts')) {
    await run('ALTER TABLE local_media_inventory ADD COLUMN tmdb_resolve_attempts INTEGER NOT NULL DEFAULT 0');
  }
}
