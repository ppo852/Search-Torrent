/** Message affiché sur un épisode dont le dernier envoi auto a échoué. */
export const EPISODE_RETRY_HINT =
  "Le téléchargement n'a pas abouti. Relance avec Auto ou Manuel.";

/** Libellé court pour compteurs / badges épisode. */
export const EPISODE_FAILED_LABEL = 'Échec';

/** Libellé compteur saison (évite le jargon technique). */
export const SEASON_FAILED_COUNTER_LABEL = 'Échecs';

/**
 * Transforme un message technique serveur en texte lisible pour l'utilisateur.
 */
export function formatRequestErrorMessage(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  if (lower.includes('no_results') || lower.includes('aucun résultat') || lower.includes('aucun torrent compatible')) {
    // Ancien last_error « pas encore dispo » : ne pas afficher comme erreur.
    return null;
  }
  if (lower.includes('no episodes found')) {
    return 'Impossible de lire les épisodes sur TMDB pour cette saison.';
  }
  if (lower.includes('download_missing_in_qbit') || lower.includes('absent de qbit')) {
    return 'Le torrent a disparu de qBittorrent. Tu peux relancer un téléchargement.';
  }
  if (lower.includes('already_in_qbit')) {
    return 'Un torrent est déjà présent dans qBittorrent pour cet épisode.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused')) {
    return 'Connexion impossible (Prowlarr ou qBittorrent). Vérifie la configuration.';
  }
  if (lower.includes('prowlarr')) {
    return 'Erreur lors de la recherche Prowlarr. Réessaie dans quelques minutes.';
  }
  if (lower.includes('qbit')) {
    return 'Erreur lors de l\'envoi vers qBittorrent. Vérifie ton client torrent.';
  }

  if (text.length > 160) {
    return 'La recherche automatique a échoué. Relance un scan ou choisis un torrent en manuel.';
  }

  return text;
}
