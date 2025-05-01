/**
 * Fonctions de formatage partagées entre le frontend et le backend
 * Ces fonctions sont utilisées pour formater les données de manière cohérente
 */

/**
 * Formate une taille en octets en format lisible (Ko, Mo, Go, etc.)
 * @param bytes - Taille en octets
 * @returns Taille formatée avec unité
 */
export const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 o';
  
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Formate une vitesse en octets/seconde en format lisible (Ko/s, Mo/s, etc.)
 * @param speed - Vitesse en octets par seconde
 * @returns Vitesse formatée avec unité
 */
export const formatSpeed = (speed: number): string => {
  if (!speed || speed === 0) return '0 o/s';
  
  const units = ['o/s', 'Ko/s', 'Mo/s', 'Go/s', 'To/s'];
  let value = speed;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Formate une date en chaîne lisible
 * @param date - Date à formater
 * @returns Date formatée
 */
export const formatDate = (date: string | Date): string => {
  if (!date) return 'Date inconnue';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Fonction qui retourne le titre original sans aucune modification
 * @param title - Titre original
 * @returns Titre original sans aucune modification
 */
export const formatTitle = (title: string): string => {
  // Retourner le titre original tel quel
  return title;

};

export default {
  formatSize,
  formatSpeed,
  formatDate,
  formatTitle
};
