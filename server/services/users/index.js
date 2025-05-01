// Service de gestion des utilisateurs
import bcrypt from 'bcryptjs';
import db, { get, run, query } from '../core/db.js';
import admin from './admin.js';

/**
 * Vérifie les identifiants d'un utilisateur
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} Objet utilisateur sans le mot de passe si authentifié, null sinon
 */
export async function verifyCredentials(username, password) {
  try {
    console.log(`👤 Tentative de connexion pour: ${username}`);
    
    // Utiliser la fonction get importée, pas la méthode de l'objet db
    const user = await get(
      `SELECT id, username, password, is_admin, created_at, 
       qbit_url, qbit_username, qbit_password FROM users WHERE username = ?`,
      [username]
    );
    
    if (!user) {
      console.log(`❌ Login failed: user not found - ${username}`);
      return null;
    }
    
    // Transformer les champs booléens stockés comme entiers
    const processedUser = {
      ...user,
      is_admin: !!user.is_admin,
      has_qbit_url: !!user.qbit_url,
      has_qbit_username: !!user.qbit_username,
      has_qbit_password: !!user.qbit_password,
      qbit_url: user.qbit_url || 'non configuré'
    };
    
    console.log('✅ Utilisateur trouvé:', processedUser);
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log(`❌ Login failed: invalid password - ${username}`);
      return null;
    }
    
    // Ne pas retourner le mot de passe dans l'objet utilisateur
    const { password: _, ...userWithoutPassword } = user;
    
    console.log('🔑 Login successful:', {
      username: user.username,
      is_admin: !!user.is_admin,
      qbit_url: user.qbit_url || 'non configuré',
      qbit_username: user.qbit_username || 'non configuré',
      qbit_password: user.qbit_password ? '**********' : 'non configuré'
    });
    
    return {
      ...userWithoutPassword,
      is_admin: !!userWithoutPassword.is_admin
    };
  } catch (error) {
    console.error('Erreur lors de la vérification des identifiants:', error);
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
       qbit_url, qbit_username FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!user) return null;
    
    return {
      ...user,
      is_admin: !!user.is_admin
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
}

// Exporter les fonctions principales et le sous-module admin
export default {
  verifyCredentials,
  getUserById,
  admin
};
