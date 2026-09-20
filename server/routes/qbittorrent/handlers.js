// Gestionnaires pour les routes qBittorrent
import { URLSearchParams } from 'url';
import FormData from 'form-data';
import qBittorrentService from '../../services/qbittorrent/index.js';
import { resolveQbitCategory } from '../../services/utils/qbit-categories.js';
import logger from '../../services/core/logger.js';
import { checkInteractiveInventoryDuplicate } from '../../services/qbittorrent/inventory-guard.js';
import { logActivity } from '../../services/activity-log/index.js';
import {
  applyStableTrackers,
  applyStableTrackersToMaindata,
  getStableTrackerMap,
} from '../../services/qbittorrent/tracker-display.js';

async function getQbitContextForUserId(_req, userId) {
  try {
    return await qBittorrentService.getAuthenticatedQbitConfig(userId);
  } catch {
    return { qbitUrl: null, headers: {} };
  }
}

async function getQbitContext(req) {
  return getQbitContextForUserId(req, req.user.id);
}

/**
 * Liste torrents avec trackers (includeTrackers), fallback si qBit plus ancienne.
 */
async function fetchTorrentsInfoWithTrackers(qbitUrl, headers) {
  try {
    return await qBittorrentService.makeQBittorrentRequest(
      `${qbitUrl}/api/v2/torrents/info?includeTrackers=true`,
      { headers: { ...headers } }
    );
  } catch {
    return await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/info`, {
      headers: { ...headers },
    });
  }
}

/**
 * Récupère la liste des torrents
 */
export async function getTorrentsHandler(req, res) {
  try {
    const { qbitUrl, headers } = await getQbitContext(req);

    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    // includeTrackers=true : même source que l'UI qBit (liste des announces),
    // pas seulement le champ "tracker" courant qui change souvent à la pause.
    const data = await fetchTorrentsInfoWithTrackers(qbitUrl, headers);

    res.json(applyStableTrackers(Array.isArray(data) ? data : []));
  } catch (error) {
    logger.error('Erreur qBittorrent:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la récupération des torrents' });
  }
}

/**
 * Supprime un ou plusieurs torrents
 */
export async function deleteTorrentHandler(req, res) {
  try {
    const { hashes, deleteFiles } = req.body;
    if (!hashes) {
      return res.status(400).json({ error: 'Hash du torrent requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    // Convertir le tableau de hashes en chaîne séparée par |
    const hashString = Array.isArray(hashes) ? hashes.join('|') : hashes;

    const params = new URLSearchParams({ 
      hashes: hashString,
      deleteFiles: deleteFiles ? 'true' : 'false'
    });

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/delete`, {
      method: 'POST',
      body: params,
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.json({ message: 'Torrent supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Récupère les informations système (sync maindata)
 * Enrichit chaque torrent avec un tracker d'affichage issu de la liste qBit.
 */
export async function getMainDataHandler(req, res) {
  try {
    const { qbitUrl, headers } = await getQbitContext(req);

    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const rid = req.query.rid != null ? String(req.query.rid) : '0';
    const data = await qBittorrentService.makeQBittorrentRequest(
      `${qbitUrl}/api/v2/sync/maindata?rid=${encodeURIComponent(rid)}`,
      { headers: { ...headers } }
    );

    // Trackers stables : refresh includeTrackers au plus toutes les 60 s (pas à chaque poll maindata).
    const cacheKey = String(req.user.id);
    const stableByHash = await getStableTrackerMap(cacheKey, async () =>
      fetchTorrentsInfoWithTrackers(qbitUrl, headers)
    );
    applyStableTrackersToMaindata(data, stableByHash);

    res.json(data);
  } catch (error) {
    // Ne logger que les erreurs non liées à la connexion pour réduire le bruit
    if (error.message && !error.message.includes('ECONNREFUSED')) {
      logger.error('Erreur qBittorrent:', error);
    }
    res.status(500).json({ error: error.message || 'Erreur lors de la récupération des informations système' });
  }
}

/**
 * Récupère les catégories
 */
export async function getCategoriesHandler(req, res) {
  try {
    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const categories = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/categories`, {
      headers: {
        ...headers
      }
    });

    res.json(categories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Ajoute un ou plusieurs torrents
 */
export async function addTorrentHandler(req, res) {
  try {
    // Récupérer les infos utilisateur/qBittorrent
    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const formData = new FormData();
    let hasTorrentData = false;

    const appendToBody = (body, key, value) => {
      if (!value) return;
      if (body && typeof body.append === 'function') {
        body.append(key, value);
      }
    };

    // Gestion du lien magnet / URL (format legacy ou JSON urls[])
    let magnetUrl = req.body.magnet;
    
    // Nouveau format JSON (urls dans un tableau)
    if (!magnetUrl && req.body.urls) {
      if (Array.isArray(req.body.urls) && req.body.urls.length > 0) {
        magnetUrl = req.body.urls[0];
      } else if (typeof req.body.urls === 'string') {
        magnetUrl = req.body.urls;
      }
    }
    
    // Ajout des options supplémentaires - Compatibilité avec l'ancien et le nouveau format
    let category = req.body.category;
    if (!category && req.body.options && req.body.options.category) {
      category = req.body.options.category;
    }

    let tags = req.body.tags;
    if (!tags && req.body.options && req.body.options.tags) {
      tags = req.body.options.tags;
    }

    const torrentName = req.body.name || (req.body.options && req.body.options.name);
    const force = !!(req.body?.force);
    const tmdbId = req.body?.tmdb_id ?? req.body?.tmdbId ?? req.body?.options?.tmdb_id;
    const mediaType =
      req.body?.mediaType ||
      req.body?.media_type ||
      req.body?.options?.mediaType ||
      req.body?.options?.media_type;
    const seasonNumber =
      req.body?.season_number ??
      req.body?.seasonNumber ??
      req.body?.options?.season_number ??
      req.body?.options?.seasonNumber;
    const episodeNumber =
      req.body?.episode_number ??
      req.body?.episodeNumber ??
      req.body?.options?.episode_number ??
      req.body?.options?.episodeNumber;

    if (category || mediaType) {
      category = resolveQbitCategory(category, mediaType) || category;
    }

    const inventoryCheck = await checkInteractiveInventoryDuplicate({
      torrentName,
      force,
      userId: req.user.id,
      tmdbId,
      mediaType,
      seasonNumber,
      episodeNumber,
    });

    if (inventoryCheck.blocked) {
      await logActivity({
        eventType: 'download.blocked_inventory',
        actorUsername: req.user?.username || null,
        targetLabel: torrentName || 'Torrent',
        details: {
          error: inventoryCheck.error,
          details: inventoryCheck.details,
          tmdb_id: tmdbId ?? null,
          media_type: mediaType || null,
          forced: force,
        },
      });
      return res.status(inventoryCheck.status || 409).json({
        success: false,
        error: inventoryCheck.error,
        details: inventoryCheck.details,
        present: inventoryCheck.present === true,
        matches: inventoryCheck.matches || [],
      });
    }

    // Si on a des fichiers, on utilise l'upload (.torrent)
    const hasFiles = !!(req.files && Object.keys(req.files).length > 0);
    if (hasFiles) {
      const torrentsField = req.files.torrents;

      if (Array.isArray(torrentsField)) {
        torrentsField.forEach((file) => {
          formData.append('torrents', file.data, file.name);
        });
        hasTorrentData = true;
      } else if (torrentsField) {
        formData.append('torrents', torrentsField.data, torrentsField.name);
        hasTorrentData = true;
      }

      appendToBody(formData, 'category', category);
      appendToBody(formData, 'tags', tags);
    } else if (magnetUrl) {
      // Sinon, ajout via URL/magnet: utiliser la fonction commune (même logique que l'auto-search)
      const qbResponse = await qBittorrentService.addTorrentUrlForUser(req.user.id, magnetUrl, {
        category,
        tags
      });

      return res.json({ success: true, message: 'Torrents ajoutés avec succès', qbResponse });
    }

    // Vérifier qu'on a au moins un fichier torrent ou un lien magnet
    if (!hasTorrentData) {
      return res.status(400).json({ error: 'Aucun fichier torrent ou lien magnet fourni' });
    }

    const qbResponse = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
      method: 'POST',
      body: formData,
      headers: {
        ...headers
      }
    });

    try {
      qBittorrentService.assertQbitAddSucceeded(qbResponse);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || "qBittorrent n'a pas pu ajouter le torrent",
        qbResponse
      });
    }

    res.json({ success: true, message: 'Torrents ajoutés avec succès', qbResponse });
  } catch (error) {
    logger.error('Erreur complète dans addTorrentHandler:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Rafraîchit les trackers d'un torrent
 */
export async function reannounceHandler(req, res) {
  try {
    const { hashes } = req.body;
    if (!hashes) {
      return res.status(400).json({ error: 'Hash du torrent requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/reannounce`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ hashes })
    });

    res.json({ message: 'Trackers rafraîchis' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Vérifie l'intégrité d'un torrent
 */
export async function recheckHandler(req, res) {
  try {
    const { hashes } = req.body;
    if (!hashes) {
      return res.status(400).json({ error: 'Hash du torrent requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/recheck`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ hashes })
    });

    res.json({ message: 'Vérification lancée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Exporte le fichier .torrent (proxy qBit /torrents/export)
 */
export async function exportTorrentHandler(req, res) {
  try {
    const hash = String(req.query.hash || '').trim();
    if (!hash || hash.includes('|')) {
      return res.status(400).json({ error: 'Un seul hash torrent est requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const response = await fetch(
      `${qbitUrl}/api/v2/torrents/export?hash=${encodeURIComponent(hash)}`,
      { headers }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Fichier .torrent non exportable (souvent un magnet sans .torrent stocké)',
        });
      }
      return res.status(502).json({
        error: `Échec export qBittorrent: ${response.status}${errText ? ` — ${errText}` : ''}`,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const rawName = String(req.query.name || hash)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.torrent$/i, '')
      .trim()
      .slice(0, 120);
    const safeName = rawName || hash;
    const filename = `${safeName}.torrent`;

    res.setHeader('Content-Type', 'application/x-bittorrent');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur export torrent',
    });
  }
}

/**
 * Met en pause un torrent
 */
export async function pauseHandler(req, res) {
  try {
    const { hashes } = req.body;
    if (!hashes) {
      return res.status(400).json({ error: 'Hash du torrent requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    // Formatage du hash pour qBittorrent
    const formattedHashes = Array.isArray(hashes) ? hashes.join('|') : hashes;
    const params = new URLSearchParams();
    params.append('hashes', formattedHashes);

    // Utilisation de 'stopped' au lieu de 'pause' pour la compatibilité avec qBittorrent v5
    const responseText = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/stop`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    res.json({ success: true, message: responseText });
  } catch (error) {
    logger.error('Erreur pause torrent:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la mise en pause du torrent',
      details: error.toString()
    });
  }
}

/**
 * Crée une nouvelle catégorie dans qBittorrent
 */
export async function createCategoryHandler(req, res) {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Nom de catégorie requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const params = new URLSearchParams();
    params.append('category', category);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/createCategory`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur création catégorie:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Reprend un torrent
 */
export async function resumeHandler(req, res) {
  try {
    const { hashes } = req.body;
    if (!hashes) {
      return res.status(400).json({ error: 'Hash du torrent requis' });
    }

    const { qbitUrl, headers } = await getQbitContext(req);
    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    // Formatage du hash pour qBittorrent
    const formattedHashes = Array.isArray(hashes) ? hashes.join('|') : hashes;
    const params = new URLSearchParams();
    params.append('hashes', formattedHashes);

    const responseText = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/start`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    res.json({ success: true, message: responseText });
  } catch (error) {
    logger.error('Erreur reprise torrent:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la reprise du torrent',
      details: error.toString()
    });
  }
}