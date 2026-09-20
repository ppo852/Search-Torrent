import express from 'express';
import {
  getCalendarEvents,
  eventsToIcs,
  isValidCalendarToken,
} from '../../services/calendar/index.js';
import logger from '../../services/core/logger.js';

const router = express.Router();

async function requireCalendarToken(req, res) {
  const token =
    (typeof req.query.token === 'string' && req.query.token) ||
    (typeof req.query.api_key === 'string' && req.query.api_key) ||
    '';
  const ok = await isValidCalendarToken(token);
  if (!ok) {
    res.status(401).json({ error: 'Token calendrier invalide ou manquant' });
    return false;
  }
  return true;
}

function parseWindow(req) {
  return {
    start: typeof req.query.start === 'string' ? req.query.start : undefined,
    end: typeof req.query.end === 'string' ? req.query.end : undefined,
  };
}

/**
 * GET /api/calendar.ics?token=...
 * Flux iCal pour Organizr (Homepage → iCal).
 */
router.get('/calendar.ics', async (req, res) => {
  try {
    if (!(await requireCalendarToken(req, res))) return;

    const { start, end } = parseWindow(req);
    const { start: resolvedStart, end: resolvedEnd, events } = await getCalendarEvents({ start, end });
    const ics = eventsToIcs(events, { start: resolvedStart, end: resolvedEnd });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="search-torrent-calendar.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(ics);
  } catch (error) {
    logger.error('[calendar] ics error', error);
    res.status(500).json({ error: 'Erreur calendrier' });
  }
});

/**
 * GET /api/calendar?token=...
 * JSON miroir (debug / futur widget).
 */
router.get('/calendar', async (req, res) => {
  try {
    if (!(await requireCalendarToken(req, res))) return;

    const { start, end } = parseWindow(req);
    const payload = await getCalendarEvents({ start, end });
    res.json(payload);
  } catch (error) {
    logger.error('[calendar] json error', error);
    res.status(500).json({ error: 'Erreur calendrier' });
  }
});

export default router;
