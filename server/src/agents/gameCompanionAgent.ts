import { Mistral } from '@mistralai/mistralai';

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
  const hpPct = Math.round((ctx.playerHP / ctx.playerMaxHP) * 100);
  const closestEnemy = ctx.enemies.length > 0
    ? ctx.enemies.reduce((best, e) => dist(ctx.playerPos, e) < dist(ctx.playerPos, best) ? e : best)
    : null;
  const closestEnemyDist = closestEnemy ? Math.round(dist(ctx.playerPos, closestEnemy)) : null;
  const closestEnemyDir = closestEnemy ? getDirection(ctx.playerPos, closestEnemy) : null;
  const closestTreasure = ctx.treasures.length > 0
    ? ctx.treasures.reduce((best, t) => dist(ctx.playerPos, t) < dist(ctx.playerPos, best) ? t : best)
    : null;
  const closestTreasureDir = closestTreasure ? getDirection(ctx.playerPos, closestTreasure) : null;
  const bossDir = ctx.boss ? getDirection(ctx.playerPos, ctx.boss) : null;
  const bossDist = ctx.boss ? Math.round(dist(ctx.playerPos, ctx.boss)) : null;

  return `Player message: "${message}"

Game state:
- Player HP: ${ctx.playerHP}/${ctx.playerMaxHP} (${hpPct}%)
- Level: ${ctx.level}
- Coins: ${ctx.coins}
- Enemies remaining: ${ctx.enemies.length}
- Closest enemy: ${closestEnemy ? `${closestEnemyDist} units to the ${closestEnemyDir}` : 'none'}
- Boss: ${ctx.boss ? `${bossDist} units to the ${bossDir}` : 'not present'}
- Nearest treasure: ${closestTreasure ? `to the ${closestTreasureDir}` : 'none nearby'}

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
