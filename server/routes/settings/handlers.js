// Handlers pour les routes des paramètres de l'application
import * as settingsService from '../../services/settings/index.js';
import schedulerService from '../../services/core/scheduler.js';

// Définition des paramètres disponibles publiquement
const PUBLIC_SETTINGS = ['prowlarr_url', 'prowlarr_api_key', 'min_seeds', 'tmdb_access_token'];

// Paramètres administrateur uniquement
const ADMIN_ONLY_SETTINGS = [
  'quality_profiles',
  'quality_profile_assignments',
  'auto_search_interval_minutes',
  'media_movies_path',
  'media_series_path',
  'media_anime_path',
  'media_scan_interval_minutes',
  'media_requests_auto_delete_completed_after_hours'
];

// Tous les paramètres
const ALL_SETTINGS = [...PUBLIC_SETTINGS, ...ADMIN_ONLY_SETTINGS];

export async function getClientSettingsHandler(req, res) {
  try {
    const result = {};

    for (const settingName of PUBLIC_SETTINGS) {
      const value = await settingsService.getSetting(settingName);
      if (value !== null) {
        result[settingName] = value;
      }
    }

    for (const settingName of ['quality_profiles', 'quality_profile_assignments']) {
      const value = await settingsService.getSetting(settingName);
      if (value !== null) {
        result[settingName] = value;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres client:', error);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des paramètres' });
  }
}

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
    // Validation spécifique: profils qualité
    if (Object.prototype.hasOwnProperty.call(settings, 'quality_profiles') || Object.prototype.hasOwnProperty.call(settings, 'quality_profile_assignments')) {
      const currentProfiles = await settingsService.getSetting('quality_profiles');
      const currentAssignments = await settingsService.getSetting('quality_profile_assignments');

      const nextProfiles = Object.prototype.hasOwnProperty.call(settings, 'quality_profiles') ? settings.quality_profiles : currentProfiles;
      const nextAssignments = Object.prototype.hasOwnProperty.call(settings, 'quality_profile_assignments') ? settings.quality_profile_assignments : currentAssignments;

      if (!Array.isArray(nextProfiles)) {
        return res.status(400).json({ error: 'quality_profiles doit être un tableau' });
      }

      if (!nextAssignments || typeof nextAssignments !== 'object') {
        return res.status(400).json({ error: 'quality_profile_assignments est requis' });
      }

      const profileIds = new Set(nextProfiles.map(p => p?.id).filter(Boolean));

      const movieProfileId = nextAssignments.movie_profile_id;
      const tvProfileId = nextAssignments.tv_profile_id;

      if (movieProfileId && !profileIds.has(movieProfileId)) {
        return res.status(400).json({ error: 'Profil assigné aux films introuvable (movie_profile_id)' });
      }

      if (tvProfileId && !profileIds.has(tvProfileId)) {
        return res.status(400).json({ error: 'Profil assigné aux séries/anime introuvable (tv_profile_id)' });
      }

      // Option A: interdire suppression d'un profil assigné
      const currentMovieProfileId = currentAssignments?.movie_profile_id;
      const currentTvProfileId = currentAssignments?.tv_profile_id;

      if (currentMovieProfileId && Object.prototype.hasOwnProperty.call(settings, 'quality_profiles') && !profileIds.has(currentMovieProfileId)) {
        return res.status(400).json({ error: 'Suppression interdite: le profil Film est actuellement assigné' });
      }

      if (currentTvProfileId && Object.prototype.hasOwnProperty.call(settings, 'quality_profiles') && !profileIds.has(currentTvProfileId)) {
        return res.status(400).json({ error: 'Suppression interdite: le profil Série/Anime est actuellement assigné' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'auto_search_interval_minutes')) {
      const v = settings.auto_search_interval_minutes;
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ error: 'auto_search_interval_minutes doit être un nombre > 0' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'media_scan_interval_minutes')) {
      const v = settings.media_scan_interval_minutes;
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ error: 'media_scan_interval_minutes doit être un nombre > 0' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'media_movies_path')) {
      const v = settings.media_movies_path;
      if (typeof v !== 'string') {
        return res.status(400).json({ error: 'media_movies_path doit être une chaîne' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'media_series_path')) {
      const v = settings.media_series_path;
      if (typeof v !== 'string') {
        return res.status(400).json({ error: 'media_series_path doit être une chaîne' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'media_anime_path')) {
      const v = settings.media_anime_path;
      if (typeof v !== 'string') {
        return res.status(400).json({ error: 'media_anime_path doit être une chaîne' });
      }
    }

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        await settingsService.saveSetting(key, value);
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'auto_search_interval_minutes')) {
      try {
        schedulerService.scheduleAutoSearch(0);
      } catch {
        // ignore
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(settings, 'media_scan_interval_minutes') ||
      Object.prototype.hasOwnProperty.call(settings, 'media_movies_path') ||
      Object.prototype.hasOwnProperty.call(settings, 'media_series_path') ||
      Object.prototype.hasOwnProperty.call(settings, 'media_anime_path')
    ) {
      try {
        schedulerService.scheduleMediaInventoryScan(0);
      } catch {
        // ignore
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
