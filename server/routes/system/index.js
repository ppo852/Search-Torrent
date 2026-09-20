import express from 'express';
import fetch from 'node-fetch';
import { createReadStream, existsSync } from 'fs';
import { getDiskSpace } from '../../services/core/system.js';
import qbittorrentService from '../../services/qbittorrent/index.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { getSetting } from '../../services/settings/index.js';
import config from '../../services/core/config.js';
import { get, query } from '../../services/core/db.js';
import { testConnection as testEmbyConnection } from '../../services/emby/client.js';

const router = express.Router();

async function pingService(name, fn) {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * GET /api/system/stats
 * Récupère les stats globales (disque + qBit)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const disk = await getDiskSpace();

    let qbitStats = { dlSpeed: 0, upSpeed: 0, dlTotal: 0, upTotal: 0, status: 'offline' };
    try {
      const transferInfo = await qbittorrentService.getTransferInfo(req.user.id);
      if (transferInfo && typeof transferInfo === 'object') {
        qbitStats = {
          dlSpeed: Number(transferInfo.dl_info_speed) || 0,
          upSpeed: Number(transferInfo.up_info_speed) || 0,
          dlTotal: Number(transferInfo.dl_info_data) || 0,
          upTotal: Number(transferInfo.up_info_data) || 0,
          status: 'online'
        };
      }
    } catch {
      // qBit indisponible — on ne bloque pas le reste
    }

    res.json({
      disk,
      qbit: qbitStats,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function checkAllQbitUsersHealth() {
  const rows = await query(
    `SELECT id, username, qbit_url
     FROM users
     WHERE qbit_url IS NOT NULL AND trim(qbit_url) != ''
       AND qbit_api_key IS NOT NULL AND trim(qbit_api_key) != ''
     ORDER BY username COLLATE NOCASE ASC`
  );

  if (!rows.length) {
    return [];
  }

  return Promise.all(
    rows.map(async (user) => {
      const status = await pingService(`qbit:${user.id}`, async () => {
        const info = await qbittorrentService.getTransferInfo(user.id);
        if (!info) {
          throw new Error('qBittorrent indisponible');
        }
      });

      return {
        userId: user.id,
        username: user.username,
        ...status
      };
    })
  );
}

/**
 * GET /api/system/health
 * Ping Prowlarr, TMDB, qBit (par utilisateur) et SQLite (admin)
 */
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [prowlarr, tmdb, emby, db, qbitUsers] = await Promise.all([
      pingService('prowlarr', async () => {
        const url = await getSetting('prowlarr_url');
        const apiKey = await getSetting('prowlarr_api_key');
        if (!url || !apiKey) {
          throw new Error('Prowlarr non configuré');
        }
        const base = String(url).replace(/\/$/, '');
        const response = await fetch(`${base}/api/v1/system/status`, {
          headers: { 'X-Api-Key': String(apiKey) },
          timeout: 8000
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }),
      pingService('tmdb', async () => {
        const token = await getSetting('tmdb_access_token');
        if (!token) {
          throw new Error('TMDB non configuré');
        }
        const response = await fetch('https://api.themoviedb.org/3/configuration', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }),
      pingService('emby', async () => {
        await testEmbyConnection();
      }),
      pingService('db', async () => {
        const row = await get('SELECT 1 as ok');
        if (!row?.ok) {
          throw new Error('SQLite indisponible');
        }
      }),
      checkAllQbitUsersHealth()
    ]);

    res.json({
      prowlarr,
      tmdb,
      emby,
      db,
      qbitUsers,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/**
 * GET /api/system/backup/database
 * Télécharge une copie de la base SQLite (admin)
 */
router.get('/backup/database', authenticateToken, requireAdmin, (req, res) => {
  try {
    const dbPath = config.db.path;
    if (!existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de données introuvable' });
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `search-torrent-backup-${date}.sqlite`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = createReadStream(dbPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors de la lecture de la base' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
