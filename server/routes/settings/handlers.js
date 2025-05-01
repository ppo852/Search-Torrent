// Handlers pour les routes des paramètres de l'application
import * as settingsService from '../../services/settings/index.js';

// Définition des paramètres disponibles publiquement
const PUBLIC_SETTINGS = ['prowlarr_url', 'prowlarr_api_key', 'min_seeds', 'tmdb_access_token'];

// Paramètres administrateur uniquement
const ADMIN_ONLY_SETTINGS = [];

// Tous les paramètres
const ALL_SETTINGS = [...PUBLIC_SETTINGS, ...ADMIN_ONLY_SETTINGS];

/**
 * Récupère tous les paramètres de l'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getAllSettingsHandler(req, res) {
  try {
    const settings = await settingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des paramètres' });
  }
}

/**
 * Récupère les paramètres globaux (admin uniquement)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getGlobalSettingsHandler(req, res) {
  try {
    // Récupérer les paramètres nécessaires
    const result = {};
    
    // Récupérer chaque paramètre individuellement
    for (const settingName of ALL_SETTINGS) {
      const value = await settingsService.getSetting(settingName);
      if (value !== null) {
        result[settingName] = value;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres globaux:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des paramètres' });
  }
}

/**
 * Récupère les paramètres publics (accessible à tous les utilisateurs)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getPublicSettingsHandler(req, res) {
  try {
    // Récupérer uniquement les paramètres publics
    const result = {};
    
    // Récupérer chaque paramètre public individuellement
    for (const settingName of PUBLIC_SETTINGS) {
      const value = await settingsService.getSetting(settingName);
      if (value !== null) {
        result[settingName] = value;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres publics:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des paramètres' });
  }
}

/**
 * Récupère un paramètre spécifique
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function getSettingHandler(req, res) {
  const { name } = req.params;
  
  if (!name) {
    return res.status(400).json({ error: 'Le nom du paramètre est requis' });
  }
  
  try {
    const value = await settingsService.getSetting(name);
    
    if (value === null) {
      return res.status(404).json({ error: `Le paramètre '${name}' n'a pas été trouvé` });
    }
    
    res.json({ name, value });
  } catch (error) {
    console.error(`Erreur lors de la récupération du paramètre ${name}:`, error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération du paramètre' });
  }
}

/**
 * Enregistre ou met à jour un paramètre
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function saveSettingHandler(req, res) {
  const { name } = req.params;
  const { value } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Le nom du paramètre est requis' });
  }
  
  if (value === undefined) {
    return res.status(400).json({ error: 'La valeur du paramètre est requise' });
  }
  
  try {
    await settingsService.saveSetting(name, value);
    res.json({ success: true, message: `Paramètre '${name}' enregistré avec succès` });
  } catch (error) {
    console.error(`Erreur lors de l'enregistrement du paramètre ${name}:`, error);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'enregistrement du paramètre' });
  }
}

/**
 * Met à jour les paramètres globaux
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function updateGlobalSettingsHandler(req, res) {
  try {
    const settings = req.body;
    
    // Valider que les paramètres sont bien dans la liste autorisée
    for (const key of Object.keys(settings)) {
      if (!ALL_SETTINGS.includes(key)) {
        return res.status(400).json({ error: `Le paramètre '${key}' n'est pas valide` });
      }
    }
    
    // Mettre à jour chaque paramètre
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        await settingsService.saveSetting(key, value);
      }
    }
    
    res.json({ success: true, message: 'Paramètres mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres globaux:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la mise à jour des paramètres' });
  }
}

/**
 * Supprime un paramètre
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
export async function deleteSettingHandler(req, res) {
  const { name } = req.params;
  
  if (!name) {
    return res.status(400).json({ error: 'Le nom du paramètre est requis' });
  }
  
  try {
    await settingsService.deleteSetting(name);
    res.json({ success: true, message: `Paramètre '${name}' supprimé avec succès` });
  } catch (error) {
    console.error(`Erreur lors de la suppression du paramètre ${name}:`, error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la suppression du paramètre' });
  }
}
