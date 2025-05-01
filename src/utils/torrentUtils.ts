import { Torrent } from '../types/qbittorrent';

/**
 * Détermine la couleur du torrent selon son état
 * @param torrent - Objet torrent
 * @returns Classe CSS pour la couleur du torrent
 */
export const getTorrentColor = (torrent: Torrent): string => {
  // Vérification prioritaire pour missingFiles - PRIORITÉ ABSOLUE
  if (torrent.state.includes('missingFiles')) {
    return 'bg-gradient-to-r from-red-800 to-black';
  }
  
  // Convertir en minuscules pour toutes les vérifications
  const state = torrent.state.toLowerCase();
  
  // Priorité 1 - Autres états d'erreur
  if (state.includes('error') || state.includes('missingFiles') || state.includes('unknown')) {
    return 'bg-gradient-to-r from-red-800 to-black';
  }
  
  // Priorité 2 - États de vérification/préparation
  if (state.includes('check') || state === 'moving' || state === 'allocating') {
    return 'bg-gradient-to-r from-purple-600 to-purple-500 progress-bar-pulse';
  }
  
  // Priorité 3 - Téléchargement des métadonnées
  if (state === 'metadl') {
    return 'bg-gradient-to-r from-cyan-600 to-cyan-500 progress-bar-pulse';
  }
  
  // Priorité 4 - États de téléchargement
  if ((state === 'downloading' || state.includes('dl')) && !state.includes('paused') && !state.includes('stopped') && !state.includes('queued')) {
    return 'bg-gradient-to-r from-cyan-400 to-blue-400 progress-bar-pulse progress-bar-stripes';
  }
  
  // Priorité 5 - États de partage
  if (state.includes('up') && !state.includes('paused') && !state.includes('stopped') && !state.includes('queued')) {
    // Distinction visuelle entre partage actif et partage en attente
    if (state === 'uploading' || state === 'forcedup') {
      return 'bg-gradient-to-r from-[#1e81b0] to-[#1a71a0]';
    }
    return 'bg-gradient-to-r from-[#154c79] to-[#0e355a]';
  }
  
  // Priorité 6 - États de pause/arrêt
  if (state.includes('paused') || state.includes('stopped')) {
    // Distinction entre pause de téléchargement et pause de partage
    if (state.includes('dl')) {
      return 'bg-gradient-to-r from-amber-600 to-orange-500';
    }
    return 'bg-gradient-to-r from-orange-600 to-amber-500';
  }
  
  // Priorité 7 - États de file d'attente
  if (state.includes('queued')) {
    return 'bg-gradient-to-r from-gray-700 to-gray-600';
  }
  
  // Priorité 8 - Torrent complet (ne devrait être atteint que si l'état n'a pas été capturé ci-dessus)
  if (torrent.progress === 1) {
    return 'bg-gradient-to-r from-[#154c79] to-[#0e355a]';
  }
  
  // Par défaut - Autres états non reconnus
  return 'bg-gradient-to-r from-gray-800 to-gray-700';
};

/**
 * Vérifie si un torrent est en état d'erreur
 * @param torrent - Objet torrent
 * @returns true si le torrent est en erreur
 */
export const isTorrentError = (torrent: Torrent): boolean => {
  const state = torrent.state.toLowerCase();
  return state.includes('error') || state.includes('missing') || state.includes('unknown');
};

/**
 * Extrait le nom du tracker à partir de son URL
 * @param tracker - URL du tracker
 * @returns Nom du tracker
 */
export const getTrackerName = (tracker: string): string => {
  try {
    const url = new URL(tracker);
    const domain = url.hostname.split('.');
    if (domain.length >= 2) {
      return domain[domain.length - 2];
    }
    return url.hostname;
  } catch {
    return tracker;
  }
};
