import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  getEmbyStatusHandler,
  listEmbyLibrariesHandler,
  syncEmbyNowHandler,
  testEmbyHandler,
} from './handlers.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/status', getEmbyStatusHandler);
router.get('/libraries', listEmbyLibrariesHandler);
router.post('/test', testEmbyHandler);
router.post('/sync', syncEmbyNowHandler);

export default router;
