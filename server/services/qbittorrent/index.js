// Point d'entrée du service qBittorrent
import { getQBitUserInfo, authenticateQBittorrent, makeQBittorrentRequest, addTorrentUrlForUser } from './client.js';

// Exporter toutes les fonctions du service
export default {
  getQBitUserInfo,
  authenticateQBittorrent,
  makeQBittorrentRequest,
  addTorrentUrlForUser,
};
