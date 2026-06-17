<<<<<<< HEAD
import { 
  getQBitUserInfo, 
  authenticateQBittorrent, 
  getAuthenticatedQbitConfig,
  makeQBittorrentRequest, 
  addTorrentUrlForUser, 
  clearSessionCache,
  getTransferInfo
} from './client.js';
=======
// Point d'entrée du service qBittorrent
import { getQBitUserInfo, authenticateQBittorrent, makeQBittorrentRequest, addTorrentUrlForUser } from './client.js';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

// Exporter toutes les fonctions du service
export default {
  getQBitUserInfo,
  authenticateQBittorrent,
  getAuthenticatedQbitConfig,
  makeQBittorrentRequest,
  addTorrentUrlForUser,
<<<<<<< HEAD
  clearSessionCache,
  getTransferInfo
=======
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
};
