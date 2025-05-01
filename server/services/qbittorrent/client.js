// Fonctions utilitaires pour communiquer avec l'API qBittorrent
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { get as getDb } from '../../services/core/db.js';

/**
 * Obtient les informations qBittorrent de l'utilisateur
 * @param {Object} db - Instance de la base de données (paramètre ignoré)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Informations de connexion qBittorrent de l'utilisateur
 */
export async function getQBitUserInfo(db, userId) {
  try {
    // console.log('Diagnostic DB - userId recherché:', userId);
    
    // Vérifier si l'utilisateur existe
    // console.log('Vérification si l\'utilisateur existe...');
    const userExists = await getDb('SELECT id, username FROM users WHERE id = ?', [userId]);
    // console.log('Utilisateur trouvé dans la base:', userExists ? 'Oui' : 'Non', userExists ? JSON.stringify(userExists) : '');
    
    // Vérifier la structure de la table users
    // console.log('Vérification de la structure de la table users...');
    const tableInfo = await getDb("PRAGMA table_info('users')");
    // console.log('Structure de la table users:', JSON.stringify(tableInfo));
    
    // Rechercher toutes les colonnes qbit_* dans la table users
    // console.log('Recherche de toutes les colonnes commençant par qbit_...');
    const qbitColumns = await getDb("SELECT name FROM pragma_table_info('users') WHERE name LIKE 'qbit_%'");
    // console.log('Colonnes qbit_ trouvées:', JSON.stringify(qbitColumns));
    
    // Requête originale pour récupérer les paramètres qBittorrent
    // console.log('Exécution de la requête originale...');
    const row = await getDb('SELECT qbit_url, qbit_username, qbit_password FROM users WHERE id = ?', [userId]);
    // console.log('Résultat requête originale:', row ? JSON.stringify(row) : 'null');
    
    return row || {};
  } catch (error) {
    console.error('Erreur lors de la récupération des informations qBittorrent:', error);
    throw error;
  }
}

/**
 * Authentifie auprès de qBittorrent
 * @param {string} qbitUrl - URL de l'instance qBittorrent
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Promise<string>} - Cookie d'authentification
 */
export async function authenticateQBittorrent(qbitUrl, username, password) {
  // Si pas d'identifiants, on retourne un cookie vide
  if (!username || !password) {
    return '';
  }

  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const loginResponse = await fetch(`${qbitUrl}/api/v2/auth/login`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': qbitUrl
    }
  });

  if (!loginResponse.ok) {
    throw new Error('Échec de l\'authentification qBittorrent');
  }

  const loginResult = await loginResponse.text();
  if (loginResult !== 'Ok.') {
    throw new Error('Identifiants qBittorrent invalides');
  }

  return loginResponse.headers.get('set-cookie') || '';
}

/**
 * Effectue une requête générique à l'API qBittorrent
 * @param {string} url - URL complète de l'endpoint
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Object>} - Réponse de l'API
 */
export async function makeQBittorrentRequest(url, options) {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`qBittorrent API error: ${response.status} - ${errorText || response.statusText}`);
  }
  
  // Selon le type de contenu, retourner JSON ou texte
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  } else {
    return response.text();
  }
}
