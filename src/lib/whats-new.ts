import packageJson from '../../package.json';

/** Version courante de l'app (alignée package.json). */
export const APP_VERSION = packageJson.version as string;

/**
 * Nouveautés visibles par les utilisateurs — langage simple, pas de jargon technique.
 * Ajouter une entrée à chaque release déployée.
 */
export const WHATS_NEW: Record<string, string[]> = {
  '1.6.9': [
    'Nouveau système anti-doublon amélioré grâce à la synchronisation avec Emby — le téléchargement est bloqué si le média est déjà dispo (sauf si un admin t’autorise à forcer).',
    'Gestion des catégories : Animation ajoutée pour différencier des films.',
    'Nouveau système de badges sur les pochettes : voir les demandes déjà faites et les séries déjà sur Emby.',
    'Corrections mineures et améliorations de stabilité.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
};

/** Versions dans l’ordre chronologique (plus ancienne → plus récente). */
const VERSION_ORDER = Object.keys(WHATS_NEW);

export type WhatsNewRelease = {
  version: string;
  items: string[];
};

/**
 * Entrées à afficher depuis la dernière version vue.
 * Si jamais vu : uniquement la version courante (évite un pavé trop long).
 */
export function getWhatsNewSince(lastSeenVersion?: string | null): WhatsNewRelease[] {
  const currentItems = WHATS_NEW[APP_VERSION];
  if (!currentItems?.length) return [];

  if (!lastSeenVersion || lastSeenVersion === APP_VERSION) {
    if (!lastSeenVersion) {
      return [{ version: APP_VERSION, items: currentItems }];
    }
    return [];
  }

  const seenIdx = VERSION_ORDER.indexOf(lastSeenVersion);
  if (seenIdx === -1) {
    return [{ version: APP_VERSION, items: currentItems }];
  }

  return VERSION_ORDER.slice(seenIdx + 1)
    .filter((v) => WHATS_NEW[v]?.length)
    .map((version) => ({ version, items: WHATS_NEW[version] }));
}
