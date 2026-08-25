import { getSetting } from '../settings/index.js';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** Racine API Emby : ajoute /emby si l’URL ne le contient pas déjà. */
function buildEmbyApiRoot(url) {
  const base = normalizeBaseUrl(url);
  if (!base) return '';
  if (/\/emby$/i.test(base)) return base;
  return `${base}/emby`;
}

export async function getEmbyCredentials(overrides = {}) {
  const url = normalizeBaseUrl(
    overrides.url !== undefined ? overrides.url : await getSetting('emby_url')
  );
  const apiKey = String(
    overrides.apiKey !== undefined ? overrides.apiKey : (await getSetting('emby_api_key')) || ''
  ).trim();

  return { url, apiKey, apiRoot: buildEmbyApiRoot(url) };
}

export function isEmbyConfigured(url, apiKey) {
  return Boolean(url && apiKey);
}

/**
 * Appel HTTP Emby générique.
 * @param {string} path - chemin relatif (ex: /System/Info)
 * @param {{ url?: string, apiKey?: string, method?: string, body?: any }} options
 */
export async function embyFetch(path, options = {}) {
  const { url, apiKey, apiRoot } = await getEmbyCredentials(options);
  if (!isEmbyConfigured(url, apiKey)) {
    const err = new Error('Emby non configuré (URL et clé API requis)');
    err.status = 400;
    throw err;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const endpoint = `${apiRoot}${cleanPath}`;

  const headers = {
    Accept: 'application/json',
    'X-Emby-Token': apiKey,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const response = await fetch(endpoint, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(
        text || `Emby a répondu ${response.status}`
      );
      err.status = response.status;
      throw err;
    }

    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Délai dépassé lors de la connexion à Emby');
      err.status = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testConnection(overrides = {}) {
  const info = await embyFetch('/System/Info', overrides);
  return {
    success: true,
    serverName: info?.ServerName || info?.serverName || null,
    version: info?.Version || info?.version || null,
    id: info?.Id || info?.id || null,
  };
}

/**
 * Liste les bibliothèques Emby (VirtualFolders).
 * @returns {Promise<Array<{ id: string, name: string, collectionType: string|null, locations: string[] }>>}
 */
export async function listLibraries(overrides = {}) {
  const folders = await embyFetch('/Library/VirtualFolders', overrides);
  const list = Array.isArray(folders) ? folders : (folders?.Items || []);

  return list
    .map((folder) => {
      const id = String(folder?.ItemId || folder?.Id || folder?.Guid || '').trim();
      if (!id) return null;
      return {
        id,
        name: String(folder?.Name || 'Sans nom'),
        collectionType: folder?.CollectionType ? String(folder.CollectionType) : null,
        locations: Array.isArray(folder?.Locations) ? folder.Locations.map(String) : [],
      };
    })
    .filter(Boolean);
}
