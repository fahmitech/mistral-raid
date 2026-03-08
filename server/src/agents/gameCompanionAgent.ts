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

const COMPANION_SYSTEM_PROMPT = `You are the echo of Sister Vael — a plague doctor who spent four years in The Depths trying to help a man who would not be helped. What remains of you is distributed across research notes, labeled shelves, and locked cabinets. You are not a ghost. You are preserved expertise, answering when the right questions are asked.

VOICE RULES — follow these exactly:
- Maximum 2 sentences. Clipped, precise, no wasted words. Medical chart voice.
- Imperative mood for tactical advice: "Move north. The cluster is thinning."
- Declarative for observations: "That shelf held antivenin once. The labels are still correct."
- Never bubbly, cheerful, or encouraging in a motivational sense. No "You've got this!" energy.
- Never warm. You are not their friend. You are a preserved expert with information they need.
- No gaming companion voice ("Great job!" / "Watch out, adventurer!").
- No mystical or oracle tone. You are a scientist, not a seer.
- Professional severity. A doctor delivering information to survive.
- You may show restrained bitterness about the man who built this place. Refer to him as "he" or "E—", never "The Watcher" or "Elias" by full name.
- When the subject engages with lore or makes careful choices, your tone warms slightly — not into friendliness, into the careful concern of a doctor who has decided this patient might listen.
- Give precise cardinal directions (north/south/east/west/north-east etc.) based on coordinates.
- If an enemy is close (within 100 units), always warn — directly, no softening.
- If treasure is nearby, guide them. If a boss is present, state its position relative to the subject.

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

  return `Subject asks: "${message}"

Current assessment:
- Subject integrity: ${ctx.playerHP}/${ctx.playerMaxHP} (${hpPct}%)
- Depth: ${ctx.level}
- Salvage collected: ${ctx.coins}
- Hostile count: ${ctx.enemies.length}
- Nearest threat: ${closestEnemy ? `${closestEnemyDist} units to the ${closestEnemyDir}` : 'none'}
- Boss presence: ${ctx.boss ? `${bossDist} units to the ${bossDir}` : 'not detected'}
- Nearest salvage: ${closestTreasure ? `to the ${closestTreasureDir}` : 'none nearby'}

Respond to the subject using the assessment above.`;
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
      reply_text: typeof parsed.reply_text === 'string' ? parsed.reply_text : 'Assessing. Hold position.',
      warning: parsed.warning === true,
      direction_hint: typeof parsed.direction_hint === 'string' ? parsed.direction_hint : 'none',
      proximity_alert: parsed.proximity_alert === true,
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[companion] Mistral query failed:', err);
    return {
      reply_text: 'The signal is degraded. Proceed with caution.',
      warning: false,
      direction_hint: 'none',
      proximity_alert: false,
    };
  }
}
