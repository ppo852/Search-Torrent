import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';
import * as settingsService from '../../server/services/settings/index.js';

test('GET /api/settings/public — pas de secrets TMDB/Prowlarr', async () => {
  const app = await getTestApp();
  const { authHeader } = await loginAsAdmin(app);

  await settingsService.saveSetting('tmdb_access_token', 'secret-tmdb-token-test');
  await settingsService.saveSetting('prowlarr_url', 'http://prowlarr.local');
  await settingsService.saveSetting('prowlarr_api_key', 'secret-prowlarr-key');

  const res = await request(app)
    .get('/api/settings/public')
    .set(authHeader);

  assert.equal(res.status, 200);
  assert.equal(typeof res.body.tmdb_configured, 'boolean');
  assert.equal(typeof res.body.prowlarr_configured, 'boolean');
  assert.equal(typeof res.body.emby_configured, 'boolean');
  assert.equal(res.body.tmdb_configured, true);
  assert.equal(res.body.prowlarr_configured, true);
  assert.equal(res.body.tmdb_access_token, undefined);
  assert.equal(res.body.prowlarr_api_key, undefined);
  assert.equal(res.body.prowlarr_url, undefined);
  assert.equal(res.body.emby_url, undefined);
  assert.equal(res.body.emby_api_key, undefined);
});

test('GET /api/settings/global — réservé admin', async () => {
  const app = await getTestApp();
  const { authHeader } = await loginAsAdmin(app);

  const adminRes = await request(app)
    .get('/api/settings/global')
    .set(authHeader);

  assert.equal(adminRes.status, 200);
});

test('GET /api/settings/public — requiert authentification', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/settings/public');

  assert.equal(res.status, 401);
});
