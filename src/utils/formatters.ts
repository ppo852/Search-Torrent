/**
 * Fonctions de formatage partagées (UI).
 */

/**
 * Formate une taille en octets (Ko, Mo, Go, etc.)
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
 * Formate une vitesse en octets/seconde
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
 * Formate une date : ISO/string/Date, ou timestamp Unix (secondes) si number.
 */
export const formatDate = (date: string | Date | number): string => {
  if (date === null || date === undefined || date === '') return 'Date inconnue';

  if (typeof date === 'number') {
    const dateObj = new Date(date * 1000);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) return 'Date inconnue';

  return dateObj.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formate un ratio avec une classe de couleur Tailwind
 */
export const formatRatioWithColor = (ratio: number): { text: string; color: string } => {
  const value = ratio.toFixed(2);
  if (ratio >= 1.5) return { text: value, color: 'text-green-400' };
  if (ratio >= 1) return { text: value, color: 'text-green-500' };
  if (ratio >= 0.5) return { text: value, color: 'text-yellow-500' };
  return { text: value, color: 'text-red-500' };
};

/**
 * Extrait l'année d'une date ISO (YYYY-MM-DD)
 */
export const formatYear = (date: string): string => {
  if (!date) return '';
  const [year] = date.split('-');
  return year;
};
