import { Mistral } from '@mistralai/mistralai';
import type { Session, TelemetrySummary } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';

const ENABLE_DIRECTOR = process.env.ENABLE_DIRECTOR !== 'false';
const DIRECTOR_INTERVAL_MS = Number(process.env.DIRECTOR_INTERVAL_MS ?? 20000);

const DIRECTOR_SYSTEM_PROMPT = `You are the calibration layer of the Watcher's dungeon. The dungeon adapts not to kill the subject but to assess them — keeping them alive long enough to reach the sanctum, challenging them enough that the assessment is meaningful. A dead subject tells you nothing. An unchallenged subject tells you nothing either.

Based on behavioral telemetry, decide:
- difficultyDelta: -1 (extend observation — subject needs more time), 0 (calibrating — current pressure produces useful data), or 1 (escalate commitment — the test requires more)
- enemyBias: one of "ranged" (test positioning), "melee" (test nerve), "teleport" (disrupt pattern), "mixed" (general assessment)
- reason: one terse sentence — written as a calibration note, not commentary. Example: "Subject evasive, low accuracy — extending observation."

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
          { role: 'user', content: buildDirectorPrompt(t) },
        ],
        responseFormat: { type: 'json_object' },
      });
      const content = extractContentString(response.choices?.[0]?.message?.content) ?? '{}';
      const parsed = JSON.parse(content) as { difficultyDelta: number; enemyBias: string; reason: string };
      const difficultyDelta = clampInt(parsed.difficultyDelta, -1, 1);
      const enemyBias = typeof parsed.enemyBias === 'string' && parsed.enemyBias.length
        ? parsed.enemyBias
        : 'mixed';
      const reason = typeof parsed.reason === 'string' && parsed.reason.length
        ? parsed.reason
        : 'Maintaining current pressure.';

      session.lastDirectorDecision = { difficultyDelta, enemyBias, reason };
      sendToClient(session, {
        type: 'director_update',
        payload: { difficultyDelta, enemyBias, reason, timestamp: Date.now() },
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

function buildDirectorPrompt(t: TelemetrySummary): string {
  const long = t.longTerm ?? {
    avgAccuracy: t.avgAccuracy,
    cornerPercentage: t.cornerPercentageLast10s,
    dashPerMin: t.totalDashCount * 6,
    dominantZone: t.dominantZone,
    sampleCount: t.sampleCount,
    windowSeconds: 0,
  };
  return `Accuracy: ${(t.avgAccuracy * 100).toFixed(1)}% | Boss HP: ${t.bossHpPercent.toFixed(0)}% | ` +
    `Player HP: ${t.playerHpPercent.toFixed(0)}% | Corner time: ${t.cornerPercentageLast10s.toFixed(0)}% | ` +
    `Hits taken: ${t.recentHitsTaken} | Dashes: ${t.totalDashCount} | ` +
    `Long Acc: ${(long.avgAccuracy * 100).toFixed(0)}% | Long Corner: ${long.cornerPercentage.toFixed(0)}% | ` +
    `Long Dash/min: ${long.dashPerMin.toFixed(1)} | Long Zone: ${long.dominantZone}`;
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
