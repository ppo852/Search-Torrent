/**
 * Routes pour les recherches Prowlarr centralisées
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  searchMovieHandler,
  searchTvSeriesHandler,
  searchGeneralHandler,
  testProwlarrHandler,
} from './handlers.js';

const router = express.Router();

/**
 * @route POST /api/prowlarr/test
 * @desc Teste la connexion Prowlarr (admin)
 * @access Admin
 */
router.post('/test', authenticateToken, requireAdmin, testProwlarrHandler);

/**
 * @route POST /api/prowlarr/search/movie
 * @desc Recherche un film avec variantes de titre et filtrage
 * @access Private
 */
router.post('/search/movie', authenticateToken, searchMovieHandler);

/**
 * @route POST /api/prowlarr/search/tv
 * @desc Recherche une série TV ou anime
 * @access Private
 */
router.post('/search/tv', authenticateToken, searchTvSeriesHandler);

/**
 * @route POST /api/prowlarr/search
 * @desc Recherche générale (toutes catégories)
 * @access Private
 */
router.post('/search', authenticateToken, searchGeneralHandler);

export default router;
