import { run } from '../core/db.js';

/**
 * @param {number} hours — 0 = suppression immédiate
 */
export async function purgeCompletedRequests(hours) {
  if (hours === 0) {
    await run(
      `DELETE FROM tv_season_request_history
       WHERE tv_season_request_id IN (SELECT id FROM tv_season_requests WHERE status = 'completed')`
    );
    await run(`DELETE FROM media_requests WHERE status = 'completed'`);
    await run(`DELETE FROM tv_season_requests WHERE status = 'completed'`);
    return;
  }

  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  await run(
    `DELETE FROM tv_season_request_history
     WHERE tv_season_request_id IN (
       SELECT id FROM tv_season_requests
       WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?
     )`,
    [cutoffIso]
  );
  await run(
    `DELETE FROM media_requests
     WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?`,
    [cutoffIso]
  );
  await run(
    `DELETE FROM tv_season_requests
     WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?`,
    [cutoffIso]
  );
}

/**
 * @param {string} requestId
 * @param {string} [completedAt]
 */
export async function markMediaRequestCompleted(requestId, completedAt) {
  const now = completedAt ?? new Date().toISOString();
  await run(
    `UPDATE media_requests
     SET status = 'completed', completed_at = COALESCE(completed_at, ?), last_checked_at = ?, last_error = NULL
     WHERE id = ?`,
    [now, now, requestId]
  );
}
