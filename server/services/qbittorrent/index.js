import { 
  getQBitUserInfo, 
  authenticateQBittorrent, 
  getAuthenticatedQbitConfig,
  makeQBittorrentRequest, 
  addTorrentUrlForUser, 
  clearSessionCache,
  getTransferInfo
} from './client.js';

// Exporter toutes les fonctions du service
export default {
  getQBitUserInfo,
  authenticateQBittorrent,
  getAuthenticatedQbitConfig,
  makeQBittorrentRequest,
  addTorrentUrlForUser,
  clearSessionCache,
  getTransferInfo
};
