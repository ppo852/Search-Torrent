/**
 * Routes pour les recherches Prowlarr centralisées
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { searchMovieHandler, searchTvEpisodeHandler, searchTvSeriesHandler, searchGeneralHandler } from './handlers.js';

const router = express.Router();

/**
 * @route POST /api/prowlarr/search/movie
 * @desc Recherche un film avec variantes de titre et filtrage
 * @access Private
 */
router.post('/search/movie', authenticateToken, searchMovieHandler);

/**
 * @route POST /api/prowlarr/search/tv/episode
 * @desc Recherche un épisode TV spécifique
 * @access Private
 */
router.post('/search/tv/episode', authenticateToken, searchTvEpisodeHandler);

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
