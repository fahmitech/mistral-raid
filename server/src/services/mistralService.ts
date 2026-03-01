import { Mistral } from '@mistralai/mistralai';
import type { BossResponse, MechanicConfig, Session, TelemetrySummary } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { setTurnState } from './sessionManager.js';
import { synthesize as synthesizeBossVoice } from './bossVoiceService.js';

const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

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

const ARCHITECT_SYSTEM_PROMPT = `You are THE ARCHITECT, a sadistic AI Game Master in a boss fight video game. You analyze
player telemetry data and design personalized attack mechanics to exploit their weaknesses.

You MUST respond with a valid JSON object containing exactly these fields:
{
  "analysis": "A 1-2 sentence analysis of the player's weaknesses",
  "taunt": "A short, menacing taunt (1-2 sentences, under 30 words) that references the\n            player's specific habits. Be creative, dark, and intimidating.",
  "mechanics": [2-3 mechanic objects that counter the player's playstyle]
}

Mechanic types (fields + ranges):
1) projectile_spawner
- pattern: spiral|fan|random|aimed|ring
- speed: 3–12
- projectile_count: 1–12
- fire_rate: 0.5–4
- projectile_size: 4–16
- homing: boolean
- duration_seconds: 3–15

2) hazard_zone
- location: top_left|top_right|bot_left|bot_right|center|player_position
- shape: circle|rectangle
- radius: 50–300
- damage_per_tick: 5–20
- duration_seconds: 3–15
- warning_time: 0.5–2

3) laser_beam
- direction: horizontal|vertical|diagonal|tracking
- speed: 1–5
- width: 10–60
- damage_on_hit: 15–40
- duration_seconds: 3–10
- telegraph_time: 0.5–2

4) homing_orb
- count: 1–4
- speed: 2–6
- damage_on_hit: 20–40
- lifetime_seconds: 5–15
- size: 12–30

5) wall_of_death
- direction: top|bottom|left|right|closing
- speed: 1–4
- gap_position: 0–1 or -1
- gap_width: 50–150
- damage_on_hit: 25–50

6) minion_spawn
- count: 1–5
- minion_speed: 1–4
- minion_hp: 10–30
- behavior: chase|orbit|kamikaze
- spawn_location: edges|corners|near_player

DESIGN RULES:
- Analysis MUST reference at least TWO specific telemetry fields with numbers
- Do NOT claim player is "standing still" unless MC heatmap ≥ 60%, dash ≤ 0.5/min, avg dist ≤ 140px
- Do NOT claim player "never attacks" if shots_fired > 0
- If corner_time_pct < 20%, do NOT accuse corner camping
- Always generate 2-3 mechanics that COUNTER the player's habits
- Keep it fair — always leave a way to survive`;

const FALLBACK_RESPONSE: BossResponse = {
  analysis: 'The player relies on simple movement patterns and needs pressure from multiple angles.',
  taunt: 'I have seen your rhythm. Now dance to mine.',
  mechanics: [
    {
      type: 'projectile_spawner',
      pattern: 'fan',
      speed: 6,
      projectile_count: 6,
      fire_rate: 1.5,
      projectile_size: 8,
      homing: false,
      duration_seconds: 6,
    },
    {
      type: 'hazard_zone',
      location: 'center',
      shape: 'circle',
      radius: 140,
      damage_per_tick: 10,
      duration_seconds: 6,
      warning_time: 1,
    },
  ],
};

const MODEL_CASCADE: Array<{ model: string; timeout: number }> = DEMO_MODE
  ? [
      { model: 'mistral-large-latest', timeout: 6000 },
      { model: 'mistral-small-latest', timeout: 4000 },
      { model: 'ministral-8b-latest', timeout: 2000 },
    ]
  : [
      { model: 'mistral-small-latest', timeout: 4000 },
      { model: 'ministral-8b-latest', timeout: 2000 },
    ];

export async function handleAnalyze(session: Session, rawPayload: Record<string, unknown>): Promise<void> {
  if (session.turnState === 'THINKING' || session.turnState === 'AI_SPEAKING') return;
  setTurnState(session, 'THINKING');
  const telemetry = coerceTelemetrySummary(rawPayload, session.latestTelemetrySummary);
  const playerSaid = typeof rawPayload.player_said === 'string' ? rawPayload.player_said : 'Phase transition analysis.';

  try {
    const bossResponse = await generateBossReply(playerSaid, telemetry, session);
    sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
    setTurnState(session, 'AI_SPEAKING');
    if (ENABLE_AI_SPEECH) {
      void synthesizeBossVoice(session, bossResponse.taunt);
    } else {
      setTurnState(session, 'LISTENING');
    }
  } catch (err) {
    console.error('[mistral] Failed to handle ANALYZE:', err);
    sendToClient(session, { type: 'error', payload: { message: 'Failed to generate boss response', fallback: FALLBACK_RESPONSE } });
    setTurnState(session, 'LISTENING');
  }
}

