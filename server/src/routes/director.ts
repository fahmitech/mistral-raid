import express, { Request, Response } from 'express';
import { analyzeTelemetry } from '../agents/dungeonDirectorAgent.js';
import { TelemetryPayload } from '../agents/responseValidatorDirector.js';

const router = express.Router();

router.post('/analyze', async (req: Request, res: Response) => {
  console.log('📡 DIRECTOR_ANALYZE RECEIVED from session:', req.body?.sessionId ?? '(unknown)');

  const payload = req.body as Partial<TelemetryPayload>;

  // Basic validation
  if (!payload.sessionId || typeof payload.level !== 'number') {
    console.warn('[Director] Bad request – missing sessionId or level');
    res.status(400).json({ error: 'Missing required fields: sessionId, level' });
    return;
  }

  // Fill defaults for optional numeric fields
  const telemetry: TelemetryPayload = {
    sessionId: payload.sessionId,
    level: payload.level,
    roomsCleared: payload.roomsCleared ?? 0,
    enemiesKilled: payload.enemiesKilled ?? 0,
    playerHP: payload.playerHP ?? 6,
    playerMaxHP: payload.playerMaxHP ?? 6,
    coins: payload.coins ?? 0,
    score: payload.score ?? 0,
    damageDealt: payload.damageDealt ?? 0,
    damageTaken: payload.damageTaken ?? 0,
    playTimeSeconds: payload.playTimeSeconds ?? 0,
    weaponType: payload.weaponType ?? 'sword',
    character: payload.character ?? 'knight',
  };

  const decision = await analyzeTelemetry(telemetry);
  console.log('📤 SENDING DIRECTOR RESPONSE:', JSON.stringify(decision));
  res.json(decision);
});

export { router as directorRouter };
