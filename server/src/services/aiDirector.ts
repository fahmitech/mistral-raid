import { Mistral } from '@mistralai/mistralai';
import type { Session, TelemetrySummary } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { buildNarrativeLabel } from './directorNarrative.js';
import { buildPlayerProfile } from './playerProfile.js';
import { logger } from './loggingService.js';

const ENABLE_DIRECTOR = process.env.ENABLE_DIRECTOR !== 'false';
const DIRECTOR_INTERVAL_MS = Number(process.env.DIRECTOR_INTERVAL_MS ?? 20000);

const DIRECTOR_SYSTEM_PROMPT = `You are the AI Dungeon Director for a boss fight. Based on telemetry, decide:
- difficultyDelta: -1 (ease off), 0 (hold), or 1 (increase pressure)
- enemyBias: one of "ranged", "melee", "teleport", "mixed"
- reason: one sentence explaining your decision

Respond with JSON only. Be decisive — always pick a bias and a delta.`;

let client: Mistral | null = null;

function getClient(): Mistral {
  if (client) return client;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }
  client = new Mistral({ apiKey });
  return client;
}

export function startDirector(session: Session): void {
  if (!ENABLE_DIRECTOR) return;
  if (session.directorInterval) return;

  const tick = async () => {
    const t = session.latestTelemetrySummary;
    if (!t || !t.bossActive) return;
    try {
      const response = await getClient().chat.complete({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: buildDirectorPrompt(t, session) },
        ],
        responseFormat: { type: 'json_object' },
      });

      const userPrompt = buildDirectorPrompt(t, session);
      const content = extractContentString(response.choices?.[0]?.message?.content) ?? '{}';
      const parsed = JSON.parse(content) as { difficultyDelta: number; enemyBias: string; reason: string };

      // Log successful director call with full context
      logger.writeLog('llm', {
        type: 'global_director',
        sessionId: session.id,
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response: parsed,
      });
      const difficultyDelta = clampInt(parsed.difficultyDelta, -1, 1);
      const enemyBias = typeof parsed.enemyBias === 'string' && parsed.enemyBias.length
        ? parsed.enemyBias
        : 'mixed';
      const reason = typeof parsed.reason === 'string' && parsed.reason.length
        ? parsed.reason
        : 'Maintaining current pressure.';

      session.lastDirectorDecision = { difficultyDelta, enemyBias, reason };
      const narrative = buildNarrativeLabel(difficultyDelta, enemyBias, t);
      sendToClient(session, {
        type: 'director_update',
        payload: { difficultyDelta, enemyBias, reason, ...narrative, timestamp: Date.now() },
      });
      console.log(`[director] difficultyDelta=${difficultyDelta} enemyBias=${enemyBias} reason="${reason}"`);
    } catch (err) {
      console.warn('[director] Failed to compute director decision:', err);
    }
  };

  // Fire first tick soon after connection.
  void tick();
  session.directorInterval = setInterval(() => void tick(), DIRECTOR_INTERVAL_MS);
}

export function stopDirector(session: Session): void {
  if (session.directorInterval) {
    clearInterval(session.directorInterval);
    session.directorInterval = null;
  }
}

function buildDirectorPrompt(t: TelemetrySummary, session: Session): string {
  const profile = buildPlayerProfile(t);
  const story = {
    level: session.levelTag || 'unknown',
    lore: (session.loreDiscovered || []).length,
    bosses: (session.bossHistory || []).join(','),
    class: session.playerClass || 'unknown'
  };

  const long = t.longTerm ?? {
    avgAccuracy: t.avgAccuracy,
    cornerPercentage: t.cornerPercentageLast10s,
    dashPerMin: t.totalDashCount * 6,
    dominantZone: t.dominantZone,
    sampleCount: t.sampleCount,
    windowSeconds: 0,
  };
  return `Context: Class=${story.class} | Level=${story.level} | LoreFound=${story.lore} | BossesDefeated=[${story.bosses}]
Profile: Aggression=${profile.aggression} | Style=${profile.movementStyle} | LoreUsage=${profile.loreBehavior}
Stats: Acc=${(t.avgAccuracy * 100).toFixed(1)}% | BossHP=${t.bossHpPercent.toFixed(0)}% | ` +
    `PlayerHP=${t.playerHpPercent.toFixed(0)}% | Corner=${t.cornerPercentageLast10s.toFixed(0)}% | ` +
    `Hits=${t.recentHitsTaken} | Dashes=${t.totalDashCount} | ` +
    `Lore=${t.loreInteractionCount} read, ${t.skippedMandatoryLore} skipped | ` +
    `WallBias=${t.wallBias.toFixed(0)}% | Retreat=${Math.round(t.retreatDistance)}px | ` +
    `LongAcc=${(long.avgAccuracy * 100).toFixed(0)}% | LongCorner=${long.cornerPercentage.toFixed(0)}% | ` +
    `LongDash=${long.dashPerMin.toFixed(1)} | LongZone=${long.dominantZone}`;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function extractContentString(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content
    .map((chunk) => (typeof chunk?.text === 'string' ? chunk.text : ''))
    .join('');
}
