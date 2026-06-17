import express from 'express';
import { 
  getAllFeeds, 
  addFeed, 
  deleteFeed, 
  getFeedItems,
  getAllRssItems,
  manageCache, 
  getCacheStats,
  parseRssUrl,
  getRecentHome
} from './handlers.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Routes pour les flux RSS (accessibles à tous les utilisateurs authentifiés)
router.get('/', authenticateToken, getAllFeeds);
router.get('/recent-home', authenticateToken, getRecentHome);
router.get('/all-items', authenticateToken, getAllRssItems);
router.get('/parse', authenticateToken, parseRssUrl);
router.get('/:id/items', authenticateToken, getFeedItems);

// Routes pour les flux RSS (administrateurs uniquement)
router.post('/', authenticateToken, requireAdmin, addFeed);
router.delete('/:id', authenticateToken, requireAdmin, deleteFeed);

// Routes pour la gestion du cache (administrateurs uniquement)
router.post('/cache/manage', authenticateToken, requireAdmin, manageCache);
router.get('/cache/stats', authenticateToken, requireAdmin, getCacheStats);

export default router;
