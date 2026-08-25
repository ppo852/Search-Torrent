// Service de gestion des utilisateurs
import bcrypt from 'bcryptjs';
import db, { get, run, query } from '../core/db.js';
import logger from '../core/logger.js';

/**
 * Vérifie les identifiants d'un utilisateur
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} Objet utilisateur sans le mot de passe si authentifié, null sinon
 */
export async function verifyCredentials(username, password) {
  try {
    const user = await get("SELECT * FROM users WHERE username = ?", [username]);

    if (!user) {
      logger.warn(`Login failed: user not found - ${username}`);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`Login failed: invalid password - ${username}`);
      return null;
    }
    
    // Ne pas retourner les secrets dans l'objet utilisateur
    const hasQbitApiKey = !!(user.qbit_api_key && String(user.qbit_api_key).trim());
    const { password: _, qbit_api_key: __, ...userWithoutSecrets } = user;
    
    logger.info(`Login successful for user: ${username}`);
    
    return {
      ...userWithoutSecrets,
      has_qbit_api_key: hasQbitApiKey,
      is_admin: !!userWithoutSecrets.is_admin,
      allow_force_interactive_download: !!userWithoutSecrets.allow_force_interactive_download,
      last_seen_app_version: userWithoutSecrets.last_seen_app_version || null
    };
  } catch (error) {
    logger.error('Erreur lors de la vérification des identifiants:', error);
    return null;
  }
}

/**
 * Récupère un utilisateur par son ID
 * @param {string} userId - ID de l'utilisateur à récupérer
 * @returns {Promise<Object|null>} Objet utilisateur ou null si non trouvé
 */
export async function getUserById(userId) {
  try {
    // Utiliser la fonction get importée, pas la méthode de l'objet db
    const user = await get(
      `SELECT id, username, is_admin, created_at, 
       qbit_url, download_path_movies, download_path_series, download_path_anime, download_path_animation,
       allow_force_interactive_download, last_seen_app_version,
       (CASE WHEN qbit_api_key IS NOT NULL AND trim(qbit_api_key) != '' THEN 1 ELSE 0 END) AS has_qbit_api_key
       FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!user) return null;
    
    return {
      ...user,
      is_admin: !!user.is_admin,
      allow_force_interactive_download: !!user.allow_force_interactive_download,
      has_qbit_api_key: !!user.has_qbit_api_key,
      last_seen_app_version: user.last_seen_app_version || null
    };
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
}

/**
 * Récupère tous les utilisateurs
 * @returns {Promise<Array>} Liste de tous les utilisateurs
 */
export async function getAllUsers() {
  try {
    const users = await query(
      `SELECT id, username, is_admin, created_at, 
       qbit_url, download_path_movies, download_path_series, download_path_anime, download_path_animation,
       allow_force_interactive_download,
       (CASE WHEN qbit_api_key IS NOT NULL AND trim(qbit_api_key) != '' THEN 1 ELSE 0 END) AS has_qbit_api_key
       FROM users`
    );
    return (users || []).map(u => ({
      ...u,
      is_admin: !!u.is_admin,
      allow_force_interactive_download: !!u.allow_force_interactive_download,
      has_qbit_api_key: !!u.has_qbit_api_key
    }));
  } catch (error) {
    logger.error('Erreur lors de la récupération de tous les utilisateurs:', error);
    return [];
  }
}

export default {
  verifyCredentials,
  getUserById,
  getAllUsers
};
