// Middleware pour la gestion des rôles

/**
 * Middleware qui vérifie si l'utilisateur est administrateur
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 * @param {Function} next - Fonction next() d'Express
 */
export function adminOnly(req, res, next) {
  // L'utilisateur est déjà authentifié grâce au middleware authenticateToken
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Vérifier si l'utilisateur est administrateur
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Accès refusé: droits administrateur requis' });
  }
  
  // Si l'utilisateur est admin, continuer
  next();
}

/**
 * Middleware qui vérifie si l'utilisateur est l'utilisateur demandé ou un administrateur
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 * @param {Function} next - Fonction next() d'Express
 */
export function userOrAdmin(req, res, next) {
  // L'utilisateur est déjà authentifié grâce au middleware authenticateToken
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Permettre l'accès si l'utilisateur est admin ou s'il accède à ses propres données
  if (req.user.is_admin || req.user.id === req.params.id) {
    next();
  } else {
    return res.status(403).json({ error: 'Accès refusé: vous n\'avez pas les droits nécessaires' });
  }
}
