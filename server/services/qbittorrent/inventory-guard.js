import { get } from '../core/db.js';
import mediaInventory from '../media-inventory/index.js';
import { cleanMediaTitle, parseTorrentSafe } from '../media-inventory/utils.js';
import logger from '../core/logger.js';

function extractYear(text) {
  const m = String(text || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

async function checkPresence({ lookupTitle, year, season, episode, kind }) {
  return mediaInventory.isPresent({
    title: lookupTitle,
    year,
    season,
    episode,
    kind
  });
}

/**
 * Vérifie si un téléchargement interactif doit être bloqué (média déjà en médiathèque).
 * @returns {{ blocked: boolean, status?: number, error?: string, details?: string, forced?: boolean }}
 */
export async function checkInteractiveInventoryDuplicate({ torrentName, force, userId }) {
  if (!torrentName) {
    return { blocked: false };
  }

  const userRow = await get(
    'SELECT allow_force_interactive_download FROM users WHERE id = ?',
    [userId]
  );
  const canForce = !!userRow?.allow_force_interactive_download;

  try {
    const parsed = await parseTorrentSafe(torrentName);

    if (!parsed?.title) {
      return { blocked: false };
    }

    // Aligné sur le scan : titre PTN complet (ex. "Kraken 2025 FRENCH"), pas cleanMediaTitle seul
    const lookupTitle = String(parsed.title).trim();
    const fallbackTitle = cleanMediaTitle(parsed.title);
    const displayTitle = fallbackTitle || lookupTitle;
    const year = parsed.year ?? extractYear(lookupTitle) ?? extractYear(torrentName);
    const isTv = !!(
      parsed.episode ||
      parsed.season ||
      /s\d+/i.test(torrentName) ||
      /e\d+/i.test(torrentName) ||
      /season/i.test(torrentName)
    );
    const kind = isTv ? 'tv' : 'movie';

    const presenceArgs = {
      year,
      season: parsed.season,
      episode: parsed.episode,
      kind
    };

    let { present } = await checkPresence({ lookupTitle, ...presenceArgs });

    if (!present && fallbackTitle && fallbackTitle !== lookupTitle) {
      ({ present } = await checkPresence({ lookupTitle: fallbackTitle, ...presenceArgs }));
    }

    const isTvButIncomplete = isTv && parsed.season === null && parsed.episode === null;

    if (!present || isTvButIncomplete) {
      return { blocked: false };
    }

    if (force) {
      if (!canForce) {
        return {
          blocked: true,
          status: 403,
          error: 'Forçage non autorisé pour cet utilisateur'
        };
      }
      logger.info(`[Filter] Téléchargement forcé pour "${displayTitle}" (user ${userId})`);
      return { blocked: false, forced: true };
    }

    logger.info(`[Filter] Doublon détecté pour "${displayTitle}" - Téléchargement ignoré.`);
    return {
      blocked: true,
      status: 409,
      error: 'Déjà présent dans la médiathèque',
      details: `Le média "${displayTitle}" semble déjà être disponible localement.`
    };
  } catch (err) {
    logger.error(`[InventoryCheck] Erreur lors de la vérification de "${torrentName}":`, err);
    return { blocked: false };
  }
}
