import express from 'express';
import { 
  getAllFeeds, 
  addFeed, 
  deleteFeed, 
  getFeedItems, 
  manageCache, 
  getCacheStats,
  parseRssUrl
} from './handlers.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Routes pour les flux RSS (accessibles à tous les utilisateurs authentifiés)
router.get('/', authenticateToken, getAllFeeds);
router.get('/:id/items', authenticateToken, getFeedItems);

// Routes pour les flux RSS (administrateurs uniquement)
router.post('/', authenticateToken, requireAdmin, addFeed);
router.delete('/:id', authenticateToken, requireAdmin, deleteFeed);

// Routes pour la gestion du cache (administrateurs uniquement)
router.post('/cache/manage', authenticateToken, requireAdmin, manageCache);
router.get('/cache/stats', authenticateToken, requireAdmin, getCacheStats);

// Route pour parser un flux RSS à partir d'une URL
router.get('/parse', authenticateToken, parseRssUrl);

export default router;
