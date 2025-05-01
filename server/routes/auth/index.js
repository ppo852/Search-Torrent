// Routes pour l'authentification
import express from 'express';
import { loginHandler, verifyTokenHandler } from './handlers.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Authentifie un utilisateur et renvoie un token JWT
 * @access Public
 */
router.post('/login', loginHandler);

/**
 * @route GET /api/auth/verify
 * @desc Vérifie la validité d'un token JWT
 * @access Protected
 */
router.get('/verify', authenticateToken, verifyTokenHandler);

export default router;
