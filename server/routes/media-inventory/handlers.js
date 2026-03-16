import mediaInventoryService from '../../services/media-inventory/index.js';
import { getSetting } from '../../services/settings/index.js';
import { updateDownloadingEpisodesStatus } from '../../services/media-inventory/episode-status.js';

let scanJob = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastResult: null,
  lastUpdatedEpisodes: null,
  lastError: null
};

function parseYearFromReleaseDate(value) {
  if (!value) return null;
  const y = String(value).split('-')[0];
  const n = Number(y);
  return Number.isInteger(n) ? n : null;
}

export async function scanMediaInventoryNowHandler(req, res) {
  try {
    if (scanJob.running) {
      return res.status(409).json({
        success: false,
        error: 'Scan déjà en cours',
        status: scanJob
      });
    }

    scanJob = {
      running: true,
      startedAt: Date.now(),
      finishedAt: null,
      lastResult: null,
      lastUpdatedEpisodes: null,
      lastError: null
    };

    // fire-and-forget to avoid HTTP timeouts on large libraries
    (async () => {
      try {
        const moviesPath = await getSetting('media_movies_path');
        const seriesPath = await getSetting('media_series_path');

        const result = await mediaInventoryService.scanNow({
          moviesPath: typeof moviesPath === 'string' ? moviesPath : '/media/Films',
          seriesPath: typeof seriesPath === 'string' ? seriesPath : '/media/series'
        });

        const updatedEpisodes = await updateDownloadingEpisodesStatus();

        scanJob.running = false;
        scanJob.finishedAt = Date.now();
        scanJob.lastResult = result;
        scanJob.lastUpdatedEpisodes = updatedEpisodes;
        scanJob.lastError = null;
      } catch (err) {
        console.error('Erreur scan media inventory (async):', err);
        scanJob.running = false;
        scanJob.finishedAt = Date.now();
        scanJob.lastError = err instanceof Error ? err.message : 'Erreur serveur';
      }
    })();

    return res.json({ success: true, started: true, status: scanJob });
  } catch (error) {
    console.error('Erreur scan media inventory:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

export async function getMediaInventoryScanStatusHandler(req, res) {
  res.json({ success: true, status: scanJob });
}

export async function checkMediaPresenceHandler(req, res) {
  try {
    const { kind, title, year, season, episode } = req.body || {};

    if (!kind || !title) {
      return res.status(400).json({ error: 'kind et title sont requis' });
    }

    const result = await mediaInventoryService.isPresent({
      kind,
      title,
      year: year ?? parseYearFromReleaseDate(req.body?.release_date),
      season,
      episode
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur check media inventory:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}
