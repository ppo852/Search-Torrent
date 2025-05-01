/**
 * Formate une taille en octets en format lisible (Ko, Mo, Go, etc.)
 * @param bytes - Taille en octets
 * @returns Taille formatée avec unité
 */
export const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Formate une vitesse en octets/seconde en format lisible (Ko/s, Mo/s, etc.)
 * @param speed - Vitesse en octets par seconde
 * @returns Vitesse formatée avec unité
 */
export const formatSpeed = (speed: number) => {
    const sizes = ['o/s', 'Ko/s', 'Mo/s', 'Go/s', 'To/s'];
    if (speed === 0) return '0 o/s';
    const i = Math.floor(Math.log(speed) / Math.log(1024));
    return `${(speed / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Formate un ratio avec une couleur selon sa valeur
 * @param ratio - Ratio à formater
 * @returns Objet contenant le texte formaté et la classe de couleur
 */
export const formatRatioWithColor = (ratio: number): { text: string; color: string } => {
  const value = ratio.toFixed(2);
  if (ratio >= 1.5) return { text: value, color: 'text-green-400' };
  if (ratio >= 1) return { text: value, color: 'text-green-500' };
  if (ratio >= 0.5) return { text: value, color: 'text-yellow-500' };
  return { text: value, color: 'text-red-500' };
};

/**
 * Formate un timestamp Unix en date lisible
 * @param timestamp - Timestamp Unix en secondes
 * @returns Date formatée
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
