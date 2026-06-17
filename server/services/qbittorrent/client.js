// Fonctions utilitaires pour communiquer avec l'API qBittorrent
import fetch from 'node-fetch';
import FormData from 'form-data';
import { get as getDb } from '../../services/core/db.js';
import logger from '../core/logger.js';
import { resolveQbitCategory } from '../utils/qbit-categories.js';

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function looksLikeProwlarrDownloadUrl(value) {
  if (!isHttpUrl(value)) return false;
  try {
    const u = new URL(value);
    if (u.searchParams.has('apikey')) return true;
    if (/\/download$/i.test(u.pathname)) return true;
    if (/\/\d+\/download$/i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

async function resolveProwlarrDownloadRedirect(url) {
  // Some indexers/Prowlarr endpoints redirect to magnet: links.
  // We must NOT follow them with node-fetch, since magnet is not an HTTP scheme.
  logger.debug('qbit', `Résolution lien Prowlarr: ${url.substring(0, 80)}...`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      timeout: 15000
    });

    logger.debug('qbit', `Réponse Prowlarr: status=${response.status}`);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || '';
      logger.debug('qbit', `Redirect vers: ${location.substring(0, 80)}...`);
      if (location.startsWith('magnet:?')) {
        return { type: 'magnet', value: location };
      }
      if (isHttpUrl(location)) {
        return { type: 'url', value: location };
      }
      return null;
    }

    // If 200 OK, it might be a .torrent file - try to download and send as file
    if (response.status === 200) {
      const contentType = response.headers.get('content-type') || '';
      logger.debug('qbit', `Content-Type: ${contentType}`);
      if (contentType.includes('application/x-bittorrent') || contentType.includes('octet-stream')) {
        // Return the original URL - qBittorrent should be able to fetch it
        return { type: 'torrent_url', value: url };
      }
    }

    // No redirect: keep the original URL.
    return { type: 'url', value: url };
  } catch (err) {
    logger.error(`[qBit] Erreur résolution Prowlarr:`, err.message);
    // Return original URL as fallback
    return { type: 'url', value: url };
  }
}

function normalizeMagnet(input) {
  if (typeof input !== 'string') return input;
  if (!input.startsWith('magnet:?')) return input;

  const m = input.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
  if (!m) return input;
  const btih = m[1];

  const isHex = /^[0-9a-fA-F]+$/.test(btih);
  if (!isHex) return input;

  if (btih.length === 40) {
    return input.replace(/xt=urn:btih:[a-zA-Z0-9]+/, `xt=urn:btih:${btih.toLowerCase()}`);
  }

  if (btih.length === 80) {
    try {
      const decoded = Buffer.from(btih, 'hex').toString('utf8');
      if (/^[0-9a-fA-F]{40}$/.test(decoded)) {
        return input.replace(/xt=urn:btih:[a-zA-Z0-9]+/, `xt=urn:btih:${decoded.toLowerCase()}`);
      }
    } catch (e) {
      // ignore
    }
  }

  return input;
}

/**
 * Obtient les informations qBittorrent de l'utilisateur
 * @param {Object} db - Instance de la base de données (paramètre ignoré)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Informations de connexion qBittorrent de l'utilisateur
 */
export async function getQBitUserInfo(db, userId) {
  try {
    const row = await getDb('SELECT qbit_url, qbit_username, qbit_password FROM users WHERE id = ?', [userId]);

    return row || {};
  } catch (error) {
    logger.error('Erreur lors de la récupération des informations qBittorrent:', error);
    throw error;
  }
}

