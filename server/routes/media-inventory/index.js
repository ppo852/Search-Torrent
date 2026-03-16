import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { scanMediaInventoryNowHandler, getMediaInventoryScanStatusHandler, checkMediaPresenceHandler } from './handlers.js';

const router = express.Router();

router.post('/check', authenticateToken, checkMediaPresenceHandler);
router.get('/scan/status', authenticateToken, requireAdmin, getMediaInventoryScanStatusHandler);
router.post('/scan', authenticateToken, requireAdmin, scanMediaInventoryNowHandler);

export default router;
