// Gestionnaires pour les routes qBittorrent
import { URLSearchParams } from 'url';
import FormData from 'form-data';
import qBittorrentService from '../../services/qbittorrent/index.js';
import { resolveQbitCategory } from '../../services/utils/qbit-categories.js';
import logger from '../../services/core/logger.js';
import { checkInteractiveInventoryDuplicate } from '../../services/qbittorrent/inventory-guard.js';

async function getQbitContextForUserId(req, userId) {
  const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, userId);
  if (!user?.qbit_url) {
    return { user, qbitUrl: null, cookies: '' };
  }

  const qbitUrl = user.qbit_url.trim().replace(/\/+$/, '');
  let cookies = '';

  if (user.qbit_username && user.qbit_password) {
    cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password, userId);
  }

  return { user, qbitUrl, cookies };
}

async function getQbitContext(req) {
  return getQbitContextForUserId(req, req.user.id);
}

/**
 * Récupère la liste des torrents
 */
export async function getTorrentsHandler(req, res) {
  try {
    // console.log('Récupération des informations qBittorrent pour l\'utilisateur:', req.user.id);
    // console.log('Type de req.user.id:', typeof req.user.id);
    // console.log('Instance de DB utilisée:', req.app.locals.db ? 'DB définie' : 'DB non définie');
    
    const { user, qbitUrl, cookies } = await getQbitContext(req);

    if (!user?.qbit_url || !qbitUrl) {
      // console.log('URL qBittorrent non configurée pour l\'utilisateur');
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    // console.log('Envoi requête vers:', `${qbitUrl}/api/v2/torrents/info`);
    const data = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/info`, {
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });
    
    res.json(data);
  } catch (error) {
    console.error('Erreur qBittorrent:', error);
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

    const { user, qbitUrl, cookies } = await getQbitContext(req);
    if (!user?.qbit_url || !qbitUrl) {
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
        'Cookie': cookies,
        'Referer': qbitUrl,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.json({ message: 'Torrent supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Récupère les détails d'un torrent
 */
export async function getTorrentDetailsHandler(req, res) {
  try {
    const { hash } = req.params;
    const { user, qbitUrl, cookies } = await getQbitContext(req);
    if (!user?.qbit_url || !qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const data = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/properties?hash=${hash}`, {
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Récupère les informations système
 */
export async function getMainDataHandler(req, res) {
  try {
    const { user, qbitUrl, cookies } = await getQbitContext(req);

    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    if (!qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const data = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/sync/maindata`, {
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    res.json(data);
  } catch (error) {
    // Ne logger que les erreurs non liées à la connexion pour réduire le bruit
    if (error.message && !error.message.includes('ECONNREFUSED')) {
      console.error('Erreur qBittorrent:', error);
    }
    res.status(500).json({ error: error.message || 'Erreur lors de la récupération des informations système' });
  }
}

/**
 * Récupère les catégories
 */
export async function getCategoriesHandler(req, res) {
  try {
    const { user, qbitUrl, cookies } = await getQbitContext(req);
    if (!user?.qbit_url || !qbitUrl) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const categories = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/categories`, {
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Ajoute un ou plusieurs torrents
 */
export async function addTorrentHandler(req, res) {
  try {
    // Récupérer les infos utilisateur/qBittorrent
    const { user, qbitUrl, cookies } = await getQbitContext(req);
    if (!user?.qbit_url || !qbitUrl) {
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

    if (category) {
      category = resolveQbitCategory(category) || category;
    }

    const inventoryCheck = await checkInteractiveInventoryDuplicate({
      torrentName,
      force,
      userId: req.user.id
    });

    if (inventoryCheck.blocked) {
      return res.status(inventoryCheck.status || 409).json({
        success: false,
        error: inventoryCheck.error,
        details: inventoryCheck.details
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

      // Vérification que la session est toujours valide
      await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/app/version`, {
        headers: {
          'Cookie': cookies,
          'Referer': qbitUrl
        }
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
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    if (qbResponse === 'Fails.') {
      return res.status(400).json({
        success: false,
        error: "qBittorrent n'a pas pu ajouter le torrent",
        qbResponse
      });
    }

    // Vérification que la session est toujours valide
    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/app/version`, {
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
      }
    });

    res.json({ success: true, message: 'Torrents ajoutés avec succès', qbResponse });
  } catch (error) {
    console.error('Erreur complète dans addTorrentHandler:', error);
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/reannounce`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': qbitUrl
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/recheck`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': qbitUrl
      },
      body: new URLSearchParams({ hashes })
    });

    res.json({ message: 'Vérification lancée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    // Formatage du hash pour qBittorrent
    const formattedHashes = Array.isArray(hashes) ? hashes.join('|') : hashes;
    const params = new URLSearchParams();
    params.append('hashes', formattedHashes);

    // Utilisation de 'stopped' au lieu de 'pause' pour la compatibilité avec qBittorrent v5
    const responseText = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/stop`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': qbitUrl
      },
      body: params
    });

    res.json({ success: true, message: responseText });
  } catch (error) {
    console.error('Erreur pause torrent:', error);
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    const params = new URLSearchParams();
    params.append('category', category);

    await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/createCategory`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': qbitUrl
      },
      body: params
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur création catégorie:', error);
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    // Formatage du hash pour qBittorrent
    const formattedHashes = Array.isArray(hashes) ? hashes.join('|') : hashes;
    const params = new URLSearchParams();
    params.append('hashes', formattedHashes);

    const responseText = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/start`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': qbitUrl
      },
      body: params
    });

    res.json({ success: true, message: responseText });
  } catch (error) {
    console.error('Erreur reprise torrent:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la reprise du torrent',
      details: error.toString()
    });
  }
}