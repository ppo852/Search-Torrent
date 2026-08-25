import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';
import { run } from '../../server/services/core/db.js';
import { ensureInventorySchema } from '../helpers/db-schema.js';

const TMDB_ID = 55101;

async function seedTvSeasonFixture(userId) {
  await ensureInventorySchema();

  await run(
    `INSERT INTO local_media_inventory (
      id, media_kind, title, title_normalized, tmdb_id, season, episode, path, last_seen_at
    ) VALUES (?, 'tv', 'Lanterns Test', 'lanterns test', ?, 1, 1, ?, datetime('now'))`,
    [randomUUID(), TMDB_ID, `/media/tv/lanterns-s01e01-${randomUUID()}.mkv`]
  );

  await run(
    `INSERT INTO tv_season_requests (
      id, user_id, tmdb_id, media_type, title, poster_url, season_number, status, next_episode_number, created_at
    ) VALUES (?, ?, ?, 'tv', 'Lanterns Test', NULL, 1, 'monitoring', 1, datetime('now'))`,
    [randomUUID(), userId, TMDB_ID]
  );
}

test('GET /api/library/tv/show/:tmdbId/season-status — requiert authentification', async () => {
  const app = await getTestApp();
  const res = await request(app).get(`/api/library/tv/show/${TMDB_ID}/season-status`);

  assert.equal(res.status, 401);
});

test('GET /api/library/tv/show/:tmdbId/season-status — tmdbId invalide', async () => {
  const app = await getTestApp();
  const { authHeader } = await loginAsAdmin(app);

  const res = await request(app)
    .get('/api/library/tv/show/0/season-status')
    .set(authHeader);

  assert.equal(res.status, 400);
});

test('GET /api/library/tv/show/:tmdbId/season-status — inventaire et demande saison', async () => {
  const app = await getTestApp();
  const { authHeader, user } = await loginAsAdmin(app);

  await seedTvSeasonFixture(user.id);

  const res = await request(app)
    .get(`/api/library/tv/show/${TMDB_ID}/season-status?mediaType=tv&title=Lanterns%20Test`)
    .set(authHeader);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.seasons));

  const season1 = res.body.seasons.find((s) => s.season_number === 1);
  assert.ok(season1, 'saison 1 attendue');
  assert.deepEqual(season1.present_episodes, [1]);
  assert.equal(season1.present_count, 1);
  assert.equal(season1.in_library, true);
  assert.equal(season1.requested, true);
  assert.equal(season1.request_status, 'monitoring');
  assert.equal(typeof season1.complete, 'boolean');
  assert.equal(typeof season1.partial, 'boolean');
  assert.equal(typeof season1.still_airing, 'boolean');
  assert.equal(typeof season1.expected_count, 'number');
});
