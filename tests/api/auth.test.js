import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getTestApp, loginAsAdmin } from '../helpers/test-app.js';
import { saveSetting } from '../../server/services/settings/index.js';

async function seedOrganizrSsoSettings() {
  await saveSetting('organizr_sso_enabled', true);
  await saveSetting('organizr_url', 'http://organizr-test');
  await saveSetting('organizr_auth_group', '998');
}

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

describe('Organizr SSO (settings UI)', { concurrency: false }, () => {
  async function withMockedFetch(mockImpl, fn) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockImpl;
    try {
      await fn();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  test('status — désactivé sans config UI', async () => {
    const app = await getTestApp();
    await saveSetting('organizr_sso_enabled', false);
    await saveSetting('organizr_url', '');

    const res = await request(app).get('/api/auth/organizr-sso/status');

    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, false);
  });

  test('status — activé via settings UI', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();

    const res = await request(app).get('/api/auth/organizr-sso/status');

    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, true);
    assert.equal(res.body.authGroup, '998');
  });

  test('POST — cookie manquant', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();
    const res = await request(app).post('/api/auth/organizr-sso');

    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'ORGANIZR_COOKIE_MISSING');
  });

  test('POST — succès si user search existe', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();
    let forwardedCookie = '';

    await withMockedFetch(async (_url, init) => {
      const headers = init?.headers;
      if (headers && typeof headers.get === 'function') {
        forwardedCookie = headers.get('Cookie') || headers.get('cookie') || '';
      } else {
        forwardedCookie = headers?.Cookie || headers?.cookie || '';
      }
      return new Response(
        JSON.stringify({
          response: {
            result: 'success',
            message: 'User is authorized',
            data: { user: 'admin', group: 0, email: 'admin@lab.local' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }, async () => {
      const res = await request(app)
        .post('/api/auth/organizr-sso')
        .set('Cookie', 'foo=bar; organizr_token_any-uuid=fake-jwt-value');

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.username, 'admin');
      assert.equal(res.body.user.is_admin, true);
      assert.match(forwardedCookie, /organizr_token_/i);
      assert.doesNotMatch(forwardedCookie, /\bfoo=/);
    });
  });

  test('POST — refus si user search absent', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();

    await withMockedFetch(
      async () =>
        new Response(
          JSON.stringify({
            response: {
              result: 'success',
              data: { user: 'ghost-user-not-in-search', group: 4 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
      async () => {
        const res = await request(app)
          .post('/api/auth/organizr-sso')
          .set('Cookie', 'organizr_token_any-uuid=fake-jwt-value');

        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'ORGANIZR_USER_NOT_PROVISIONED');
      }
    );
  });

  test('POST — session Organizr refusée', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();

    await withMockedFetch(
      async () =>
        new Response(JSON.stringify({ response: { result: 'error' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      async () => {
        const res = await request(app)
          .post('/api/auth/organizr-sso')
          .set('Cookie', 'organizr_token_any-uuid=fake-jwt-value');

        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'ORGANIZR_UNAUTHORIZED');
      }
    );
  });

  test('sync — login MP → noop sans cookie Organizr', async () => {
    const app = await getTestApp();
    const { authHeader } = await loginAsAdmin(app);

    const res = await request(app)
      .post('/api/auth/organizr-sso/sync')
      .set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'noop');
  });

  test('sync — session Organizr + cookie absent → logout', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();

    let ssoToken;
    await withMockedFetch(
      async () =>
        new Response(
          JSON.stringify({
            response: { result: 'success', data: { user: 'admin' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
      async () => {
        const loginRes = await request(app)
          .post('/api/auth/organizr-sso')
          .set('Cookie', 'organizr_token_x=fake');
        assert.equal(loginRes.status, 200);
        assert.equal(loginRes.body.user.auth_via, 'organizr');
        ssoToken = loginRes.body.token;
      }
    );

    const syncRes = await request(app)
      .post('/api/auth/organizr-sso/sync')
      .set('Authorization', `Bearer ${ssoToken}`);

    assert.equal(syncRes.status, 200);
    assert.equal(syncRes.body.action, 'logout');
  });

  test('sync — même user Organizr → same', async () => {
    const app = await getTestApp();
    await seedOrganizrSsoSettings();

    await withMockedFetch(
      async () =>
        new Response(
          JSON.stringify({
            response: { result: 'success', data: { user: 'admin' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
      async () => {
        const loginRes = await request(app)
          .post('/api/auth/organizr-sso')
          .set('Cookie', 'organizr_token_x=fake');
        assert.equal(loginRes.status, 200);

        const syncRes = await request(app)
          .post('/api/auth/organizr-sso/sync')
          .set('Authorization', `Bearer ${loginRes.body.token}`)
          .set('Cookie', 'organizr_token_x=fake');

        assert.equal(syncRes.status, 200);
        assert.equal(syncRes.body.action, 'same');
      }
    );
  });
});
