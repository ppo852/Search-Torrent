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

    if (response.status === 200) {
      const contentType = response.headers.get('content-type') || '';
      logger.debug('qbit', `Content-Type: ${contentType}`);
      if (contentType.includes('application/x-bittorrent') || contentType.includes('octet-stream')) {
        return { type: 'torrent_url', value: url };
      }
    }

    return { type: 'url', value: url };
  } catch (err) {
    logger.error(`[qBit] Erreur résolution Prowlarr:`, err.message);
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
    } catch {
      // ignore
    }
  }

  return input;
}

function normalizeQbitUrl(qbitUrl) {
  return String(qbitUrl || '').trim().replace(/\/+$/, '');
}

export function buildQbitAuthHeaders(apiKey, qbitUrl) {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new Error('Clé API qBittorrent non configurée');
  }
  return {
    Authorization: `Bearer ${key}`,
    Referer: normalizeQbitUrl(qbitUrl)
  };
}

/**
 * Obtient les informations qBittorrent de l'utilisateur
 * @param {Object} db - Instance de la base de données (paramètre ignoré)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Informations de connexion qBittorrent de l'utilisateur
 */
export async function getQBitUserInfo(db, userId) {
  try {
    const row = await getDb('SELECT qbit_url, qbit_api_key FROM users WHERE id = ?', [userId]);
    return row || {};
  } catch (error) {
    logger.error('Erreur lors de la récupération des informations qBittorrent:', error);
    throw error;
  }
}

export async function addTorrentUrlForUser(userId, urlOrMagnet, options = {}) {
  const { qbitUrl, headers } = await getAuthenticatedQbitConfig(userId);

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
    if (!magnetFromRedirect && !/([?&])tr=/.test(value)) {
      throw new Error(
        "Lien magnet incomplet: aucun tracker (paramètre tr=) trouvé. Sur les trackers privés, qBittorrent ne pourra pas récupérer les métadonnées."
      );
    }
  }

  const formData = new FormData();
  formData.append('urls', value);

  if (options?.category || options?.mediaType) {
    const resolvedCategory = resolveQbitCategory(options.category, options.mediaType);
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
      ...headers
    }
  });

  logger.debug('qbit', `Réponse qBittorrent: "${qbResponse}"`);

  if (qbResponse === 'Fails.') {
    throw new Error("qBittorrent n'a pas pu ajouter le torrent");
  }

  return qbResponse;
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

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Réponse non-JSON valide
    }
  }

  return text;
}

/**
 * Récupère les informations de transfert globales
 * @param {string} userId - ID de l'utilisateur
 */
export async function getTransferInfo(userId) {
  try {
    const { qbitUrl, headers } = await getAuthenticatedQbitConfig(userId);
    return await makeQBittorrentRequest(`${qbitUrl}/api/v2/transfer/info`, { headers });
  } catch {
    return null;
  }
}

/**
 * Obtient une configuration qBittorrent authentifiée (URL + headers)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{qbitUrl: string, headers: Object}>}
 */
export async function getAuthenticatedQbitConfig(userId) {
  const user = await getQBitUserInfo(null, userId);
  if (!user?.qbit_url) {
    throw new Error('URL qBittorrent non configurée');
  }

  const qbitUrl = normalizeQbitUrl(user.qbit_url);
  const headers = buildQbitAuthHeaders(user.qbit_api_key, qbitUrl);

  return { qbitUrl, headers };
}

export default {
  getQBitUserInfo,
  addTorrentUrlForUser,
  getAuthenticatedQbitConfig,
  makeQBittorrentRequest,
  getTransferInfo
};
