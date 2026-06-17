import fs from 'fs';
import { getSetting } from '../settings/index.js';

/**
 * Service pour les informations système (Espace disque, etc.)
 */
export async function getDiskSpace() {
  try {
    // 1. On essaie de récupérer les chemins configurés dans les réglages
    const moviePath = await getSetting('media_movies_path');
    const seriesPath = await getSetting('media_series_path');
    const animePath = await getSetting('media_anime_path');
    
    // 2. On définit une liste de chemins à tester par priorité
    const pathsToTry = [
      moviePath,
      seriesPath,
      animePath,
      '/media/adam',
      '/media',
      '/'
    ].filter(p => p && typeof p === 'string');

    // 3. On prend le premier chemin qui existe réellement sur le système
    let pathToCheck = '/';
    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        pathToCheck = p;
        break;
      }
    }

    // statfsSync renvoie les stats du système de fichiers contenant le chemin
    const stats = fs.statfsSync(pathToCheck);
    
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bavail; // bavail est plus précis pour l'espace réellement utilisable
    const used = total - free;
    const percentUsed = Math.round((used / total) * 100);

    return {
      total,
      free,
      used,
      percentUsed,
      label: pathToCheck
    };
  } catch (err) {
    console.error('[System] Erreur lecture espace disque:', err);
    return null;
  }
}

export default {
  getDiskSpace
};
