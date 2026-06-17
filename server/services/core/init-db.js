// Script d'initialisation de la base de données
import { run, get, query } from './db.js';
import logger from './logger.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Initialise la base de données avec toutes les tables nécessaires
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  try {
    // Création de la table users si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      is_admin INTEGER,
      created_at TEXT,
      qbit_url TEXT,
      qbit_username TEXT,
      qbit_password TEXT,
      download_path_movies TEXT,
      download_path_series TEXT
    )`);

    // Migration : Ajouter les colonnes de chemin de téléchargement si elles n'existent pas
    const tableInfo = await query("PRAGMA table_info(users)");
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes('download_path_movies')) {
      await run("ALTER TABLE users ADD COLUMN download_path_movies TEXT");
      logger.info("Migration: Ajout de download_path_movies à la table users");
    }
    if (!columns.includes('download_path_series')) {
      await run("ALTER TABLE users ADD COLUMN download_path_series TEXT");
      logger.info("Migration: Ajout de download_path_series à la table users");
    }
    if (!columns.includes('download_path_anime')) {
      await run("ALTER TABLE users ADD COLUMN download_path_anime TEXT");
      logger.info("Migration: Ajout de download_path_anime à la table users");
    }
    if (!columns.includes('allow_force_interactive_download')) {
      await run("ALTER TABLE users ADD COLUMN allow_force_interactive_download INTEGER DEFAULT 0");
      logger.info("Migration: Ajout de allow_force_interactive_download à la table users");
    }

    // Création de la table settings si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Création de la table global_rss_feeds si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS global_rss_feeds (
      id TEXT PRIMARY KEY,
      feed_name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);

    // Création de la table user_rss_feeds si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS user_rss_feeds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      feed_name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Création de la table rss_items_cache si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS rss_items_cache (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      items_json TEXT NOT NULL,
      items_with_tmdb_json TEXT,
      tmdb_updated_at TEXT,
      last_updated TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);

    // Création de la table tmdb_cache si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS tmdb_cache (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      tmdb_data TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);

    // Cache persistant des détails show TMDB par tmdb_id (genres, statut, dates)
    await run(`CREATE TABLE IF NOT EXISTS tmdb_tv_show_cache (
      tmdb_id INTEGER PRIMARY KEY,
      show_data TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);

    // Cache applicatif générique (accueil trackers, tendances TMDB, etc.)
    await run(`CREATE TABLE IF NOT EXISTS app_cache (
      id TEXT PRIMARY KEY,
      cache_key TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);

    // Création de la table app_settings si elle n'existe pas (table additionnelle)
    await run(`CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    // Création de la table library_items (suivi films) si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_url TEXT,
      release_date TEXT,
      monitored INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Création de la table media_requests (demandes) si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS media_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_url TEXT,
      release_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      monitored INTEGER DEFAULT 1,
      last_checked_at TEXT,
      last_error TEXT,
      matched_torrent_name TEXT,
      matched_torrent_magnet TEXT,
      matched_torrent_size INTEGER,
      matched_torrent_seeds INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    try {
      const cols = await query("PRAGMA table_info('media_requests')");
      const names = new Set((cols || []).map((c) => c.name));
      if (!names.has('completed_at')) {
        await run(`ALTER TABLE media_requests ADD COLUMN completed_at TEXT`);
      }
    } catch {
      // ignore
    }

    // Création de la table tv_season_requests (suivi séries/anime par saison) si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS tv_season_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_url TEXT,
      season_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'monitoring',
      next_episode_number INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      last_error TEXT,
      matched_torrent_name TEXT,
      matched_torrent_magnet TEXT,
      matched_torrent_size INTEGER,
      matched_torrent_seeds INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Suivi des épisodes en cours de téléchargement
    await run(`CREATE TABLE IF NOT EXISTS tv_episode_downloads (
      id TEXT PRIMARY KEY,
      tv_season_request_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'downloading',
      torrent_name TEXT,
      torrent_magnet TEXT,
      torrent_size INTEGER,
      torrent_seeds INTEGER,
      sent_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (tv_season_request_id) REFERENCES tv_season_requests(id) ON DELETE CASCADE
    )`);

    // Historique des envois à qBittorrent pour les saisons TV
    await run(`CREATE TABLE IF NOT EXISTS tv_season_request_history (
      id TEXT PRIMARY KEY,
      tv_season_request_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tmdb_id INTEGER,
      media_type TEXT,
      title TEXT,
      season_number INTEGER,
      episode_number INTEGER,
      action TEXT NOT NULL,
      torrent_name TEXT,
      torrent_magnet TEXT,
      torrent_size INTEGER,
      torrent_seeds INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tv_season_request_id) REFERENCES tv_season_requests(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS local_media_inventory (
      id TEXT PRIMARY KEY,
      media_kind TEXT NOT NULL,
      title TEXT,
      title_normalized TEXT,
      year INTEGER,
      season INTEGER,
      episode INTEGER,
      path TEXT UNIQUE NOT NULL,
      size INTEGER,
      mtime_ms INTEGER,
      last_seen_at TEXT
    )`);

    // Création des index pour optimiser les requêtes
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_feed_id ON rss_items_cache(feed_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_expires_at ON rss_items_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_normalized_title ON tmdb_cache(normalized_title)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_expires_at ON tmdb_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_tv_show_cache_expires_at ON tmdb_tv_show_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_app_cache_expires_at ON app_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_user_rss_feeds_user_id ON user_rss_feeds(user_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_library_items_user_id ON library_items(user_id)`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_library_items_user_tmdb_type ON library_items(user_id, tmdb_id, media_type)`);

    await run(`CREATE INDEX IF NOT EXISTS idx_media_requests_user_id ON media_requests(user_id)`);
    await run(`DROP INDEX IF EXISTS uniq_media_requests_user_tmdb_type`);

    await run(`CREATE INDEX IF NOT EXISTS idx_tv_season_requests_user_id ON tv_season_requests(user_id)`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_tv_season_requests_tmdb_type_season ON tv_season_requests(tmdb_id, media_type, season_number)`);

    // Dédoublonnage tv_episode_downloads: garder la ligne la plus récente par (demande, épisode)
    await run(
      `DELETE FROM tv_episode_downloads
       WHERE rowid NOT IN (
         SELECT MAX(rowid)
         FROM tv_episode_downloads
         GROUP BY tv_season_request_id, episode_number
       )`
    );
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_tv_episode_downloads_request_episode ON tv_episode_downloads(tv_season_request_id, episode_number)`);

    await run(`CREATE INDEX IF NOT EXISTS idx_tv_season_request_history_request_id ON tv_season_request_history(tv_season_request_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tv_season_request_history_created_at ON tv_season_request_history(created_at)`);

    await run(`CREATE INDEX IF NOT EXISTS idx_local_media_inventory_title ON local_media_inventory(title_normalized)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_local_media_inventory_kind ON local_media_inventory(media_kind)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_local_media_inventory_tv ON local_media_inventory(title_normalized, season, episode)`);

    // Dédoublonnage: garder la première demande (la plus ancienne) pour chaque (tmdb_id, media_type)
    await run(
      `DELETE FROM media_requests
       WHERE rowid NOT IN (
         SELECT MIN(rowid)
         FROM media_requests
         GROUP BY tmdb_id, media_type
       )`
    );

    await run(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_media_requests_tmdb_type ON media_requests(tmdb_id, media_type)`);

    const mediaRequestsCountRow = await get('SELECT COUNT(*) as count FROM media_requests');
    const mediaRequestsCount = mediaRequestsCountRow?.count ?? 0;

    if (mediaRequestsCount === 0) {
      await run(
        `INSERT OR IGNORE INTO media_requests (
          id, user_id, tmdb_id, media_type, title, poster_url, release_date, status, monitored, created_at
        )
        SELECT
          id, user_id, tmdb_id, media_type, title, poster_url, release_date,
          'pending' as status,
          monitored,
          created_at
        FROM library_items`
      );
    }

    // Création de l'utilisateur admin s'il n'existe pas
    await createAdminUserIfNotExists();

    // Initialisation des paramètres par défaut s'ils n'existent pas
    await initializeDefaultSettings();

    // Initialisation des paramètres app_settings (admin) s'ils n'existent pas
    await initializeDefaultAppSettings();
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}

async function initializeDefaultAppSettings() {
  try {
    const now = new Date().toISOString();

    const existingProfiles = await get('SELECT value FROM app_settings WHERE name = ?', ['quality_profiles']);
    const existingAssignments = await get('SELECT value FROM app_settings WHERE name = ?', ['quality_profile_assignments']);
    const existingAutoSearchInterval = await get('SELECT value FROM app_settings WHERE name = ?', ['auto_search_interval_minutes']);
    const existingMediaMoviesPath = await get('SELECT value FROM app_settings WHERE name = ?', ['media_movies_path']);
    const existingMediaSeriesPath = await get('SELECT value FROM app_settings WHERE name = ?', ['media_series_path']);
    const existingMediaAnimePath = await get('SELECT value FROM app_settings WHERE name = ?', ['media_anime_path']);
    const existingMediaScanInterval = await get('SELECT value FROM app_settings WHERE name = ?', ['media_scan_interval_minutes']);
    const existingAutoDeleteCompleted = await get('SELECT value FROM app_settings WHERE name = ?', ['media_requests_auto_delete_completed_after_hours']);

    if (!existingProfiles || !existingAssignments) {
      const movieProfileId = randomUUID();
      const tvProfileId = randomUUID();

      const defaultProfiles = [
        {
          id: movieProfileId,
          name: 'Films - Standard',
          min_size_mb: 0,
          max_size_mb: 0,
          required_keywords: [],
          blocked_keywords: [],
          sort_by: 'seeds_desc'
        },
        {
          id: tvProfileId,
          name: 'Séries/Anime - Standard',
          min_size_mb: 0,
          max_size_mb: 0,
          required_keywords: [],
          blocked_keywords: [],
          sort_by: 'seeds_desc'
        }
      ];

      const defaultAssignments = {
        movie_profile_id: movieProfileId,
        tv_profile_id: tvProfileId
      };

      if (!existingProfiles) {
        await run(
          'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'quality_profiles', JSON.stringify(defaultProfiles), now, now]
        );
      }

      if (!existingAssignments) {
        await run(
          'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'quality_profile_assignments', JSON.stringify(defaultAssignments), now, now]
        );
      }
    }

    if (!existingAutoSearchInterval) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'auto_search_interval_minutes', JSON.stringify(60), now, now]
      );
    }

    if (!existingMediaMoviesPath) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'media_movies_path', JSON.stringify(''), now, now]
      );
    }

    if (!existingMediaSeriesPath) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'media_series_path', JSON.stringify(''), now, now]
      );
    }

    if (!existingMediaAnimePath) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'media_anime_path', JSON.stringify(''), now, now]
      );
    }

    if (!existingMediaScanInterval) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'media_scan_interval_minutes', JSON.stringify(30), now, now]
      );
    }

    if (!existingAutoDeleteCompleted) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'media_requests_auto_delete_completed_after_hours', JSON.stringify(24), now, now]
      );
    }
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation des paramètres app_settings:', error);
    throw error;
  }
}

/**
 * Crée un utilisateur admin par défaut s'il n'existe pas
 * @returns {Promise<void>}
 */
async function createAdminUserIfNotExists() {
  try {
    const row = await get("SELECT * FROM users WHERE username = 'admin'");
    if (!row) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      await run(
        'INSERT INTO users (id, username, password, is_admin, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          'admin',
          hashedPassword,
          1,
          new Date().toISOString()
        ]
      );
    }
  } catch (error) {
    logger.error('Erreur lors de la création de l\'utilisateur admin:', error);
    throw error;
  }
}

/**
 * Initialise les paramètres par défaut dans la table settings
 * @returns {Promise<void>}
 */
async function initializeDefaultSettings() {
  try {
    const row = await get("SELECT COUNT(*) as count FROM settings");

    if (row.count === 0) {
      const defaultSettings = {
        prowlarr_url: '',
        prowlarr_api_key: '',
        tmdb_access_token: '',
        min_seeds: 3
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        await run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      }
    }
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation des paramètres par défaut:', error);
    throw error;
  }
}

export default {
  initializeDatabase
};
