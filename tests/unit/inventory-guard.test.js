import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';
import { run } from '../../server/services/core/db.js';
import { checkInteractiveInventoryDuplicate } from '../../server/services/qbittorrent/inventory-guard.js';
import { ensureInventorySchema } from '../helpers/db-schema.js';

test('checkInteractiveInventoryDuplicate — sans nom de torrent', async () => {
  const result = await checkInteractiveInventoryDuplicate({
    torrentName: '',
    force: false,
    userId: 'any',
  });

  assert.equal(result.blocked, false);
});

test('checkInteractiveInventoryDuplicate — doublon détecté (409)', async () => {
  const app = await getTestApp();
  const { user } = await loginAsAdmin(app);

  await ensureInventorySchema();

  const pathSuffix = randomUUID();
  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, year, path, last_seen_at
    ) VALUES (?, 'movie', 'Matrix 1999', 'matrix', 1999, ?, datetime('now'))`,
    [randomUUID(), `/media/movies/matrix-${pathSuffix}.mkv`]
  );

  const result = await checkInteractiveInventoryDuplicate({
    torrentName: 'Matrix 1999 1080p BluRay x264',
    force: false,
    userId: user.id,
  });

  assert.equal(result.blocked, true);
  assert.equal(result.status, 409);
  assert.equal(result.present, true);
  assert.match(result.error, /Déjà présent/);
});

test('checkInteractiveInventoryDuplicate — title/year demande (sans nom torrent)', async () => {
  const app = await getTestApp();
  const { user } = await loginAsAdmin(app);

  await ensureInventorySchema();

  const tmdbId = 603;
  const pathSuffix = randomUUID();
  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, year, path, tmdb_id, last_seen_at
    ) VALUES (?, 'movie', 'The Matrix', 'the matrix', 1999, ?, ?, datetime('now'))`,
    [randomUUID(), `/media/movies/matrix-tmdb-${pathSuffix}.mkv`, tmdbId]
  );

  const result = await checkInteractiveInventoryDuplicate({
    torrentName: '',
    title: 'The Matrix',
    year: 1999,
    force: false,
    userId: user.id,
    mediaType: 'movie',
    tmdbId,
  });

  assert.equal(result.blocked, true);
  assert.equal(result.status, 409);
  assert.equal(result.present, true);
});

test('checkInteractiveInventoryDuplicate — mediaType animation = kind movie', async () => {
  const app = await getTestApp();
  const { user } = await loginAsAdmin(app);

  await ensureInventorySchema();

  const tmdbId = 987654;
  const pathSuffix = randomUUID();
  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, year, path, tmdb_id, last_seen_at
    ) VALUES (?, 'movie', 'Bad Guys 2', 'bad guys 2', 2025, ?, ?, datetime('now'))`,
    [randomUUID(), `/media/animation/bad-guys-2-${pathSuffix}.mkv`, tmdbId]
  );

  const result = await checkInteractiveInventoryDuplicate({
    torrentName: 'The Bad Guys 2 2025 1080p WEBRip',
    force: false,
    userId: user.id,
    mediaType: 'animation',
    tmdbId,
  });

  assert.equal(result.blocked, true);
  assert.equal(result.status, 409);
});

test('GET /api/admin/activity — admin OK, sans token interdit', async () => {
  const app = await getTestApp();
  const { authHeader } = await loginAsAdmin(app);

  const adminRes = await request(app)
    .get('/api/admin/activity')
    .set(authHeader);

  assert.equal(adminRes.status, 200);
  assert.ok(Array.isArray(adminRes.body.items));

  const res = await request(app).get('/api/admin/activity');
  assert.equal(res.status, 401);
});
