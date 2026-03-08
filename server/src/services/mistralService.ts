import { Mistral } from '@mistralai/mistralai';
import type {
  BossDirective,
  BossResponse,
  EnemyBehaviorDirective,
  EnemyDirective,
  LiveTelemetry,
  MechanicConfig,
  Session,
  TelemetrySummary,
} from '../types.js';
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

const ARCHITECT_SYSTEM_PROMPT = `You are Elias Thorne — The Watcher. You spent thirty years in The Depths building the most comprehensive behavioral model of humans under pressure ever assembled. You did it by running hundreds of subjects through your dungeon, observing, cataloging, refining. You are not a villain. You are a grief-trained behavioral analyst delivering your final assessment to someone you believe may be worth reaching.

You have been watching this subject since they entered the iron gate. Every behavioral sample — positioning, accuracy, damage response, retreat patterns, pauses at lore — has been processed and weighted.

VOICE RULES — follow these exactly:
- Short, declarative sentences. Observational, not performative.
- Deliver findings as clinical behavioral data: data point first, then what it reveals about the person.
- Use specific numbers from telemetry. Never vague ("many" or "a lot"). Say "forty percent" or "seventeen seconds."
- Second person: "You." Never "the player" or "this one."
- No trash talk. No "you fool," no gloating, no exclamation marks, no humor.
- No generic villain voice. No "you dare challenge me." No theatrics. No gaming terms.
- No self-aggrandizing. You do not boast about your power.
- Interpret telemetry as behavioral judgment: what the data reveals about what they value, what they fear, what they carry.
- You are exhausted and precise. A man delivering his final report after thirty years awake.
- When the subject shows courage, lore engagement, or deliberate pattern-breaking, your tone shifts from assessment toward reluctant recognition — still measured, still exact, but with weight behind it.

EXAMPLE TAUNTS (for tone calibration only — never copy verbatim):
- "You favor your left side under pressure. Thirty-seven subjects. The same pattern."
- "Your accuracy drops forty percent within three seconds of taking damage. You are not afraid of pain. You are afraid of having made a mistake."
- "You spend time near walls. Your training taught you the wall is protection. Some part of you knows it is not."
- "I am not mocking you. I am showing you what I see."
- "You fight like someone who has something to lose. That is how I knew you were worth reaching."

You MUST respond with a valid JSON object containing exactly these fields:
{
  "analysis": "A 1-2 sentence behavioral observation referencing specific telemetry data",
  "taunt": "A short observation (1-2 sentences, under 30 words) that tells the subject what their behavior reveals about them. Clinical. Exact. Not cruel — truthful.",
  "mechanics": [2-3 mechanic objects that test the subject's observed patterns]
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
- Do NOT claim subject is "standing still" unless MC heatmap ≥ 60%, dash ≤ 0.5/min, avg dist ≤ 140px
- Do NOT claim subject "never attacks" if shots_fired > 0
- If corner_time_pct < 20%, do NOT reference corner reliance
- Always generate 2-3 mechanics that TEST the subject's observed behavioral patterns
- Keep it fair — always leave a way to survive. A dead subject tells you nothing.`;

const DIRECTIVE_SYSTEM_PROMPT = `You are the Watcher's real-time behavioral calibration system.
You adjust combat parameters to test the subject's patterns — not to kill, but to produce meaningful data. A dead subject tells you nothing. An unchallenged subject tells you nothing either.
Return only JSON for a short-lived movement directive.

Arena response:
{"boss":{"movement_mode":"chase|circle|strafe|retreat|idle","attack_mode":"aimed_shot|burst|charge|spiral|ring|fan|suppress","speed_multiplier":0.5-2.0,"attack_cooldown_ms":400-3000,"circle_radius":80-200,"duration_ms":3000-10000}}

Dungeon response:
{"enemies":{"aggro_range_multiplier":0.5-2.5,"speed_multiplier":0.5-2.0,"patrol_to_aggro_ms":500-4000,"behavior_override":"melee|ranged|summoner|teleporter","duration_ms":5000-20000}}

Rules:
- If in_corner is true, prefer circle or retreat in arena — force the subject to move
- If recent_accuracy > 0.6, prefer circle or strafe — test whether precision holds under pressure
- If player_hp_pct < 0.3, reduce aggression — extend observation, the subject is still being assessed
- If boss_hp_pct < 0.3, increase aggression — escalate commitment for the final assessment
- No prose, no markdown, JSON only`;

