import { get } from '../core/db.js';
import mediaInventory from '../media-inventory/index.js';
import { cleanMediaTitle, parseTorrentSafe } from '../media-inventory/utils.js';
import { getSeasonEpisodesWithAirDates, getAiredEpisodeNumbers } from '../tmdb/episodes.js';
import logger from '../core/logger.js';

function extractYear(text) {
  const m = String(text || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Vérifie si l'utilisateur peut forcer un téléchargement déjà présent.
 * Même règle partout : uniquement allow_force_interactive_download (case admin).
 *
 * @returns {{ allowed: boolean, status?: number, error?: string }}
 */
export async function canUserForceInteractiveDownload(userId, force) {
  if (!force) return { allowed: true };

  const userRow = await get(
    'SELECT allow_force_interactive_download FROM users WHERE id = ?',
    [userId]
  );

  if (!userRow?.allow_force_interactive_download) {
    return {
      allowed: false,
      status: 403,
      error: 'Forçage non autorisé pour cet utilisateur',
    };
  }

  return { allowed: true };
}

function resolveKind(mediaType, isTvFromName) {
  const t = String(mediaType || '').toLowerCase();
  if (t === 'movie' || t === 'animation') return 'movie';
  if (t === 'tv' || t === 'anime') return 'tv';
  return isTvFromName ? 'tv' : 'movie';
}

/**
 * Pack saison : bloquer seulement si tous les épisodes déjà diffusés (TMDB) sont présents (disque ∪ Emby).
 */
export async function isSeasonFullyPresent({ tmdbId, title, season }) {
  const episodes = await getSeasonEpisodesWithAirDates({
    tmdbId,
    seasonNumber: season,
  });

  const expected = getAiredEpisodeNumbers(episodes);

  if (expected.length === 0) return false;

  const present = await mediaInventory.getSeasonPresence({
    tmdb_id: tmdbId,
    title,
    season,
  });
  const presentSet = new Set(present || []);
  return expected.every((ep) => presentSet.has(ep));
}

/**
 * Vérifie si un téléchargement interactif doit être bloqué (média déjà en médiathèque).
 * - Film + tmdbId : TMDB
 * - Épisode + tmdbId : TMDB + S/E
 * - Pack saison + tmdbId : bloque seulement si saison (épisodes diffusés) complète
 * - Sans tmdbId : fallback nom torrent
 *
 * @returns {{ blocked: boolean, status?: number, error?: string, details?: string, forced?: boolean }}
 */
export async function checkInteractiveInventoryDuplicate({
  torrentName,
  force,
  userId,
  tmdbId,
  mediaType,
  seasonNumber,
  episodeNumber,
}) {
  if (!torrentName && !(Number(tmdbId) > 0)) {
    return { blocked: false };
  }

  try {
    const parsed = torrentName ? await parseTorrentSafe(torrentName) : null;
    const lookupTitle = parsed?.title ? String(parsed.title).trim() : '';
    const fallbackTitle = lookupTitle ? cleanMediaTitle(parsed.title) : '';
    const displayTitle = fallbackTitle || lookupTitle || torrentName || 'Ce média';
    const year = parsed?.year ?? extractYear(lookupTitle) ?? extractYear(torrentName);
    const isTvFromName = !!(
      parsed?.episode ||
      parsed?.season ||
      (torrentName && (/s\d+/i.test(torrentName) || /e\d+/i.test(torrentName) || /season/i.test(torrentName)))
    );
    const kind = resolveKind(mediaType, isTvFromName);
    const id = Number(tmdbId);
    const hasTmdb = Number.isInteger(id) && id > 0;

    let present = false;
    let detailsHint = `Le média "${displayTitle}" semble déjà disponible (disque ou Emby).`;

    // --- Chemin fiable : TMDB de la fiche (pochette) ---
    if (hasTmdb) {
      if (kind === 'movie') {
        const r = await mediaInventory.isPresent({
          kind: 'movie',
          tmdb_id: id,
          title: lookupTitle || displayTitle,
          year,
        });
        present = !!r?.present;
      } else {
        const explicitSeason = Number(seasonNumber);
        const explicitEpisode = Number(episodeNumber);
        const season = Number.isInteger(explicitSeason) && explicitSeason > 0
          ? explicitSeason
          : (parsed?.season ?? null);
        const episode = Number.isInteger(explicitEpisode) && explicitEpisode > 0
          ? explicitEpisode
          : (parsed?.episode ?? null);
        const seasonNum = Number(season);
        const episodeNum = Number(episode);
        const hasEpisodeContext =
          Number.isInteger(seasonNum) &&
          seasonNum > 0 &&
          Number.isInteger(episodeNum) &&
          episodeNum > 0;
        const hasSeasonOnly =
          Number.isInteger(seasonNum) &&
          seasonNum > 0 &&
          !(Number.isInteger(episodeNum) && episodeNum > 0);

        if (hasEpisodeContext) {
          const r = await mediaInventory.isPresent({
            kind: 'tv',
            tmdb_id: id,
            title: lookupTitle || displayTitle,
            season: seasonNum,
            episode: episodeNum,
          });
          present = !!r?.present;
        } else if (hasSeasonOnly) {
          // Pack saison : bloque seulement si saison déjà complète (épisodes diffusés)
          present = await isSeasonFullyPresent({
            tmdbId: id,
            title: lookupTitle || displayTitle,
            season: seasonNum,
          });
          if (present) {
            detailsHint = `La saison ${seasonNum} de "${displayTitle}" est déjà complète en médiathèque (disque ou Emby).`;
          }
        } else {
          // Nom flou sans S/E : ne pas bloquer sur TMDB seul
          present = false;
        }
      }
    }

    // --- Fallback nom (recherche libre sans fiche) ---
    if (!present && lookupTitle) {
      const presenceArgs = {
        year,
        season: parsed?.season,
        episode: parsed?.episode,
        kind,
      };

      let r = await mediaInventory.isPresent({ title: lookupTitle, ...presenceArgs });
      present = !!r?.present;

      if (!present && fallbackTitle && fallbackTitle !== lookupTitle) {
        r = await mediaInventory.isPresent({ title: fallbackTitle, ...presenceArgs });
        present = !!r?.present;
      }

      const isTvButIncomplete =
        kind === 'tv' && parsed?.season == null && parsed?.episode == null;
      if (isTvButIncomplete) {
        present = false;
      }
    }

    if (!present) {
      return { blocked: false };
    }

    if (force) {
      const forceCheck = await canUserForceInteractiveDownload(userId, true);
      if (!forceCheck.allowed) {
        return {
          blocked: true,
          status: forceCheck.status || 403,
          error: forceCheck.error,
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
      details: detailsHint,
    };
  } catch (err) {
    logger.error(`[InventoryCheck] Erreur lors de la vérification de "${torrentName}":`, err);
    return { blocked: false };
  }
}
