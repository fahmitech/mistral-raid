import { Router } from 'express';
import { generateBossReply } from '../services/mistralService.js';

const bossRouter = Router();

bossRouter.post('/analyze', async (req, res) => {
  const { player_said, telemetry } = req.body as { player_said?: string; telemetry?: unknown };
  try {
    const bossResponse = await generateBossReply(player_said ?? '', telemetry as any);
    res.json(bossResponse);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate boss response' });
  }
});

export { bossRouter };
