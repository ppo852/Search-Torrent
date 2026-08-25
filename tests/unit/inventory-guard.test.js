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

  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, year, path, last_seen_at
    ) VALUES (?, 'movie', 'Matrix 1999', 'matrix', 1999, '/media/movies/matrix.mkv', datetime('now'))`,
    [randomUUID()]
  );

  const result = await checkInteractiveInventoryDuplicate({
    torrentName: 'Matrix 1999 1080p BluRay x264',
    force: false,
    userId: user.id,
  });

  assert.equal(result.blocked, true);
  assert.equal(result.status, 409);
  assert.match(result.error, /Déjà présent/);
});

test('checkInteractiveInventoryDuplicate — mediaType animation = kind movie', async () => {
  const app = await getTestApp();
  const { user } = await loginAsAdmin(app);

  await ensureInventorySchema();

  const tmdbId = 987654;
  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, year, path, tmdb_id, last_seen_at
    ) VALUES (?, 'movie', 'Bad Guys 2', 'bad guys 2', 2025, '/media/animation/bad-guys-2.mkv', ?, datetime('now'))`,
    [randomUUID(), tmdbId]
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
