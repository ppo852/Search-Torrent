// Configuration globale de l'application
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Constantes liées aux chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../..');
const dataDir = join(rootDir, 'data');

// Configuration de la base de données
const dbPath = process.env.DATABASE_PATH || join(dataDir, 'database.sqlite');

// Configuration de l'authentification
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL ERROR: JWT_SECRET environment variable is missing in production!');
    console.error('Server will use a temporary secret, but this is EXTREMELY INSECURE.');
  } else {
    console.warn('⚠️ Warning: JWT_SECRET is not defined, using default development secret.');
  }
  JWT_SECRET = 'dev-secret-keep-it-safe';
}
const JWT_EXPIRES_IN = '24h';

// Configuration de l'application
const PORT = process.env.PORT || 3001;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Configuration du cache
const CACHE_DURATION_MINUTES = 60;
const TMDB_CACHE_DURATION_DAYS = 7;

// Export des constantes
// Note: compte initial admin/admin créé dans init-db.js (pas via env)
export default {
  paths: {
    root: rootDir,
    data: dataDir,
    db: dbPath
  },
  db: {
    path: dbPath
  },
  auth: {
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN
  },
  app: {
    port: PORT,
    isDevelopment: IS_DEVELOPMENT
  },
  cache: {
    defaultDuration: CACHE_DURATION_MINUTES,
    tmdbDuration: TMDB_CACHE_DURATION_DAYS
  }
};
