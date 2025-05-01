// Script d'initialisation de la base de données
import db from './db.js';
import { run, get, query } from './db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Initialise la base de données avec toutes les tables nécessaires
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  try {
    console.log('Initialisation de la base de données...');

    // Création de la table users si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      is_admin INTEGER,
      created_at TEXT,
      qbit_url TEXT,
      qbit_username TEXT,
      qbit_password TEXT
    )`);
    console.log('Table users vérifiée/créée');

    // Création de la table settings si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    console.log('Table settings vérifiée/créée');

    // Création de la table global_rss_feeds si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS global_rss_feeds (
      id TEXT PRIMARY KEY,
      feed_name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    console.log('Table global_rss_feeds vérifiée/créée');

    // Création de la table user_rss_feeds si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS user_rss_feeds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      feed_name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    console.log('Table user_rss_feeds vérifiée/créée');

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
    console.log('Table rss_items_cache vérifiée/créée');

    // Création de la table tmdb_cache si elle n'existe pas
    await run(`CREATE TABLE IF NOT EXISTS tmdb_cache (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      tmdb_data TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);
    console.log('Table tmdb_cache vérifiée/créée');

    // Création de la table app_settings si elle n'existe pas (table additionnelle)
    await run(`CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    console.log('Table app_settings vérifiée/créée');

    // Création des index pour optimiser les requêtes
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_feed_id ON rss_items_cache(feed_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_rss_items_cache_expires_at ON rss_items_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_normalized_title ON tmdb_cache(normalized_title)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tmdb_cache_expires_at ON tmdb_cache(expires_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_user_rss_feeds_user_id ON user_rss_feeds(user_id)`);
    console.log('Index vérifiés/créés');

    // Création de l'utilisateur admin s'il n'existe pas
    await createAdminUserIfNotExists();

    // Initialisation des paramètres par défaut s'ils n'existent pas
    await initializeDefaultSettings();

    console.log('Initialisation de la base de données terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
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
      console.log('Création de l\'utilisateur admin...');
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
      console.log('Utilisateur admin créé avec succès');
    } else {
      console.log('L\'utilisateur admin existe déjà');
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur admin:', error);
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
      console.log('Initialisation des paramètres par défaut...');
      const defaultSettings = {
        prowlarr_url: '',
        prowlarr_api_key: '',
        tmdb_access_token: '',
        min_seeds: 3
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        await run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      }
      console.log('Paramètres par défaut initialisés');
    } else {
      console.log('Les paramètres existent déjà dans la base de données');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des paramètres par défaut:', error);
    throw error;
  }
}

export default {
  initializeDatabase
};
