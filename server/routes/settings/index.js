// Routes pour la gestion des paramètres de l'application
import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import {
  getAllSettingsHandler,
  getSettingHandler,
  saveSettingHandler,
  deleteSettingHandler,
  getGlobalSettingsHandler,
  getClientSettingsHandler,
  getPublicSettingsHandler,
  updateGlobalSettingsHandler
} from './handlers.js';

const settingsRouter = express.Router();

// Routes spéciales pour les paramètres globaux et publics
settingsRouter.get('/global', authenticateToken, requireAdmin, getGlobalSettingsHandler);
settingsRouter.put('/global', authenticateToken, requireAdmin, updateGlobalSettingsHandler);
settingsRouter.get('/public', authenticateToken, getPublicSettingsHandler);
settingsRouter.get('/client', authenticateToken, getClientSettingsHandler);

// Routes génériques pour tous les paramètres (admin uniquement)
settingsRouter.get('/', authenticateToken, requireAdmin, getAllSettingsHandler);
settingsRouter.get('/:name', authenticateToken, requireAdmin, getSettingHandler);
settingsRouter.put('/:name', authenticateToken, requireAdmin, saveSettingHandler);
settingsRouter.delete('/:name', authenticateToken, requireAdmin, deleteSettingHandler);

export default settingsRouter;
