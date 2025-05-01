// Routes pour l'interface qBittorrent
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  getTorrentsHandler,
  deleteTorrentHandler,
  getTorrentDetailsHandler,
  getMainDataHandler,
  getCategoriesHandler,
  addTorrentHandler,
  reannounceHandler,
  recheckHandler,
  pauseHandler,
  resumeHandler,
  createCategoryHandler
} from './handlers.js';

const router = express.Router();

// Middleware d'authentification pour toutes les routes qBittorrent
router.use(authenticateToken);

/**
 * @route GET /api/qbittorrent/torrents
 * @desc Récupère la liste des torrents
 * @access Private
 */
router.get('/torrents', getTorrentsHandler);

/**
 * @route DELETE /api/qbittorrent/delete
 * @desc Supprime un ou plusieurs torrents
 * @access Private
 */
router.delete('/delete', deleteTorrentHandler);

/**
 * @route GET /api/qbittorrent/torrent/:hash
 * @desc Récupère les détails d'un torrent
 * @access Private
 */
router.get('/torrent/:hash', getTorrentDetailsHandler);

/**
 * @route GET /api/qbittorrent/sync/maindata
 * @desc Récupère les informations système
 * @access Private
 */
router.get('/sync/maindata', getMainDataHandler);

/**
 * @route GET /api/qbittorrent/categories
 * @desc Récupère les catégories
 * @access Private
 */
router.get('/categories', getCategoriesHandler);

/**
 * @route POST /api/qbittorrent/add
 * @desc Ajoute un ou plusieurs torrents
 * @access Private
 */
router.post('/add', addTorrentHandler);

/**
 * @route POST /api/qbittorrent/createCategory
 * @desc Crée une nouvelle catégorie
 * @access Private
 */
router.post('/createCategory', createCategoryHandler);

/**
 * @route POST /api/qbittorrent/reannounce
 * @desc Rafraîchit les trackers d'un torrent
 * @access Private
 */
router.post('/reannounce', reannounceHandler);

/**
 * @route POST /api/qbittorrent/recheck
 * @desc Vérifie l'intégrité d'un torrent
 * @access Private
 */
router.post('/recheck', recheckHandler);

/**
 * @route POST /api/qbittorrent/pause
 * @desc Met en pause un torrent
 * @access Private
 */
router.post('/pause', pauseHandler);

/**
 * @route POST /api/qbittorrent/resume
 * @desc Reprend un torrent
 * @access Private
 */
router.post('/resume', resumeHandler);

export default router;