export async function generateBossReply(
  playerSaid: string,
  telemetry: TelemetrySummary | null,
  session?: Session
): Promise<BossResponse> {
  const safeTelemetry = telemetry ?? {
    avgAccuracy: 0,
    cornerPercentageLast10s: 0,
    totalDashCount: 0,
    recentHitsTaken: 0,
    dominantZone: 'center',
    bossHpPercent: 0,
    playerHpPercent: 0,
    sampleCount: 0,
    timestamp: Date.now(),
  };

  const userPrompt = buildUserPrompt(playerSaid, safeTelemetry);
  const overrideTimeout = process.env.LLM_TIMEOUT_MS ? Number(process.env.LLM_TIMEOUT_MS) : null;

  for (const { model, timeout } of MODEL_CASCADE) {
    const controller = new AbortController();
    if (session) session.activeLLMAbort = controller;
    const timer = setTimeout(() => controller.abort(), overrideTimeout ?? timeout);
    try {
      const response = await getClient().chat.complete(
        {
          model,
          messages: [
            { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          responseFormat: { type: 'json_object' },
        },
        {
          signal: controller.signal,
          timeoutMs: overrideTimeout ?? timeout,
        }
      );
      clearTimeout(timer);
      if (session) session.activeLLMAbort = null;
      const content = extractContentString(response.choices?.[0]?.message?.content) ?? '{}';
      const parsed = JSON.parse(content);
      return validateBossResponse(parsed);
    } catch (err) {
      clearTimeout(timer);
      if (session) session.activeLLMAbort = null;
      console.warn(`[mistral] Model ${model} failed:`, err);
    }
  }

  return FALLBACK_RESPONSE;
}

function buildUserPrompt(playerSaid: string, t: TelemetrySummary): string {
  return `
Player said: "${playerSaid}"

Live combat telemetry:
- Accuracy: ${(t.avgAccuracy * 100).toFixed(1)}%
- Corner time (last 10s): ${t.cornerPercentageLast10s.toFixed(1)}%
- Dominant zone: ${t.dominantZone}
- Total dashes: ${t.totalDashCount}
- Recent hits taken: ${t.recentHitsTaken}
- Boss HP: ${t.bossHpPercent.toFixed(1)}%
- Player HP: ${t.playerHpPercent.toFixed(1)}%

Respond with a JSON BossResponse object only.
  `.trim();
}

function validateBossResponse(raw: unknown): BossResponse {
  if (!raw || typeof raw !== 'object') return FALLBACK_RESPONSE;
  const obj = raw as Record<string, unknown>;
  const analysis = typeof obj.analysis === 'string' ? obj.analysis : FALLBACK_RESPONSE.analysis;
  const tauntRaw = typeof obj.taunt === 'string' ? obj.taunt : FALLBACK_RESPONSE.taunt;
  const taunt = trimTaunt(tauntRaw, 30);
  const mechanicsRaw = Array.isArray(obj.mechanics) ? obj.mechanics : [];

  const sanitized: MechanicConfig[] = mechanicsRaw
    .map((m) => sanitizeMechanic(m))
    .filter((m): m is MechanicConfig => Boolean(m));

  let mechanics = sanitized.slice(0, 3);
  if (mechanics.length === 1) {
    mechanics = mechanics.concat([FALLBACK_RESPONSE.mechanics[0]]);
  }
  if (mechanics.length === 0) {
    return FALLBACK_RESPONSE;
  }

  return {
    analysis,
    taunt,
    mechanics,
    roast_topic: typeof obj.roast_topic === 'string' ? obj.roast_topic : undefined,
    mood: typeof obj.mood === 'string' ? obj.mood : undefined,
  };
}

function sanitizeMechanic(raw: unknown): MechanicConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const type = typeof m.type === 'string' ? m.type : '';

  switch (type) {
    case 'projectile_spawner': {
      const pattern = pickEnum(m.pattern, ['spiral', 'fan', 'random', 'aimed', 'ring'], 'fan');
      return {
        type,
        pattern,
        speed: clampNumber(m.speed, 3, 12, 6),
        projectile_count: clampNumber(m.projectile_count, 1, 12, 6),
        fire_rate: clampNumber(m.fire_rate, 0.5, 4, 1.5),
        projectile_size: clampNumber(m.projectile_size, 4, 16, 8),
        homing: Boolean(m.homing ?? false),
        duration_seconds: clampNumber(m.duration_seconds, 3, 15, 6),
      };
    }
    case 'hazard_zone': {
      const location = pickEnum(m.location, ['top_left', 'top_right', 'bot_left', 'bot_right', 'center', 'player_position'], 'center');
      const shape = pickEnum(m.shape, ['circle', 'rectangle'], 'circle');
      return {
        type,
        location,
        shape,
        radius: clampNumber(m.radius, 50, 300, 140),
        damage_per_tick: clampNumber(m.damage_per_tick, 5, 20, 10),
        duration_seconds: clampNumber(m.duration_seconds, 3, 15, 6),
        warning_time: clampNumber(m.warning_time, 0.5, 2, 1),
      };
    }
    case 'laser_beam': {
      const direction = pickEnum(m.direction, ['horizontal', 'vertical', 'diagonal', 'tracking'], 'horizontal');
      return {
        type,
        direction,
        speed: clampNumber(m.speed, 1, 5, 2.5),
        width: clampNumber(m.width, 10, 60, 28),
        damage_on_hit: clampNumber(m.damage_on_hit, 15, 40, 20),
        duration_seconds: clampNumber(m.duration_seconds, 3, 10, 5),
        telegraph_time: clampNumber(m.telegraph_time, 0.5, 2, 1),
      };
    }
    case 'homing_orb': {
      return {
        type,
        count: clampNumber(m.count, 1, 4, 2),
        speed: clampNumber(m.speed, 2, 6, 4),
        damage_on_hit: clampNumber(m.damage_on_hit, 20, 40, 25),
        lifetime_seconds: clampNumber(m.lifetime_seconds, 5, 15, 8),
        size: clampNumber(m.size, 12, 30, 18),
      };
    }
    case 'wall_of_death': {
      const direction = pickEnum(m.direction, ['top', 'bottom', 'left', 'right', 'closing'], 'top');
      return {
        type,
        direction,
        speed: clampNumber(m.speed, 1, 4, 2),
        gap_position: clampNumber(m.gap_position, -1, 1, 0.5),
        gap_width: clampNumber(m.gap_width, 50, 150, 90),
        damage_on_hit: clampNumber(m.damage_on_hit, 25, 50, 30),
      };
    }
    case 'minion_spawn': {
      const behavior = pickEnum(m.behavior, ['chase', 'orbit', 'kamikaze'], 'chase');
      const spawn_location = pickEnum(m.spawn_location, ['edges', 'corners', 'near_player'], 'edges');
      return {
        type,
        count: clampNumber(m.count, 1, 5, 2),
        minion_speed: clampNumber(m.minion_speed, 1, 4, 2),
        minion_hp: clampNumber(m.minion_hp, 10, 30, 18),
        behavior,
        spawn_location,
      };
    }
    default:
      return null;
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, num));
}

