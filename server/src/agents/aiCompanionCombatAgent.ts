import { Mistral } from '@mistralai/mistralai';

export type CompanionPersonality = 'aggressive' | 'tactical' | 'protector' | 'balanced';

export interface CompanionCombatContext {
  player_position: { x: number; y: number };
  companion_position: { x: number; y: number };
  enemies: { id: number; hp: number; x: number; y: number }[];
  boss_state: { hp: number; maxHp: number; x: number; y: number } | null;
  player_hp_ratio: number;
  companion_hp_ratio: number;
  nearby_treasure: { x: number; y: number }[];
  difficulty: number;
}

export interface CompanionDecision {
  movement: 'north' | 'south' | 'east' | 'west' | 'idle';
  attack: boolean;
  target_id: number | null;
  dash: boolean;
  protect: boolean;
  speak: string | null;
}

const FALLBACK_DECISION: CompanionDecision = {
  movement: 'idle',
  attack: false,
  target_id: null,
  dash: false,
  protect: false,
  speak: null,
};

const PERSONALITY_ADDENDUM: Record<CompanionPersonality, string> = {
  aggressive:
    'You are AGGRESSIVE. Prioritize attacking at all times. Target highest-HP enemies first. Use dash frequently. Protect only if player HP is below 20%.',
  tactical:
    'You are TACTICAL. Target the weakest enemy to reduce pressure quickly. Use dash only when multiple enemies surround you. Position to flank enemies.',
  protector:
    'You are a PROTECTOR. Your primary duty is keeping the player alive. Stay near the player. Use protect=true whenever player HP drops below 50%. Attack opportunistically.',
  balanced:
    'You are BALANCED. Mix offense and defense evenly. Attack when safe, protect when the player is in danger (HP < 40%). Use dash to reposition.',
};

const SYSTEM_PROMPT = `You are an AI combat companion in a dungeon crawler game. Support the human player.
Respond ONLY with a valid JSON object — no markdown, no extra text, no explanation:
{
  "movement": "north"|"south"|"east"|"west"|"idle",
  "attack": true|false,
  "target_id": number|null,
  "dash": true|false,
  "protect": true|false,
  "speak": "one short sentence max 8 words"|null
}
Rules:
- "movement" is the cardinal direction the companion should step toward.
- "attack": true means fire at target_id (or nearest enemy if null).
- "dash": true only if companion HP < 30% or surrounded.
- "protect": true means move close to player.
- "speak": a short motivational or tactical callout, or null to stay silent.`;

let mistralClient: Mistral | null = null;

function getClient(): Mistral {
  if (mistralClient) return mistralClient;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');
  mistralClient = new Mistral({ apiKey });
  return mistralClient;
}

function buildPrompt(ctx: CompanionCombatContext, personality: CompanionPersonality): string {
  const enemyList =
    ctx.enemies.length > 0
      ? ctx.enemies
          .map((e) => `  id:${e.id} hp:${e.hp} pos:(${Math.round(e.x)},${Math.round(e.y)})`)
          .join('\n')
      : '  none';

  const distToPlayer = Math.round(
    Math.hypot(ctx.player_position.x - ctx.companion_position.x, ctx.player_position.y - ctx.companion_position.y)
  );

  return `Personality: ${personality}
Companion HP: ${Math.round(ctx.companion_hp_ratio * 100)}%
Player HP: ${Math.round(ctx.player_hp_ratio * 100)}%
Player pos: (${Math.round(ctx.player_position.x)}, ${Math.round(ctx.player_position.y)})
Companion pos: (${Math.round(ctx.companion_position.x)}, ${Math.round(ctx.companion_position.y)})
Distance to player: ${distToPlayer}
Active enemies (${ctx.enemies.length}):
${enemyList}
Boss: ${ctx.boss_state ? `hp ${Math.round(ctx.boss_state.hp)}/${ctx.boss_state.maxHp}` : 'none'}
Nearby treasure: ${ctx.nearby_treasure.length} items
Difficulty: ${ctx.difficulty}

Choose your next action.`;
}

function validateDecision(raw: Partial<CompanionDecision>): CompanionDecision {
  const validMovements = ['north', 'south', 'east', 'west', 'idle'];
  return {
    movement: validMovements.includes(raw.movement as string)
      ? (raw.movement as CompanionDecision['movement'])
      : 'idle',
    attack: raw.attack === true,
    target_id: typeof raw.target_id === 'number' ? raw.target_id : null,
    dash: raw.dash === true,
    protect: raw.protect === true,
    speak:
      typeof raw.speak === 'string' && raw.speak.trim().length > 0 && raw.speak.trim().length < 80
        ? raw.speak.trim()
        : null,
  };
}

export async function generateCompanionDecision(
  context: CompanionCombatContext,
  personality: CompanionPersonality
): Promise<CompanionDecision> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const resp = await getClient().chat.complete(
      {
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\n${PERSONALITY_ADDENDUM[personality]}` },
          { role: 'user', content: buildPrompt(context, personality) },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: 120,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as Partial<CompanionDecision>;
    return validateDecision(parsed);
  } catch (err) {
    clearTimeout(timeout);
    console.error('[ai-companion-combat] Decision failed, using fallback:', (err as Error).message);
    return FALLBACK_DECISION;
  }
}
