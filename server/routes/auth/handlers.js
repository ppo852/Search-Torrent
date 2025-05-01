// Gestionnaires de routes pour l'authentification
import authService from '../../services/auth/index.js';

/**
 * Gère la connexion d'un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function loginHandler(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    const result = await authService.authenticateUser(username, password);
    
    if (!result) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
    
    const { user, token } = result;
    
    // Log pour le debugging
    console.log('📤 Envoi des données au client:', {
      token: token.substring(0, 100) + '...',
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        qbit_url: user.qbit_url,
        qbit_username: user.qbit_username,
        qbit_password: user.qbit_password ? 'non configuré' : null,
        created_at: user.created_at
      }
    });
    
    // Envoyer la réponse avec le token et les informations utilisateur
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        qbit_url: user.qbit_url,
        qbit_username: user.qbit_username,
        qbit_password: user.qbit_password ? 'non configuré' : null,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * Vérifie si un token est valide
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export function verifyTokenHandler(req, res) {
  // Si on arrive ici, c'est que le middleware authenticateToken a réussi
  return res.status(200).json({ valid: true, user: req.user });
}

export default {
  loginHandler,
  verifyTokenHandler
};
