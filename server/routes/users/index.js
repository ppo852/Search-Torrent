// Routes pour la gestion des utilisateurs
import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  getUsersHandler,
  createUserHandler,
  getUserByIdHandler,
  updateUserHandler,
  deleteUserHandler
} from './handlers.js';

const router = express.Router();

/**
 * @route GET /api/users
 * @desc Récupère la liste de tous les utilisateurs
 * @access Admin
 */
router.get('/', authenticateToken, requireAdmin, getUsersHandler);

/**
 * @route POST /api/users
 * @desc Crée un nouvel utilisateur
 * @access Admin
 */
router.post('/', authenticateToken, requireAdmin, createUserHandler);

/**
 * @route GET /api/users/:id
 * @desc Récupère les détails d'un utilisateur spécifique
 * @access User (pour soi-même) ou Admin
 */
router.get('/:id', authenticateToken, getUserByIdHandler);

/**
 * @route PUT /api/users/:id
 * @desc Met à jour un utilisateur
 * @access User (pour soi-même) ou Admin
 */
router.put('/:id', authenticateToken, updateUserHandler);

/**
 * @route DELETE /api/users/:id
 * @desc Supprime un utilisateur
 * @access Admin
 */
router.delete('/:id', authenticateToken, requireAdmin, deleteUserHandler);

export default router;
