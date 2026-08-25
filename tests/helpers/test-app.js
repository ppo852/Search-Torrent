import { initializeDatabase } from '../../server/services/core/init-db.js';
import serverConfig from '../../server/services/core/server-config.js';

let cachedApp = null;
let initialized = false;

export async function getTestApp() {
  if (!cachedApp) {
    if (!initialized) {
      await initializeDatabase();
      initialized = true;
    }
    cachedApp = serverConfig.configureServer().app;
  }
  return cachedApp;
}

export async function loginAsAdmin(app) {
  const request = (await import('supertest')).default;
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin' });

  if (response.status !== 200) {
    throw new Error(`Login admin échoué: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    token: response.body.token,
    user: response.body.user,
    authHeader: { Authorization: `Bearer ${response.body.token}` },
  };
}
