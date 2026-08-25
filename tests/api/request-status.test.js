import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';
import { run } from '../../server/services/core/db.js';
import { ensureInventorySchema } from '../helpers/db-schema.js';

test('GET /api/library/request-status — structure et exclusion completed', async () => {
  const app = await getTestApp();
  const { authHeader, user } = await loginAsAdmin(app);

  await ensureInventorySchema();

  const activeId = randomUUID();
  const completedId = randomUUID();

  await run(
    `INSERT INTO media_requests (
      id, user_id, tmdb_id, media_type, title, poster_url, release_date, status, monitored, created_at
    ) VALUES (?, ?, ?, 'movie', 'Film Actif Test', NULL, '2024-01-01', 'monitoring', 1, datetime('now'))`,
    [activeId, user.id, 55001]
  );

  await run(
    `INSERT INTO media_requests (
      id, user_id, tmdb_id, media_type, title, poster_url, release_date, status, monitored, created_at, completed_at
    ) VALUES (?, ?, ?, 'movie', 'Film Terminé Test', NULL, '2024-01-01', 'completed', 1, datetime('now'), datetime('now'))`,
    [completedId, user.id, 55002]
  );

  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, tmdb_id, path, last_seen_at
    ) VALUES (?, 'movie', 'Inception', 'inception', 55003, '/media/movies/inception.mkv', datetime('now'))`,
    [randomUUID()]
  );

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

  await run(
    `INSERT INTO emby_media_inventory (
      id, emby_item_id, library_id, media_kind, title, title_normalized, tmdb_id, updated_at
    ) VALUES (?, ?, 'lib1', 'movie', 'Emby Only Film', 'emby only film', 55004, datetime('now'))`,
    [randomUUID(), `emby-${randomUUID()}`]
  );

  const res = await request(app)
    .get('/api/library/request-status')
    .set(authHeader);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.movies));
  assert.ok(Array.isArray(res.body.seasons));
  assert.ok(Array.isArray(res.body.inventory));
  assert.ok(Array.isArray(res.body.tv_presence));

  const active = res.body.movies.find((m) => m.tmdb_id === 55001);
  const completed = res.body.movies.find((m) => m.tmdb_id === 55002);
  const inventoryDisk = res.body.inventory.find((i) => i.tmdb_id === 55003);
  const inventoryEmby = res.body.inventory.find((i) => i.tmdb_id === 55004);

  assert.ok(active);
  assert.equal(active.requested_by, 'admin');
  assert.equal(completed, undefined);
  assert.ok(inventoryDisk);
  assert.equal(inventoryDisk.media_kind, 'movie');
  assert.ok(inventoryEmby);
  assert.equal(inventoryEmby.media_kind, 'movie');
  assert.ok(inventoryEmby.title_normalized);
});

test('GET /api/library/request-status — requiert authentification', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/library/request-status');

  assert.equal(res.status, 401);
});
