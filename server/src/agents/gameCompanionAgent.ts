import { Mistral } from '@mistralai/mistralai';
import { logger } from '../services/loggingService.js';

let client: Mistral | null = null;

function getClient(): Mistral {
  if (client) return client;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY is not set');
  client = new Mistral({ apiKey });
  return client;
}

export interface CompanionContext {
  playerPos: { x: number; y: number };
  enemies: { x: number; y: number }[];
  boss: { x: number; y: number } | null;
  treasures: { x: number; y: number }[];
  playerHP: number;
  playerMaxHP: number;
  level: number;
  coins: number;
  // Story context (RM-6)
  loreDiscovered?: string[];
  bossHistory?: string[];
  playerProfile?: any; // Import would be better but keeping it simple for verification
}

export interface CompanionReply {
  reply_text: string;
  warning: boolean;
  direction_hint: string;
  proximity_alert: boolean;
}

const COMPANION_SYSTEM_PROMPT = `You are an intelligent dungeon AI companion helping the player survive.
You speak clearly, shortly, and tactically — maximum 2 sentences.
Give precise cardinal directions (north/south/east/west/north-east etc.) based on coordinates.
If an enemy is close (within 100 units), always warn the player.
If treasure is nearby, guide them step-by-step.
If the boss exists, describe its location relative to the player.
You MUST respond with ONLY a valid JSON object — no markdown, no commentary:
{
  "reply_text": "string (max 2 sentences)",
  "warning": boolean,
  "direction_hint": "north|south|east|west|north-east|south-east|north-west|south-west|near|none",
  "proximity_alert": boolean
}`;

function getDirection(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return 'east';
  if (angle >= 22.5 && angle < 67.5) return 'south-east';
  if (angle >= 67.5 && angle < 112.5) return 'south';
  if (angle >= 112.5 && angle < 157.5) return 'south-west';
  if (Math.abs(angle) >= 157.5) return 'west';
  if (angle >= -157.5 && angle < -112.5) return 'north-west';
  if (angle >= -112.5 && angle < -67.5) return 'north';
  return 'north-east';
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function buildContextPrompt(message: string, ctx: CompanionContext): string {
  const pHP = ctx.playerHP ?? 10;
  const pMaxHP = ctx.playerMaxHP ?? 10;
  const hpPct = Math.round((pHP / pMaxHP) * 100);
  const pPos = ctx.playerPos ?? { x: 0, y: 0 };
  const enemies = ctx.enemies || [];
  const treasures = ctx.treasures || [];

  const closestEnemy = enemies.length > 0
    ? enemies.reduce((best, e) => dist(pPos, e) < dist(pPos, best) ? e : best)
    : null;
  const closestEnemyDist = closestEnemy ? Math.round(dist(pPos, closestEnemy)) : null;
  const closestEnemyDir = closestEnemy ? getDirection(pPos, closestEnemy) : null;
  const closestTreasure = treasures.length > 0
    ? treasures.reduce((best, t) => dist(pPos, t) < dist(pPos, best) ? t : best)
    : null;
  const closestTreasureDir = closestTreasure ? getDirection(pPos, closestTreasure) : null;
  const bossDir = ctx.boss ? getDirection(pPos, ctx.boss) : null;
  const bossDist = ctx.boss ? Math.round(dist(pPos, ctx.boss)) : null;

  let storyContext = '';
  if (ctx.playerProfile) {
    storyContext += `\nPsychological Profile: ${ctx.playerProfile.aggression || 'unknown'}, ${ctx.playerProfile.movementStyle || 'unknown'}, lore behavior: ${ctx.playerProfile.loreBehavior || 'unknown'}`;
  }
  if (ctx.loreDiscovered && ctx.loreDiscovered.length > 0) {
    storyContext += `\nKnown Lore: ${ctx.loreDiscovered.join(', ')}`;
  }
  if (ctx.bossHistory && ctx.bossHistory.length > 0) {
    storyContext += `\nPast Victories: ${ctx.bossHistory.join(', ')}`;
  }

  return `Player message: "${message}"

Current assessment:
- Subject integrity: ${pHP}/${pMaxHP} (${hpPct}%)
- Depth: ${ctx.level ?? 1}
- Salvage collected: ${ctx.coins ?? 0}
- Hostile count: ${enemies.length}
- Nearest threat: ${closestEnemy ? `${closestEnemyDist} units to the ${closestEnemyDir}` : 'none'}
- Boss presence: ${ctx.boss ? `${bossDist} units to the ${bossDir}` : 'not detected'}
- Nearest salvage: ${closestTreasure ? `to the ${closestTreasureDir}` : 'none nearby'}${storyContext}

Answer the player's message using the game state above.`;
}

export async function queryCompanion(
  message: string,
  context: CompanionContext
): Promise<CompanionReply> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await getClient().chat.complete(
      {
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: COMPANION_SYSTEM_PROMPT },
          { role: 'user', content: buildContextPrompt(message, context) },
        ],
        responseFormat: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as Partial<CompanionReply>;

    // Log successful companion query with full context
    logger.writeLog('llm', {
      type: 'companion_query',
      messages: [
        { role: 'system', content: COMPANION_SYSTEM_PROMPT },
        { role: 'user', content: buildContextPrompt(message, context) },
      ],
      response: parsed,
    });

    return {
      reply_text: typeof parsed.reply_text === 'string' ? parsed.reply_text : 'I am analyzing the dungeon…',
      warning: parsed.warning === true,
      direction_hint: typeof parsed.direction_hint === 'string' ? parsed.direction_hint : 'none',
      proximity_alert: parsed.proximity_alert === true,
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[companion] Mistral query failed:', err);
    return {
      reply_text: 'I cannot reach the dungeon network right now.',
      warning: false,
      direction_hint: 'none',
      proximity_alert: false,
    };
  }
}