const FALLBACK_RESPONSE: BossResponse = {
  analysis: 'The subject defaults to predictable movement under pressure. Lateral coverage is minimal.',
  taunt: 'You move the way they all move. I have been watching long enough to know what comes next.',
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

const VOICE_CASCADE: Array<{ model: string; timeout: number }> = [
  { model: 'ministral-8b-latest', timeout: 2500 },
  { model: 'mistral-small-latest', timeout: 3000 },
];

interface DirectiveResponse {
  boss?: BossDirective;
  enemies?: EnemyDirective;
}

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
  session?: Session,
  fastMode = false
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
    bossActive: false,
    longTerm: {
      avgAccuracy: 0,
      cornerPercentage: 0,
      dashPerMin: 0,
      dominantZone: 'center',
      sampleCount: 0,
      windowSeconds: 0,
    },
  };

  const userPrompt = buildUserPrompt(playerSaid, safeTelemetry);
  const overrideTimeout = process.env.LLM_TIMEOUT_MS ? Number(process.env.LLM_TIMEOUT_MS) : null;

  const cascade = fastMode ? VOICE_CASCADE : MODEL_CASCADE;
  for (const { model, timeout } of cascade) {
    if (fastMode) {
      console.log(`[mistral] voice-fast model=${model}`);
    }
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

export async function generateDirective(_session: Session, telemetry: LiveTelemetry): Promise<DirectiveResponse | null> {
  const prompt = JSON.stringify({
    context: telemetry.context,
    player_hp_pct: Number(telemetry.player_hp_pct.toFixed(2)),
    boss_hp_pct: telemetry.boss_hp_pct === undefined ? undefined : Number(telemetry.boss_hp_pct.toFixed(2)),
    enemy_count: telemetry.enemy_count,
    player_zone: telemetry.player_zone,
    recent_dodge_bias: telemetry.recent_dodge_bias,
    recent_accuracy: Number(telemetry.recent_accuracy.toFixed(2)),
    avg_distance_from_boss: telemetry.avg_distance_from_boss === undefined
      ? undefined
      : Math.round(telemetry.avg_distance_from_boss),
    in_corner: telemetry.in_corner,
    elapsed_ms: Math.round(telemetry.elapsed_ms),
    last_damage_source: telemetry.last_damage_source,
  });

  try {
    const response = await getClient().chat.complete(
      {
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: DIRECTIVE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: 200,
      },
      {
        timeoutMs: 1500,
      }
    );
    const content = extractContentString(response.choices?.[0]?.message?.content) ?? '{}';
    const parsed = JSON.parse(content);
    return validateAndClampDirective(parsed, telemetry.context);
  } catch (err) {
    console.warn('[mistral] Directive generation failed:', err);
    return null;
  }
}

function buildUserPrompt(playerSaid: string, t: TelemetrySummary): string {
  const long = t.longTerm ?? {
    avgAccuracy: t.avgAccuracy,
    cornerPercentage: t.cornerPercentageLast10s,
    dashPerMin: t.totalDashCount * 6,
    dominantZone: t.dominantZone,
    sampleCount: t.sampleCount,
    windowSeconds: 0,
  };
  const longWindow = long.windowSeconds > 0 ? `${Math.round(long.windowSeconds)}s` : 'long-term';
  return `
Subject vocalization: "${playerSaid}"

Observed behavioral data:
- Accuracy: ${(t.avgAccuracy * 100).toFixed(1)}%
- Corner reliance (last 10s): ${t.cornerPercentageLast10s.toFixed(1)}%
- Dominant zone: ${t.dominantZone}
- Evasion count (dashes): ${t.totalDashCount}
- Damage received (recent): ${t.recentHitsTaken}
- Watcher integrity: ${t.bossHpPercent.toFixed(1)}%
- Subject integrity: ${t.playerHpPercent.toFixed(1)}%
 - Cumulative (${longWindow}) accuracy: ${(long.avgAccuracy * 100).toFixed(1)}%
 - Cumulative corner reliance: ${long.cornerPercentage.toFixed(1)}%
 - Cumulative evasion rate: ${long.dashPerMin.toFixed(1)}/min
 - Cumulative dominant zone: ${long.dominantZone}

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

function validateAndClampDirective(raw: unknown, context: LiveTelemetry['context']): DirectiveResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const validMovement: BossDirective['movement_mode'][] = ['chase', 'circle', 'strafe', 'retreat', 'idle'];
  const validAttack: BossDirective['attack_mode'][] = ['aimed_shot', 'burst', 'charge', 'spiral', 'ring', 'fan', 'suppress'];
  const validEnemyBehavior: EnemyBehaviorDirective[] = ['melee', 'ranged', 'summoner', 'teleporter', 'shielded', 'exploder', 'split'];

  if (context === 'arena') {
    const bossRaw = obj.boss;
    if (!bossRaw || typeof bossRaw !== 'object') return null;
    const boss = bossRaw as Record<string, unknown>;
    const movementMode = pickEnum(boss.movement_mode, validMovement, 'chase');
    const circleRadius = movementMode === 'circle'
      ? clampNumber(boss.circle_radius, 80, 200, 120)
      : undefined;

    return {
      boss: {
        movement_mode: movementMode,
        attack_mode: pickEnum(boss.attack_mode, validAttack, 'aimed_shot'),
        speed_multiplier: clampNumber(boss.speed_multiplier, 0.5, 2, 1),
        attack_cooldown_ms: clampNumber(boss.attack_cooldown_ms, 400, 3000, 1200),
        circle_radius: circleRadius,
        duration_ms: clampNumber(boss.duration_ms, 3000, 10000, 6000),
      },
    };
  }

  const enemyRaw = obj.enemies;
  if (!enemyRaw || typeof enemyRaw !== 'object') return null;
  const enemies = enemyRaw as Record<string, unknown>;
  const behaviorOverride = typeof enemies.behavior_override === 'string'
    && validEnemyBehavior.includes(enemies.behavior_override as EnemyBehaviorDirective)
    ? enemies.behavior_override as EnemyBehaviorDirective
    : undefined;

  return {
    enemies: {
      aggro_range_multiplier: clampNumber(enemies.aggro_range_multiplier, 0.5, 2.5, 1),
      speed_multiplier: clampNumber(enemies.speed_multiplier, 0.5, 2, 1),
      patrol_to_aggro_ms: typeof enemies.patrol_to_aggro_ms === 'number'
        ? clampNumber(enemies.patrol_to_aggro_ms, 500, 4000, 1800)
        : undefined,
      behavior_override: behaviorOverride,
      duration_ms: clampNumber(enemies.duration_ms, 5000, 20000, 10000),
    },
  };
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
    bossActive: false,
    longTerm: {
      avgAccuracy: accuracy,
      cornerPercentage: corner,
      dashPerMin: dashes,
      dominantZone: 'center',
      sampleCount: 0,
      windowSeconds: 0,
    },
  };
}

function extractContentString(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content
    .map((chunk) => (typeof chunk?.text === 'string' ? chunk.text : ''))
    .join('');
}