export async function addTorrentUrlForUser(userId, urlOrMagnet, options = {}) {
  const user = await getQBitUserInfo(null, userId);
  if (!user?.qbit_url) {
    throw new Error('URL qBittorrent non configurée');
  }

  const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
  const cookies = await authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

  if (typeof urlOrMagnet !== 'string' || !urlOrMagnet) {
    throw new Error('Aucun lien torrent fourni');
  }

  let value = urlOrMagnet;
  let magnetFromRedirect = false;

  if (looksLikeProwlarrDownloadUrl(value)) {
    const resolved = await resolveProwlarrDownloadRedirect(value);
    if (resolved?.type === 'magnet' && typeof resolved.value === 'string') {
      value = resolved.value;
      magnetFromRedirect = true;
    } else if (resolved?.type === 'url' && typeof resolved.value === 'string') {
      value = resolved.value;
    }
  }

  const isMagnet = typeof value === 'string' && value.startsWith('magnet:?');
  if (isMagnet) {
    value = normalizeMagnet(value);
    // Private trackers: require trackers in magnet. Public trackers can redirect to magnet without tr=.
    if (!magnetFromRedirect && !/([?&])tr=/.test(value)) {
      throw new Error(
        "Lien magnet incomplet: aucun tracker (paramètre tr=) trouvé. Sur les trackers privés, qBittorrent ne pourra pas récupérer les métadonnées."
      );
    }
  }

  const formData = new FormData();
  formData.append('urls', value);

  if (options?.category) {
    const resolvedCategory = resolveQbitCategory(options.category);
    if (resolvedCategory) {
      formData.append('category', resolvedCategory);
    }
  }
  if (options?.tags) {
    formData.append('tags', String(options.tags));
  }

  logger.info(`[qBit] Envoi vers qBittorrent: URL="${value.substring(0, 60)}..." | Catégorie="${options?.category || 'aucune'}" | Tags="${options?.tags || 'aucun'}"`);

  const qbResponse = await makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
    method: 'POST',
    body: formData,
    headers: {
      ...formData.getHeaders(),
      'Cookie': cookies,
      'Referer': qbitUrl
    }
  });

  logger.debug('qbit', `Réponse qBittorrent: "${qbResponse}"`);

  if (qbResponse === 'Fails.') {
    throw new Error("qBittorrent n'a pas pu ajouter le torrent");
  }

  return qbResponse;
}

// Cache pour les sessions qBittorrent (userId -> { cookies, timestamp, qbitUrl })
const sessionCache = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Authentifie auprès de qBittorrent avec gestion de cache
 * @param {string} qbitUrl - URL de l'instance qBittorrent
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @param {string} userId - ID de l'utilisateur (pour le cache)
 * @returns {Promise<string>} - Cookie d'authentification
 */
export async function authenticateQBittorrent(qbitUrl, username, password, userId = null) {
  // Si pas d'identifiants, on retourne un cookie vide
  if (!username || !password) {
    return '';
  }

  const now = Date.now();

  // Vérifier le cache si userId est fourni
  if (userId && sessionCache.has(userId)) {
    const cached = sessionCache.get(userId);
    // Vérifier si le cache est encore valide (même URL et TTL non expiré)
    if (cached.qbitUrl === qbitUrl && (now - cached.timestamp) < SESSION_TTL) {
      return cached.cookies;
    }
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

  const cookies = loginResponse.headers.get('set-cookie') || '';

  // Mettre en cache
  if (userId) {
    sessionCache.set(userId, {
      cookies,
      qbitUrl,
      timestamp: now
    });
  }

  return cookies;
}

/**
 * Force la suppression du cache de session pour un utilisateur
 */
export function clearSessionCache(userId) {
  if (userId) sessionCache.delete(userId);
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
/**
 * Récupère les informations de transfert globales
 * @param {string} userId - ID de l'utilisateur
 */
export async function getTransferInfo(userId) {
  const user = await getQBitUserInfo(null, userId);
  if (!user?.qbit_url) return null;

  const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
  const cookies = await authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password, userId);

  return makeQBittorrentRequest(`${qbitUrl}/api/v2/transfer/info`, {
    headers: { 'Cookie': cookies }
  });
}

/**
 * Obtient une configuration qBittorrent authentifiée (URL + Cookies)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{qbitUrl: string, cookies: string}>}
 */
export async function getAuthenticatedQbitConfig(userId) {
  const user = await getQBitUserInfo(null, userId);
  if (!user?.qbit_url) {
    throw new Error('URL qBittorrent non configurée');
  }

  const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
  const cookies = await authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password, userId);

  return { qbitUrl, cookies };
}

export default {
  getQBitUserInfo,
  addTorrentUrlForUser,
  authenticateQBittorrent,
  getAuthenticatedQbitConfig,
  clearSessionCache,
  makeQBittorrentRequest,
  getTransferInfo
};
