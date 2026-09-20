// SSO via API Server Auth Organizr (/api/v2/auth/{group})
// Config UNIQUEMENT via Admin → Intégrations (base de données).
import logger from '../core/logger.js';
import { getSetting } from '../settings/index.js';

function isTruthy(value) {
  if (value === true || value === 1) return true;
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

/** Accepte uniquement http(s) pour limiter le SSRF trivial. */
export function isAllowedOrganizrUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Ne forward que les cookies organizr_token_* (évite de fuiter d’autres cookies).
 * @param {string|undefined} cookieHeader
 * @returns {string}
 */
export function filterOrganizrTokenCookies(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => /^organizr_token_[^=]+=/i.test(part))
    .join('; ');
}

/**
 * Config Organizr lue uniquement depuis les paramètres UI (app_settings).
 */
export async function getOrganizrSettings() {
  const dbEnabled = await getSetting('organizr_sso_enabled');
  const dbUrl = await getSetting('organizr_url');
  const dbAuthGroup = await getSetting('organizr_auth_group');

  const urlRaw = String(dbUrl ?? '').trim().replace(/\/$/, '');
  const url = isAllowedOrganizrUrl(urlRaw) ? urlRaw : '';
  const authGroup = String(dbAuthGroup ?? '998').trim() || '998';
  const enabled = isTruthy(dbEnabled);

  return { enabled, url, authGroup };
}

/** URL Server Auth Organizr (test + SSO). */
export function buildOrganizrAuthUrl(baseUrl, authGroup) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  const group = String(authGroup || '998').trim() || '998';
  return `${base}/api/v2/auth/${encodeURIComponent(group)}`;
}

/**
 * @returns {Promise<{ enabled: boolean, authGroup: string }>}
 */
export async function getOrganizrSsoStatus() {
  const { enabled, url, authGroup } = await getOrganizrSettings();
  return {
    enabled: !!(enabled && url),
    authGroup,
  };
}

/**
 * Extrait username depuis une réponse API Organizr (formats connus).
 * @param {any} body
 * @returns {string}
 */
export function extractOrganizrUsername(body) {
  const data = body?.response?.data ?? body?.data ?? body;
  if (!data || typeof data !== 'object') return '';
  const raw = data.user ?? data.username ?? data.User ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Test de joignabilité de l'API Organizr (sans session utilisateur).
 */
export async function testOrganizrApiConnection() {
  const { url, authGroup } = await getOrganizrSettings();
  if (!url) {
    return { ok: false, error: 'URL Organizr non configurée ou invalide' };
  }

  const endpoint = buildOrganizrAuthUrl(url, authGroup);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
    });

    if (res.status === 401 || res.status === 403 || res.status === 200) {
      return {
        ok: true,
        httpStatus: res.status,
        message: 'API Organizr joignable',
      };
    }

    return { ok: false, error: `Réponse HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Organizr inaccessible' };
  }
}

/**
 * Vérifie la session Organizr via l'API Server Auth (cookie forwardé filtré).
 * @param {string|undefined} cookieHeader
 */
export async function verifyOrganizrSession(cookieHeader) {
  const { enabled, url, authGroup } = await getOrganizrSettings();

  if (!enabled || !url) {
    return {
      ok: false,
      code: 'ORGANIZR_SSO_DISABLED',
      message: 'SSO Organizr désactivé',
    };
  }

  const organizrCookie = filterOrganizrTokenCookies(cookieHeader);
  if (!organizrCookie) {
    return {
      ok: false,
      code: 'ORGANIZR_COOKIE_MISSING',
      message: 'Cookie Organizr absent — connectez-vous d’abord à Organizr',
    };
  }

  const endpoint = buildOrganizrAuthUrl(url, authGroup);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: organizrCookie,
      },
      redirect: 'manual',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: 'ORGANIZR_UNAUTHORIZED',
        message: 'Session Organizr invalide ou expirée',
      };
    }

    if (!res.ok) {
      logger.warn(`Organizr SSO: API HTTP ${res.status} sur ${endpoint}`);
      return {
        ok: false,
        code: 'ORGANIZR_UNAVAILABLE',
        message: 'Organizr inaccessible pour le SSO',
      };
    }

    const body = await res.json().catch(() => null);
    const resultFlag = body?.response?.result ?? body?.result;
    if (resultFlag && String(resultFlag).toLowerCase() !== 'success') {
      return {
        ok: false,
        code: 'ORGANIZR_UNAUTHORIZED',
        message: 'Session Organizr invalide ou expirée',
      };
    }

    const username = extractOrganizrUsername(body);
    if (!username) {
      logger.warn('Organizr SSO: réponse API sans username');
      return {
        ok: false,
        code: 'ORGANIZR_TOKEN_INVALID',
        message: 'Réponse Organizr sans nom d’utilisateur',
      };
    }

    return {
      ok: true,
      payload: { username },
    };
  } catch (err) {
    logger.warn(`Organizr SSO: erreur réseau — ${err.message}`);
    return {
      ok: false,
      code: 'ORGANIZR_UNAVAILABLE',
      message: 'Organizr inaccessible pour le SSO',
    };
  }
}

export default {
  getOrganizrSettings,
  getOrganizrSsoStatus,
  buildOrganizrAuthUrl,
  filterOrganizrTokenCookies,
  isAllowedOrganizrUrl,
  extractOrganizrUsername,
  testOrganizrApiConnection,
  verifyOrganizrSession,
};
