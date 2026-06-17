import { randomUUID } from 'crypto';
import { run } from '../core/db.js';

/**
 * @param {{
 *   tvSeasonRequestId: string,
 *   userId: string,
 *   tmdbId?: number|null,
 *   mediaType: string,
 *   title: string,
 *   seasonNumber: number,
 *   episodeNumber?: number|null,
 *   action: string,
 *   torrentName?: string|null,
 *   torrentMagnet?: string|null,
 *   torrentSize?: number|null,
 *   torrentSeeds?: number|null,
 *   createdAt?: string
 * }} entry
 */
export async function insertTvSeasonHistory(entry) {
  const createdAt = entry.createdAt ?? new Date().toISOString();
  const episodeNumber = Number.isFinite(Number(entry.episodeNumber))
    ? Number(entry.episodeNumber)
    : (entry.episodeNumber ?? null);

  try {
    await run(
      `INSERT INTO tv_season_request_history (
        id, tv_season_request_id, user_id, tmdb_id, media_type, title, season_number, episode_number,
        action, torrent_name, torrent_magnet, torrent_size, torrent_seeds, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        entry.tvSeasonRequestId,
        entry.userId,
        entry.tmdbId ?? null,
        entry.mediaType,
        entry.title,
        entry.seasonNumber,
        episodeNumber,
        entry.action,
        entry.torrentName ?? null,
        entry.torrentMagnet ?? null,
        typeof entry.torrentSize === 'number' ? entry.torrentSize : null,
        typeof entry.torrentSeeds === 'number' ? entry.torrentSeeds : null,
        createdAt
      ]
    );
  } catch {
    // ignore history errors
  }
}

export function torrentHistoryFields(torrent) {
  return {
    torrentName: torrent?.name ? String(torrent.name) : null,
    torrentMagnet: torrent?.link ? String(torrent.link) : (torrent?.magnet ? String(torrent.magnet) : null),
    torrentSize: typeof torrent?.size === 'number' ? torrent.size : null,
    torrentSeeds: typeof torrent?.seeds === 'number' ? torrent.seeds : null
  };
}

export function torrentDownloadFields(torrent) {
  const fields = torrentHistoryFields(torrent);
  if (fields.torrentSize == null && typeof torrent?.total_size === 'number') {
    fields.torrentSize = torrent.total_size;
  }
  return fields;
}

/**
 * @param {{
 *   requestId: string,
 *   episodeNumber: number,
 *   status?: string,
 *   torrentName?: string|null,
 *   torrentMagnet?: string|null,
 *   torrentSize?: number|null,
 *   torrentSeeds?: number|null,
 *   sentAt?: string
 * }} entry
 */
export async function upsertTvEpisodeDownload(entry) {
  const sentAt = entry.sentAt ?? new Date().toISOString();
  const status = entry.status ?? 'downloading';

  await run(
    `INSERT INTO tv_episode_downloads (
      id, tv_season_request_id, episode_number, status, torrent_name, torrent_magnet, torrent_size, torrent_seeds, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tv_season_request_id, episode_number) DO UPDATE SET
      status = excluded.status,
      torrent_name = excluded.torrent_name,
      torrent_magnet = excluded.torrent_magnet,
      torrent_size = excluded.torrent_size,
      torrent_seeds = excluded.torrent_seeds,
      sent_at = excluded.sent_at,
      completed_at = CASE WHEN excluded.status = 'downloading' THEN NULL ELSE tv_episode_downloads.completed_at END`,
    [
      randomUUID(),
      entry.requestId,
      entry.episodeNumber,
      status,
      entry.torrentName ?? null,
      entry.torrentMagnet ?? null,
      typeof entry.torrentSize === 'number' ? entry.torrentSize : null,
      typeof entry.torrentSeeds === 'number' ? entry.torrentSeeds : null,
      sentAt
    ]
  );
}

export async function markTvEpisodeCompleted({ requestId, episodeNumber, completedAt }) {
  const now = completedAt ?? new Date().toISOString();
  await run(
    `UPDATE tv_episode_downloads SET status = 'completed', completed_at = ? WHERE tv_season_request_id = ? AND episode_number = ?`,
    [now, requestId, episodeNumber]
  );
}

export async function markTvEpisodeError({ requestId, episodeNumber }) {
  await run(
    `UPDATE tv_episode_downloads SET status = 'error', completed_at = NULL WHERE tv_season_request_id = ? AND episode_number = ?`,
    [requestId, episodeNumber]
  );
}
