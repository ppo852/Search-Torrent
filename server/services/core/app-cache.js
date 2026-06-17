import { randomUUID } from 'crypto';
import { get, run } from './db.js';

/**
 * Lit une entrée du cache applicatif persistant (SQLite).
 */
export async function getAppCache(cacheKey) {
  const now = new Date().toISOString();
  const row = await get(
    'SELECT payload_json FROM app_cache WHERE cache_key = ? AND expires_at > ? LIMIT 1',
    [cacheKey, now]
  );
  if (!row?.payload_json) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

/**
 * Enregistre une entrée (remplace l'existante pour la même clé).
 */
export async function setAppCache(cacheKey, payload, ttlMinutes = 30) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await run('DELETE FROM app_cache WHERE cache_key = ?', [cacheKey]);
  await run(
    `INSERT INTO app_cache (id, cache_key, payload_json, last_updated, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      cacheKey,
      JSON.stringify(payload),
      now.toISOString(),
      expiresAt,
    ]
  );
}

export async function deleteAppCache(cacheKey) {
  await run('DELETE FROM app_cache WHERE cache_key = ?', [cacheKey]);
}

export async function deleteAppCacheByPrefix(prefix) {
  await run('DELETE FROM app_cache WHERE cache_key LIKE ?', [`${prefix}%`]);
}