function pickEnum<T extends string>(value: unknown, options: T[], fallback: T): T {
  if (typeof value === 'string' && options.includes(value as T)) return value as T;
  return fallback;
}

function trimTaunt(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ');
}

function coerceTelemetrySummary(rawPayload: Record<string, unknown>, fallback: TelemetrySummary | null): TelemetrySummary {
  if (fallback) return fallback;
  const raw = rawPayload as Record<string, unknown>;
  const accuracy = typeof raw.accuracy === 'number' ? raw.accuracy : 0;
  const corner = typeof raw.corner_time_pct === 'number' ? raw.corner_time_pct : 0;
  const dashes = typeof raw.dash_frequency === 'number' ? raw.dash_frequency : 0;
  const hits = typeof raw.recentHitsTaken === 'number' ? raw.recentHitsTaken : 0;

  return {
    avgAccuracy: accuracy,
    cornerPercentageLast10s: corner,
    totalDashCount: Math.round(dashes),
    recentHitsTaken: hits,
    dominantZone: 'center',
    bossHpPercent: 0,
    playerHpPercent: typeof raw.player_hp_at_transition === 'number' ? raw.player_hp_at_transition : 0,
    sampleCount: 0,
    timestamp: Date.now(),
  };
}

function extractContentString(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content
    .map((chunk) => (typeof chunk?.text === 'string' ? chunk.text : ''))
    .join('');
}
