import { query, run } from '../core/db.js';
import mediaInventoryService from './index.js';
import { getSetting } from '../settings/index.js';

/**
 * Update status of downloading episodes when files are detected in inventory
 */
export async function updateDownloadingEpisodesStatus() {
  try {
    const dbg = ['1', 'true', 'yes'].includes(String(process.env.DEBUG_MEDIA_EP_STATUS || '').toLowerCase());
    if (dbg) {
      console.log('[MediaInventory] Vérification des épisodes en téléchargement...');
    }
    
    const downloadingEpisodes = await query(
      `SELECT d.id, d.tv_season_request_id, d.episode_number, r.title, r.season_number, r.tmdb_id
       FROM tv_episode_downloads d
       JOIN tv_season_requests r ON r.id = d.tv_season_request_id
       WHERE d.status = 'downloading'`
    );

    if (!downloadingEpisodes || downloadingEpisodes.length === 0) {
      if (dbg) {
        console.log('[MediaInventory] Aucun épisode en statut "downloading"');
      }
      return 0;
    }
    
    if (dbg) {
      console.log(`[MediaInventory] ${downloadingEpisodes.length} épisode(s) en téléchargement à vérifier`);
    }

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const ep of downloadingEpisodes) {
      // eslint-disable-next-line no-await-in-loop
      const present = await mediaInventoryService.isPresent({
        kind: 'tv',
        title: ep.title,
        season: ep.season_number,
        episode: ep.episode_number,
        tmdb_id: ep.tmdb_id
      });

      if (dbg) {
        console.log(`[MediaInventory] Check "${ep.title}" S${ep.season_number}E${ep.episode_number} => present=${present?.present}`);
      }

      if (present?.present) {
        // eslint-disable-next-line no-await-in-loop
        await run(
          `UPDATE tv_episode_downloads SET status = 'completed', completed_at = ? WHERE id = ?`,
          [now, ep.id]
        );
        updatedCount++;
      }
    }

    // Also update movie requests status and auto-delete completed ones
    try {
      const movieRequests = await query(
        `SELECT id, user_id, tmdb_id, title, release_date, status, completed_at
         FROM media_requests
         WHERE media_type = 'movie' AND status NOT IN ('completed')`
      );

      let completedMarked = 0;
      for (const mr of movieRequests || []) {
        const year = mr?.release_date ? Number(String(mr.release_date).split('-')[0]) : null;
        // eslint-disable-next-line no-await-in-loop
        const presentMovie = await mediaInventoryService.isPresent({
          kind: 'movie',
          title: mr.title,
          year: Number.isInteger(year) ? year : null,
          tmdb_id: mr.tmdb_id
        });

        if (presentMovie?.present) {
          // eslint-disable-next-line no-await-in-loop
          await run(
            `UPDATE media_requests
             SET status = 'completed', completed_at = COALESCE(completed_at, ?), last_checked_at = ?, last_error = ?
             WHERE id = ?`,
            [now, now, null, mr.id]
          );
          completedMarked++;
        }
      }

      const hoursSetting = await getSetting('media_requests_auto_delete_completed_after_hours');
      const hours = typeof hoursSetting === 'number' && Number.isFinite(hoursSetting) && hoursSetting >= 0 ? hoursSetting : 24;
      if (hours === 0) {
        // immediate cleanup
        await run(`DELETE FROM media_requests WHERE status = 'completed'`);
      } else {
        const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
        const cutoffIso = new Date(cutoffMs).toISOString();
        await run(
          `DELETE FROM media_requests
           WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?`,
          [cutoffIso]
        );
      }

      if (dbg && completedMarked > 0) {
        console.log(`[MediaInventory] ${completedMarked} film(s) passé(s) en 'completed'`);
      }
    } catch {
      // ignore
    }

    if (dbg && updatedCount > 0) {
      console.log(`[MediaInventory] ${updatedCount} épisode(s) passé(s) de 'downloading' à 'completed'`);
    }

    return updatedCount;
  } catch (error) {
    console.error('[MediaInventory] Erreur mise à jour statuts épisodes:', error);
    return 0;
  }
}

export default { updateDownloadingEpisodesStatus };
