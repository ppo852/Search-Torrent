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
  '1.7.0': [
    'Recherche plus précise pour les séries et films : moins de confusions entre deux titres identiques (ex. Dark Matter 2024 vs l’ancienne série).',
    'Après une mise à jour, l’interface se charge plus souvent toute seule — moins besoin de vider le cache du navigateur.',
    'Si un film n’est pas encore trouvé sur les indexeurs, plus d’alerte rouge « problème » : le suivi continue et un nouvel essai se fera automatiquement.',
    'Corrections et améliorations de stabilité.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.1': [
    'Téléchargements auto plus sûrs : un mauvais torrent (ex. autre série avec le même numéro d’épisode) est rejeté même si la recherche par ID se trompe.',
    'La fenêtre « Nouveautés » est centrée et mieux adaptée aux téléphones et tablettes.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.2': [
    'Recherche film et animation réparée : les indexeurs ne passent plus en erreur à cause d’un mauvais type de recherche.',
    'Les making-of et documentaires (ex. The Odyssey Making Of) sont mieux reconnus dans les résultats.',
    'Nouveau bouton « Plus de résultats » pour élargir la recherche, avec libellés plus clairs.',
    'Interface mobile améliorée (filtres, bande-annonce / automatiser, barre de tri).',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.3': [
    'Badges et panneau « Bibliothèque & demandes » : moins de confusions entre deux séries au même nom (homonymes).',
    'Correctifs et alignement avec la version de test récente.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.4': [
    'Envoi vers qBittorrent : plus de message « réussi » si qBit n’a pas vraiment confirmé l’ajout.',
    'Meilleurs logs serveur pour diagnostiquer les ajouts en attente.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.5': [
    'Envoi qBittorrent : un ajout « en attente » (téléchargement du lien) est bien traité comme un succès.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.6': [
    'Panneau « Bibliothèque & demandes » : les numéros d’épisodes présents s’affichent mieux, y compris s’il y a des trous (ex. Ép. 161 à 170, 173 à 179).',
    'Les épisodes déjà sur le disque (même sans id Emby) sont à nouveau pris en compte pour ce panneau.',
    'Télécharger et Manuel (demandes) partagent la même règle anti-doublon Emby.',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.7': [
    'Calendrier Organizr (iCal) : génère une clé dans Admin → Intégrations, puis colle l’URL dans le calendrier Homepage.',
    'Affiche les sorties des séries et animes demandés encore en cours (fenêtre récente + à venir).',
    'Si tu détectes un bug, merci de le signaler à un administrateur.',
  ],
  '1.7.8': [
    'Refonte graphique : interface plus claire (cartes, filtres, téléchargements, recherche, fond en léger dégradé).',
    'Connexion automatique via Organizr : si tu es déjà connecté au portail, Search-Torrent t’ouvre la session sans te redemander le mot de passe.',
    'Découvrir : badges Emby / demandes mieux visibles, avec une légende en haut de page.',
    'Parcourir films et séries (TMDB) et flux RSS récents plus pratiques sur l’accueil et la recherche.',
    'Calendrier Organizr (iCal) toujours dispo pour les sorties des séries suivies (depuis Admin → Intégrations).',
    'Corrections et petits réglages de stabilité.',
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
