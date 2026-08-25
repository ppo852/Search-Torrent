import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  getNowPlayingMoviesHandler,
  getOnTheAirTvHandler,
  getUpcomingTvHandler,
  getNewestMediaHandler,
  searchTmdbHandler,
  getMovieDetailsHandler,
  getTvDetailsHandler,
  getTvSeasonDetailsHandler,
  testTmdbHandler,
} from './handlers.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/test', requireAdmin, testTmdbHandler);
router.get('/movies/now-playing', getNowPlayingMoviesHandler);
router.get('/tv/on-the-air', getOnTheAirTvHandler);
router.get('/tv/upcoming', getUpcomingTvHandler);
router.get('/newest', getNewestMediaHandler);
router.get('/search', searchTmdbHandler);
router.get('/movie/:id', getMovieDetailsHandler);
router.get('/tv/:id', getTvDetailsHandler);
router.get('/tv/:id/season/:seasonNumber', getTvSeasonDetailsHandler);

export default router;
