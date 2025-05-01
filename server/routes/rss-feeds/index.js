import express from 'express';
import { getAllFeeds, addFeed, deleteFeed, getAllFeedsWithCache } from './handlers.js';

const router = express.Router();

// Ces routes utiliseront le middleware authenticateToken déjà défini dans index.js
// L'authentification sera appliquée au niveau de l'application principale

// Routes pour les flux RSS
router.get('/', getAllFeeds);
router.get('/with-cache', getAllFeedsWithCache);
router.post('/', addFeed);
router.delete('/:id', deleteFeed);

export default router;