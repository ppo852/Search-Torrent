import jwtService from '../services/auth/jwt.js';

/**
 * Middleware d'authentification par token JWT
 * Vérifie la présence et la validité d'un token JWT dans les headers
 * et ajoute les informations utilisateur décodées à l'objet requête
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('Token manquant');
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwtService.verifyToken(token)
    .then(user => {
      // console.log('Utilisateur authentifié:', user); // Commenté pour réduire les logs
      req.user = user;
      next();
    })
    .catch(err => {
      console.error('JWT verification error:', err);
      return res.status(401).json({ error: 'Token invalide' });
    });
}

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 * À utiliser après le middleware authenticateToken
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

export default {
  authenticateToken,
  requireAdmin
};
