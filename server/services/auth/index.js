// Service d'authentification principal
import jwt from './jwt.js';
import usersService from '../users/index.js';
import organizr from './organizr.js';
import logger from '../core/logger.js';

/**
 * Authentifie un utilisateur avec nom d'utilisateur et mot de passe
 */
export async function authenticateUser(username, password) {
  try {
    const user = await usersService.verifyCredentials(username, password);

    if (!user) {
      return null;
    }

    const token = jwt.generateToken(user, { authVia: 'password' });

    return {
      user: { ...user, auth_via: 'password' },
      token,
    };
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    return null;
  }
}

/**
 * Authentifie via l'API Server Auth Organizr (pas de création auto d'utilisateur).
 */
export async function authenticateWithOrganizr(cookieHeader) {
  const verified = await organizr.verifyOrganizrSession(cookieHeader);
  if (!verified.ok) {
    const status =
      verified.code === 'ORGANIZR_SSO_DISABLED' ? 503 :
      verified.code === 'ORGANIZR_UNAVAILABLE' ? 502 :
      verified.code === 'ORGANIZR_COOKIE_MISSING' ? 401 :
      verified.code === 'ORGANIZR_UNAUTHORIZED' ? 401 :
      401;
    return {
      ok: false,
      status,
      code: verified.code,
      error: verified.message,
    };
  }

  const username = verified.payload.username;
  const user = await usersService.getUserByUsername(username);

  if (!user) {
    logger.warn(`Organizr SSO: utilisateur search inconnu — ${username}`);
    return {
      ok: false,
      status: 403,
      code: 'ORGANIZR_USER_NOT_PROVISIONED',
      error: 'Compte Search-Torrent inexistant. Demandez à un administrateur de créer cet utilisateur.',
    };
  }

  const token = jwt.generateToken(user, { authVia: 'organizr' });
  return { ok: true, user: { ...user, auth_via: 'organizr' }, token };
}

/**
 * Resync session liée à Organizr (cookie absent → logout ; autre user → switch).
 * Session login/MP (auth_via password) → noop.
 * @param {string|undefined} cookieHeader
 * @param {{ username?: string, auth_via?: string }} currentUser - claims JWT
 */
export async function syncOrganizrBoundSession(cookieHeader, currentUser) {
  if (currentUser?.auth_via !== 'organizr') {
    return { ok: true, action: 'noop' };
  }

  const verified = await organizr.verifyOrganizrSession(cookieHeader);

  if (!verified.ok) {
    if (
      verified.code === 'ORGANIZR_UNAVAILABLE' ||
      verified.code === 'ORGANIZR_SSO_DISABLED'
    ) {
      // Ne pas couper Search si Organizr est down / SSO off
      return { ok: true, action: 'noop' };
    }

    return {
      ok: true,
      action: 'logout',
      code: verified.code,
      error: verified.message,
    };
  }

  const orgUser = String(verified.payload.username || '').trim();
  const currentName = String(currentUser.username || '').trim();

  if (orgUser.toLowerCase() === currentName.toLowerCase()) {
    return { ok: true, action: 'same' };
  }

  const user = await usersService.getUserByUsername(orgUser);
  if (!user) {
    logger.warn(`Organizr SSO sync: user search absent — ${orgUser}`);
    return {
      ok: true,
      action: 'logout',
      code: 'ORGANIZR_USER_NOT_PROVISIONED',
      error: 'Compte Search-Torrent inexistant pour l’utilisateur Organizr actuel.',
    };
  }

  const token = jwt.generateToken(user, { authVia: 'organizr' });
  return {
    ok: true,
    action: 'switched',
    user: { ...user, auth_via: 'organizr' },
    token,
  };
}

export default {
  authenticateUser,
  authenticateWithOrganizr,
  syncOrganizrBoundSession,
  jwt,
};
