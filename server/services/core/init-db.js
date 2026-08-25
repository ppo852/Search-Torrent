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
      qbit_api_key TEXT,
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
    if (!columns.includes('download_path_animation')) {
      await run("ALTER TABLE users ADD COLUMN download_path_animation TEXT");
      logger.info("Migration: Ajout de download_path_animation à la table users");
    }
    if (!columns.includes('allow_force_interactive_download')) {
      await run("ALTER TABLE users ADD COLUMN allow_force_interactive_download INTEGER DEFAULT 0");
      logger.info("Migration: Ajout de allow_force_interactive_download à la table users");
    }
    if (!columns.includes('last_seen_app_version')) {
      await run("ALTER TABLE users ADD COLUMN last_seen_app_version TEXT");
      logger.info("Migration: Ajout de last_seen_app_version à la table users");
    }
    if (!columns.includes('qbit_api_key')) {
      await run("ALTER TABLE users ADD COLUMN qbit_api_key TEXT");
      logger.info("Migration: Ajout de qbit_api_key à la table users");
    }
    if (columns.includes('qbit_username')) {
      await run('ALTER TABLE users DROP COLUMN qbit_username');
      logger.info("Migration: Suppression de qbit_username");
    }
    if (columns.includes('qbit_password')) {
      await run('ALTER TABLE users DROP COLUMN qbit_password');
      logger.info("Migration: Suppression de qbit_password");
    }

    // Table legacy `settings` (non utilisée — les réglages sont dans app_settings).
    // Conservée si déjà présente ; créée vide pour ne pas casser d'anciennes bases.
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

    try {
      const tvCols = await query("PRAGMA table_info('tv_season_requests')");
      const tvNames = new Set((tvCols || []).map((c) => c.name));
      if (!tvNames.has('completed_at')) {
        await run(`ALTER TABLE tv_season_requests ADD COLUMN completed_at TEXT`);
      }
      await run(
        `UPDATE tv_season_requests
         SET completed_at = COALESCE(completed_at, last_checked_at, created_at)
         WHERE status = 'completed' AND completed_at IS NULL`
      );
    } catch {
      // ignore
    }

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
      last_seen_at TEXT,
      tmdb_id INTEGER,
      original_title TEXT,
      tmdb_resolve_attempts INTEGER NOT NULL DEFAULT 0
    )`);

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
    await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_tmdb ON emby_media_inventory(media_kind, tmdb_id, season, episode)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_title ON emby_media_inventory(media_kind, title_normalized, year, season, episode)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_emby_media_inventory_library ON emby_media_inventory(library_id)`);

    // Création des index pour optimiser les requêtes
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_feed_id ON rss_items_cache(feed_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_expires_at ON rss_items_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_normalized_title ON tmdb_cache(normalized_title)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_expires_at ON tmdb_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_tv_show_cache_expires_at ON tmdb_tv_show_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_app_cache_expires_at ON app_cache(expires_at)`);
    await run(`DROP TABLE IF EXISTS user_rss_feeds`);

    await run(`CREATE TABLE IF NOT EXISTS admin_activity_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor_username TEXT,
      target_label TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at)`);
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
    const existingMediaScanInterval = await get('SELECT value FROM app_settings WHERE name = ?', ['media_scan_interval_minutes']);
    const existingAutoDeleteCompleted = await get('SELECT value FROM app_settings WHERE name = ?', ['media_requests_auto_delete_completed_after_hours']);

    // Anciens chemins globaux inutilisés (scan = download_path_* user)
    await run(
      `DELETE FROM app_settings WHERE name IN ('media_movies_path', 'media_series_path', 'media_anime_path', 'media_animation_path')`
    );
    if (!existingProfiles || !existingAssignments) {
      // 2 profils de base ; Animation/Anime pointent sur le même profil (repli explicite)
      const filmsAnimationId = randomUUID();
      const seriesAnimeId = randomUUID();

      const defaultProfiles = [
        {
          id: filmsAnimationId,
          name: 'Films/Animation - Standard',
          min_size_mb: 0,
          max_size_mb: 0,
          required_keywords: [],
          blocked_keywords: [],
          sort_by: 'seeds_desc'
        },
        {
          id: seriesAnimeId,
          name: 'Séries/Anime - Standard',
          min_size_mb: 0,
          max_size_mb: 0,
          required_keywords: [],
          blocked_keywords: [],
          sort_by: 'seeds_desc'
        }
      ];

      const defaultAssignments = {
        movie_profile_id: filmsAnimationId,
        animation_profile_id: filmsAnimationId,
        tv_profile_id: seriesAnimeId,
        anime_profile_id: seriesAnimeId
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
    } else if (existingAssignments) {
      // Migration douce : ajouter animation/anime (repli films/séries) si absents
      try {
        let assignments = JSON.parse(existingAssignments.value);
        if (assignments && typeof assignments === 'object') {
          let changed = false;
          if (!assignments.animation_profile_id && assignments.movie_profile_id) {
            assignments.animation_profile_id = assignments.movie_profile_id;
            changed = true;
          }
          if (!assignments.anime_profile_id && assignments.tv_profile_id) {
            assignments.anime_profile_id = assignments.tv_profile_id;
            changed = true;
          }
          if (changed) {
            await run(
              'UPDATE app_settings SET value = ?, updated_at = ? WHERE name = ?',
              [JSON.stringify(assignments), now, 'quality_profile_assignments']
            );
          }
        }
      } catch {
        // ignore
      }
    }

    if (!existingAutoSearchInterval) {
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'auto_search_interval_minutes', JSON.stringify(60), now, now]
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

export default {
  initializeDatabase
};
