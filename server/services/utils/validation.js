import { flattenKeywords, titleContainsAny } from './keywords.js';

/**
 * Valide un résultat par rapport à un profil de qualité
 * @param {Object} result - Le résultat Prowlarr
 * @param {Object} profile - Le profil de qualité
 * @param {number} multiplier - Multiplicateur de taille (pour les packs de saison)
 * @returns {Object} { is_compatible: boolean, incompatible_reason: string|null }
 */
export function getResultCompatibility(result, profile, multiplier = 1) {
  // Check relevance first (if present from search service)
  if (result.is_relevant === false) {
    return { is_compatible: false, incompatible_reason: 'Non pertinent (Titre ne correspond pas exactement)' };
  }

  if (!profile) return { is_compatible: true, incompatible_reason: null };

  const mult = typeof multiplier === 'number' && multiplier > 0 ? multiplier : 1;
  const minMb = typeof profile.min_size_mb === 'number' ? profile.min_size_mb : 0; // On ne multiplie plus le minimum
  const maxMb = typeof profile.max_size_mb === 'number' ? profile.max_size_mb * mult : 0;

  const minBytes = minMb > 0 ? minMb * 1024 * 1024 : 0;
  const maxBytes = maxMb > 0 ? maxMb * 1024 * 1024 : 0;
  const required = Array.isArray(profile.required_keywords) ? profile.required_keywords : [];
  const blocked = Array.isArray(profile.blocked_keywords) ? profile.blocked_keywords : [];

  const size = result?.size || 0;
  if (minBytes > 0 && size > 0 && size < minBytes) {
    return { is_compatible: false, incompatible_reason: `Taille trop petite (< ${Math.round(minMb)} MB)${mult > 1 ? ' (Pack détecté)' : ''}` };
  }
  if (maxBytes > 0 && size > 0 && size > maxBytes) {
    return { is_compatible: false, incompatible_reason: `Taille trop grande (> ${Math.round(maxMb)} MB)${mult > 1 ? ' (Pack détecté)' : ''}` };
  }
  if (required.length > 0 && !titleContainsAny(result?.name, required)) {
    const flat = flattenKeywords(required);
    return { is_compatible: false, incompatible_reason: `Mots-clés requis absents: ${flat.join(', ')}` };
  }
  if (blocked.length > 0 && titleContainsAny(result?.name, blocked)) {
    const flat = flattenKeywords(blocked);
    return { is_compatible: false, incompatible_reason: `Mots-clés bloqués détectés: ${flat.join(', ')}` };
  }
  return { is_compatible: true, incompatible_reason: null };
}

/**
 * Filtre une liste de résultats selon un profil
 * @param {Array} results - Liste de résultats
 * @param {Object} profile - Le profil de qualité
 * @param {number} multiplier - Multiplicateur de taille
 * @returns {Array} - Liste filtrée
 */
export function applyQualityProfile(results, profile, multiplier = 1) {
  if (!profile) return results || [];
  return (results || []).filter(r => getResultCompatibility(r, profile, multiplier).is_compatible);
}
