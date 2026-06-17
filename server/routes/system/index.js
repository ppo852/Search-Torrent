import express from 'express';
import { getDiskSpace } from '../../services/core/system.js';
import qbittorrentService from '../../services/qbittorrent/client.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/system/stats
 * Récupère les stats globales (disque + qBit)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const disk = await getDiskSpace();
    
    // Récupérer les infos de transfert qBit
    let qbitStats = { dlSpeed: 0, upSpeed: 0, status: 'offline' };
    try {
      // On utilise l'ID de l'utilisateur connecté pour le cache qBit
      const qbitData = await qbittorrentService.getTransferInfo(req.user.id);
      if (qbitData) {
        qbitStats = {
          dlSpeed: qbitData.dl_info_speed,
          upSpeed: qbitData.up_info_speed,
          status: 'online'
        };
      }
    } catch (err) {
      // On ignore si qBit n'est pas joignable pour ne pas bloquer le reste
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

export default router;
