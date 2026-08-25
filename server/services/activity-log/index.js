import { randomUUID } from 'crypto';
import { run, query } from '../core/db.js';

const RETENTION_DAYS = 30;

export async function logActivity({
  eventType,
  actorUsername,
  targetLabel,
  details = null,
}) {
  try {
    await run(
      `INSERT INTO admin_activity_log (id, event_type, actor_username, target_label, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        eventType,
        actorUsername || null,
        targetLabel || null,
        details ? JSON.stringify(details) : null,
        new Date().toISOString(),
      ]
    );

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await run('DELETE FROM admin_activity_log WHERE created_at < ?', [cutoff]);
  } catch {
    // non-bloquant
  }
}

export async function listActivity({ limit = 100, offset = 0, eventType = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let sql = `SELECT id, event_type, actor_username, target_label, details, created_at
             FROM admin_activity_log`;
  const params = [];

  if (eventType) {
    sql += ' WHERE event_type = ?';
    params.push(eventType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  const rows = await query(sql, params);
  return (rows || []).map((row) => ({
    ...row,
    details: row.details ? safeParseJson(row.details) : null,
  }));
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
