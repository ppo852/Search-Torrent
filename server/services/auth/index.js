// Service d'authentification principal
import jwt from './jwt.js';
import usersService from '../users/index.js';

/**
 * Authentifie un utilisateur avec nom d'utilisateur et mot de passe
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} Objet contenant l'utilisateur et le token si authentifié, null sinon
 */
export async function authenticateUser(username, password) {
  try {
    // Vérifier les identifiants
    const user = await usersService.verifyCredentials(username, password);
    
    if (!user) {
      return null;
    }
    
    // Générer un token JWT
    const token = jwt.generateToken(user);
    
    // Retourner l'utilisateur et le token
    return {
      user,
      token
    };
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    return null;
  }
}

export default {
  authenticateUser,
  jwt
};
