import { get, run, query } from '../core/db.js';
import logger from '../core/logger.js';

/**
 * Récupère tous les paramètres de l'application
 * @returns {Promise<Object>} Objet contenant tous les paramètres (clé/valeur)
 */
export async function getAllSettings() {
  try {
    const rows = await query('SELECT name, value FROM app_settings');
    
    // Convertir les résultats en un objet clé/valeur
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.name] = JSON.parse(row.value);
      } catch (e) {
        // Si la valeur n'est pas un JSON valide, utiliser la valeur brute
        settings[row.name] = row.value;
      }
    });
    return settings;
  } catch (error) {
    logger.error('Erreur lors de la récupération des paramètres:', error);
    throw error;
  }
}

/**
 * Récupère un paramètre spécifique
 * @param {string} name - Nom du paramètre à récupérer
 * @returns {Promise<any>} Valeur du paramètre
 */
export async function getSetting(name) {
  try {
    const row = await get('SELECT value FROM app_settings WHERE name = ?', [name]);
    
    if (!row) {
      return null; // Paramètre non trouvé
    }
    
    try {
      // Essayer de parser la valeur comme JSON
      return JSON.parse(row.value);
    } catch (e) {
      // Si ce n'est pas un JSON valide, retourner la valeur brute
      return row.value;
    }
  } catch (error) {
    logger.error(`Erreur lors de la récupération du paramètre ${name}:`, error);
    throw error;
  }
}

/**
 * Enregistre ou met à jour un paramètre
 * @param {string} name - Nom du paramètre
 * @param {any} value - Valeur du paramètre (sera convertie en JSON)
 * @returns {Promise<void>}
 */
export async function saveSetting(name, value) {
  try {
    const now = new Date().toISOString();
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // Vérifier si le paramètre existe déjà
    const existingParam = await get('SELECT name FROM app_settings WHERE name = ?', [name]);
    
    if (existingParam) {
      // Mettre à jour le paramètre existant
      await run(
        'UPDATE app_settings SET value = ?, updated_at = ? WHERE name = ?',
        [stringValue, now, name]
      );
    } else {
      // Créer un nouveau paramètre
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      await run(
        'INSERT INTO app_settings (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, stringValue, now, now]
      );
    }
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement du paramètre ${name}:`, error);
    throw error;
  }
}

/**
 * Supprime un paramètre
 * @param {string} name - Nom du paramètre à supprimer
 * @returns {Promise<void>}
 */
export async function deleteSetting(name) {
  try {
    await run('DELETE FROM app_settings WHERE name = ?', [name]);
  } catch (error) {
    logger.error(`Erreur lors de la suppression du paramètre ${name}:`, error);
    throw error;
  }
}
