import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  getNowPlayingMoviesHandler,
  getOnTheAirTvHandler,
  getUpcomingTvHandler,
  getNewestMediaHandler
} from './handlers.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/movies/now-playing', getNowPlayingMoviesHandler);
router.get('/tv/on-the-air', getOnTheAirTvHandler);
router.get('/tv/upcoming', getUpcomingTvHandler);
router.get('/newest', getNewestMediaHandler);

export default router;
