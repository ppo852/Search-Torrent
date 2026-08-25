import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { listActivity } from '../../services/activity-log/index.js';

const router = express.Router();

router.get('/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const eventType = typeof req.query.event_type === 'string' ? req.query.event_type : null;

    const items = await listActivity({ limit, offset, eventType });
    res.json({ items });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
});

export default router;
