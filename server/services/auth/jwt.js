// Service de gestion des tokens JWT
import jwt from 'jsonwebtoken';
import config from '../core/config.js';

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} user - Objet utilisateur à encoder dans le token
 * @returns {string} Token JWT généré
 */
export function generateToken(user) {
  // Sélectionner uniquement les propriétés nécessaires pour le token
  const payload = {
    id: user.id,
    username: user.username,
    is_admin: user.is_admin,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(
    payload,
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

/**
 * Vérifie la validité d'un token JWT
 * @param {string} token - Token JWT à vérifier
 * @returns {Promise<Object>} Données utilisateur décodées ou erreur
 */
export function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.auth.jwtSecret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

export default {
  generateToken,
  verifyToken
};
