// Fonctions utilitaires pour communiquer avec l'API qBittorrent
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { get as getDb } from '../../services/core/db.js';

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
  console.log(`[qBit] Résolution lien Prowlarr: ${url.substring(0, 80)}...`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      timeout: 15000
    });

    console.log(`[qBit] Réponse Prowlarr: status=${response.status}`);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || '';
      console.log(`[qBit] Redirect vers: ${location.substring(0, 80)}...`);
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
      console.log(`[qBit] Content-Type: ${contentType}`);
      if (contentType.includes('application/x-bittorrent') || contentType.includes('octet-stream')) {
        // Return the original URL - qBittorrent should be able to fetch it
        return { type: 'torrent_url', value: url };
      }
    }

    // No redirect: keep the original URL.
    return { type: 'url', value: url };
  } catch (err) {
    console.error(`[qBit] Erreur résolution Prowlarr:`, err.message);
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
    console.error('Erreur lors de la récupération des informations qBittorrent:', error);
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

  const params = new URLSearchParams();
  params.append('urls', value);

  if (options?.category) {
    params.append('category', String(options.category));
  }
  if (options?.tags) {
    params.append('tags', String(options.tags));
  }

  console.log(`[qBit] Envoi à qBittorrent: ${value.substring(0, 80)}... cat=${options?.category || 'none'}`);

  const qbResponse = await makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
    method: 'POST',
    body: params,
    headers: {
      'Cookie': cookies,
      'Referer': qbitUrl,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  console.log(`[qBit] Réponse qBittorrent: "${qbResponse}"`);

  if (qbResponse === 'Fails.') {
    throw new Error("qBittorrent n'a pas pu ajouter le torrent");
  }

  return qbResponse;
}

/**
 * Authentifie auprès de qBittorrent
 * @param {string} qbitUrl - URL de l'instance qBittorrent
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Promise<string>} - Cookie d'authentification
 */
export async function authenticateQBittorrent(qbitUrl, username, password) {
  // Si pas d'identifiants, on retourne un cookie vide
  if (!username || !password) {
    return '';
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

  return loginResponse.headers.get('set-cookie') || '';
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
