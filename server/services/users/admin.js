// Service de gestion du compte administrateur
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import db, { get, run } from '../core/db.js';
import config from '../core/config.js';

/**
 * Vérifie si le compte administrateur existe déjà
 * @returns {Promise<boolean>} true si l'admin existe, false sinon
 */
export async function adminExists() {
  try {
    // Utiliser la fonction get importée, pas la méthode de l'objet db
    const row = await get("SELECT * FROM users WHERE username = ?", [config.auth.adminUsername]);
    return !!row;
  } catch (error) {
    console.error('Erreur lors de la vérification du compte admin:', error);
    return false;
  }
}

/**
 * Crée le compte administrateur avec le mot de passe par défaut
 * @returns {Promise<Object>} Objet représentant l'utilisateur admin créé ou null en cas d'erreur
 */
export async function createAdminUser() {
  try {
    console.log('Création du compte administrateur...');
    
    const exists = await adminExists();
    if (exists) {
      console.log('Le compte administrateur existe déjà.');
      return null;
    }
    
    // Comptes admin à créer
    const adminPassword = config.auth.adminDefaultPassword || 'admin'; // Valeur par défaut au cas où
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const userId = randomUUID();
    const now = new Date().toISOString();
    
    // Utiliser la fonction run importée, pas la méthode de l'objet db
    const query = 'INSERT INTO users (id, username, password, is_admin, created_at) VALUES (?, ?, ?, ?, ?)';
    const params = [
      userId,
      config.auth.adminUsername || 'admin',
      hashedPassword,
      1,
      now
    ];
    
    // Fonction run() avec des Promises 
    const result = await run(query, params);
    
    if (result && result.changes > 0) {
      console.log('Compte administrateur créé avec succès');
      return {
        id: userId,
        username: config.auth.adminUsername || 'admin',
        is_admin: true,
        created_at: now
      };
    } else {
      console.error('Erreur lors de la création du compte admin: aucune ligne insérée');
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la création du compte admin:', error);
    return null;
  }
}

/**
 * Initialise le compte administrateur si nécessaire
 * @returns {Promise<void>}
 */
export async function initializeAdmin() {
  try {
    const exists = await adminExists();
    if (!exists) {
      await createAdminUser();
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du compte admin:', error);
  }
}

export default {
  adminExists,
  createAdminUser,
  initializeAdmin
};
