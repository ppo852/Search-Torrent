// Routes pour l'authentification
import express from 'express';
import {
  loginHandler,
  verifyTokenHandler,
  organizrSsoStatusHandler,
  organizrSsoHandler,
  organizrSsoTestHandler,
  organizrSsoSyncHandler,
} from './handlers.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

router.post('/login', loginHandler);
router.get('/organizr-sso/status', organizrSsoStatusHandler);
router.post('/organizr-sso/test', authenticateToken, requireAdmin, organizrSsoTestHandler);
router.post('/organizr-sso/sync', authenticateToken, organizrSsoSyncHandler);
router.post('/organizr-sso', organizrSsoHandler);
router.get('/verify', authenticateToken, verifyTokenHandler);

export default router;
