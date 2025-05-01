// Gestionnaires pour les routes qBittorrent
import { URLSearchParams } from 'url';
import FormData from 'form-data';
import qBittorrentService from '../../services/qbittorrent/index.js';

/**
 * Récupère la liste des torrents
 */
export async function getTorrentsHandler(req, res) {
  try {
    // console.log('Récupération des informations qBittorrent pour l\'utilisateur:', req.user.id);
    // console.log('Type de req.user.id:', typeof req.user.id);
    // console.log('Instance de DB utilisée:', req.app.locals.db ? 'DB définie' : 'DB non définie');
    
    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    // console.log('Informations qBittorrent récupérées:', JSON.stringify(user));
    // console.log('Type de user:', typeof user);
    // console.log('Propriétés de user:', Object.keys(user));
    // console.log('qbit_url présent?', user?.qbit_url ? 'Oui' : 'Non');
    // console.log('qbit_username présent?', user?.qbit_username ? 'Oui' : 'Non');
    // console.log('qbit_password présent?', user?.qbit_password ? 'Oui (valeur non affichée)' : 'Non');

    if (!user?.qbit_url) {
      // console.log('URL qBittorrent non configurée pour l\'utilisateur');
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    // console.log('URL qBittorrent formatée:', qbitUrl);
    let cookies = '';

    if (user.qbit_username && user.qbit_password) {
      // console.log('Tentative d\'authentification qBittorrent...');
      cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);
      // console.log('Authentification réussie:', cookies ? 'Cookie obtenu' : 'Pas de cookie');
    } else {
      // console.log('Authentification ignorée: identifiants manquants');
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

    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

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
    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

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
    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);

    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    let cookies = '';

    if (user.qbit_username && user.qbit_password) {
      cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);
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
    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }

    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

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
  // LOGS DEBUG : afficher le contenu reçu
  console.log('===== [addTorrentHandler] =====');
  console.log('req.files:', req.files);
  console.log('req.body:', req.body);

  try {
    // Log avant appel qBittorrent
    console.log('Préparation envoi à qBittorrent...');

    // Récupérer les infos utilisateur/qBittorrent
    const user = await qBittorrentService.getQBitUserInfo(req.app.locals.db, req.user.id);
    if (!user?.qbit_url) {
      return res.status(400).json({ error: 'URL qBittorrent non configurée' });
    }
    const qbitUrl = user.qbit_url.replace(/\/+$/, '');
    const cookies = await qBittorrentService.authenticateQBittorrent(qbitUrl, user.qbit_username, user.qbit_password);

    const formData = new FormData();
    let hasTorrentData = false;

    // Gestion des fichiers torrent
    if (req.files && Object.keys(req.files).length > 0) {
      // Vérifier si nous avons un fichier unique ou un tableau de fichiers
      const torrentsField = req.files.torrents;
      
      if (Array.isArray(torrentsField)) {
        // Plusieurs fichiers
        console.log(`Traitement de ${torrentsField.length} fichiers torrents`);
        torrentsField.forEach((file, index) => {
          formData.append('torrents', file.data, file.name);
          console.log(`Ajout du fichier ${index + 1}/${torrentsField.length}: ${file.name}`);
        });
        hasTorrentData = true;
      } else if (torrentsField) {
        // Un seul fichier
        formData.append('torrents', torrentsField.data, torrentsField.name);
        console.log(`Ajout d'un fichier torrent: ${torrentsField.name}`);
        hasTorrentData = true;
      }
    }

    // Gestion du lien magnet - Compatibilité avec l'ancien et le nouveau format
    let magnetUrl = req.body.magnet;
    
    // Nouveau format JSON (urls dans un tableau)
    if (!magnetUrl && req.body.urls) {
      if (Array.isArray(req.body.urls) && req.body.urls.length > 0) {
        magnetUrl = req.body.urls[0];
      } else if (typeof req.body.urls === 'string') {
        magnetUrl = req.body.urls;
      }
    }
    
    if (magnetUrl) {
      formData.append('urls', magnetUrl);
      console.log('Ajout d\'un lien magnet:', magnetUrl);
      hasTorrentData = true;
    }

    // Vérifier qu'on a au moins un fichier torrent ou un lien magnet
    if (!hasTorrentData) {
      return res.status(400).json({ error: 'Aucun fichier torrent ou lien magnet fourni' });
    }

    // Ajout des options supplémentaires - Compatibilité avec l'ancien et le nouveau format
    let category = req.body.category;
    
    // Nouveau format JSON (options.category)
    if (!category && req.body.options && req.body.options.category) {
      category = req.body.options.category;
    }
    
    if (category) {
      formData.append('category', category);
      console.log(`Ajout de la catégorie: ${category}`);
    }
    
    // Gestion des tags - Compatibilité avec l'ancien et le nouveau format
    let tags = req.body.tags;
    
    // Nouveau format JSON (options.tags)
    if (!tags && req.body.options && req.body.options.tags) {
      tags = req.body.options.tags;
    }
    
    if (tags) {
      formData.append('tags', tags);
      console.log(`Ajout des tags: ${tags}`);
    }

    console.log('Envoi de la requête à qBittorrent...');
    const qbResponse = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/add`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': cookies,
        'Referer': qbitUrl
        // NE PAS ajouter 'Content-Type' ici, FormData le gère automatiquement
      }
    });
    console.log('[addTorrentHandler] Réponse API qBittorrent /api/v2/torrents/add:', qbResponse);

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

    const responseText = await qBittorrentService.makeQBittorrentRequest(`${qbitUrl}/api/v2/torrents/resume`, {
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