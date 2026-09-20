// Gestionnaires de routes pour l'authentification
import authService from '../../services/auth/index.js';
import organizr from '../../services/auth/organizr.js';
import { toAuthUserPayload } from '../../services/auth/session-payload.js';
import { logActivity } from '../../services/activity-log/index.js';

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
      await logActivity({
        eventType: 'auth.login_failed',
        actorUsername: username,
        targetLabel: username,
      });
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    const { user, token } = result;

    await logActivity({
      eventType: 'auth.login_success',
      actorUsername: user.username,
      targetLabel: user.username,
    });

    return res.status(200).json({
      token,
      user: toAuthUserPayload(user),
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
  return res.status(200).json({ valid: true, user: req.user });
}

/** Statut public du SSO Organizr (sans secrets) */
export async function organizrSsoStatusHandler(_req, res) {
  try {
    const status = await organizr.getOrganizrSsoStatus();
    return res.status(200).json(status);
  } catch (error) {
    console.error('Erreur statut SSO Organizr:', error);
    return res.status(500).json({ enabled: false });
  }
}

/** Test admin : joignabilité API Organizr */
export async function organizrSsoTestHandler(_req, res) {
  try {
    const result = await organizr.testOrganizrApiConnection();
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erreur test SSO Organizr:', error);
    return res.status(500).json({ ok: false, error: 'Erreur interne du serveur' });
  }
}

/** Connexion via session Organizr (user search déjà provisionné) */
export async function organizrSsoHandler(req, res) {
  try {
    const result = await authService.authenticateWithOrganizr(req.headers.cookie);

    if (!result.ok) {
      if (result.code === 'ORGANIZR_USER_NOT_PROVISIONED') {
        await logActivity({
          eventType: 'auth.organizr_sso_not_provisioned',
          actorUsername: 'organizr',
          targetLabel: result.error,
        });
      }
      return res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
    }

    const { user, token } = result;

    await logActivity({
      eventType: 'auth.organizr_sso_success',
      actorUsername: user.username,
      targetLabel: user.username,
    });

    return res.status(200).json({
      token,
      user: toAuthUserPayload(user),
    });
  } catch (error) {
    console.error('Erreur SSO Organizr:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * Resync session SSO liée à Organizr (toujours HTTP 200 + action).
 * Évite le logout global du fetch 401 côté front.
 */
export async function organizrSsoSyncHandler(req, res) {
  try {
    const result = await authService.syncOrganizrBoundSession(
      req.headers.cookie,
      req.user
    );

    if (result.action === 'switched') {
      await logActivity({
        eventType: 'auth.organizr_sso_success',
        actorUsername: result.user.username,
        targetLabel: `switch ← ${req.user?.username || '?'}`,
      });
      return res.status(200).json({
        action: 'switched',
        token: result.token,
        user: toAuthUserPayload(result.user),
      });
    }

    return res.status(200).json({
      action: result.action,
      code: result.code,
      error: result.error,
    });
  } catch (error) {
    console.error('Erreur sync SSO Organizr:', error);
    return res.status(500).json({ action: 'noop', error: 'Erreur interne du serveur' });
  }
}

export default {
  loginHandler,
  verifyTokenHandler,
  organizrSsoStatusHandler,
  organizrSsoTestHandler,
  organizrSsoHandler,
  organizrSsoSyncHandler,
};
