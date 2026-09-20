import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  getMovieBrowseHandler,
  getTvBrowseHandler,
  searchTmdbHandler,
  getMovieDetailsHandler,
  getTvDetailsHandler,
  getTvSeasonDetailsHandler,
  testTmdbHandler,
} from './handlers.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/test', requireAdmin, testTmdbHandler);
router.get('/movies/browse', getMovieBrowseHandler);
router.get('/tv/browse', getTvBrowseHandler);
router.get('/search', searchTmdbHandler);
router.get('/movie/:id', getMovieDetailsHandler);
router.get('/tv/:id', getTvDetailsHandler);
router.get('/tv/:id/season/:seasonNumber', getTvSeasonDetailsHandler);

export default router;
