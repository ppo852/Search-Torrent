import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';

test('POST /api/auth/login — succès admin', async () => {
  const app = await getTestApp();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin' });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.username, 'admin');
  assert.equal(res.body.user.is_admin, true);
});

test('POST /api/auth/login — identifiants invalides', async () => {
  const app = await getTestApp();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'wrong-password' });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Nom d\'utilisateur ou mot de passe incorrect');
});

test('POST /api/auth/login — champs manquants', async () => {
  const app = await getTestApp();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin' });

  assert.equal(res.status, 400);
});

test('GET /api/auth/verify — token valide', async () => {
  const app = await getTestApp();
  const { authHeader } = await loginAsAdmin(app);

  const res = await request(app)
    .get('/api/auth/verify')
    .set(authHeader);

  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);
  assert.equal(res.body.user.username, 'admin');
});

test('GET /api/auth/verify — sans token', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/auth/verify');

  assert.equal(res.status, 401);
});
