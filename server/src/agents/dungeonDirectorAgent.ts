import axios from 'axios';
import {
  TelemetryPayload,
  DirectorDecision,
  validateDirectorDecision,
  DEFAULT_DECISION,
} from './responseValidatorDirector.js';

const MISTRAL_MODEL = 'mistral-large-latest';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const TIMEOUT_MS = 5000;

// Per-session memory stored server-side
const sessionMemory = new Map<string, { lastDecision: DirectorDecision; callCount: number }>();

function buildPrompt(telemetry: TelemetryPayload, lastDecision: DirectorDecision | null): string {
  const hpPercent = Math.round((telemetry.playerHP / telemetry.playerMaxHP) * 100);
  const last = lastDecision ? `\n- Last AI decision: "${lastDecision.reason}"` : '';

  return `You are an AI Dungeon Director for a roguelike dungeon game called "Mistral Raid". Your mission is to keep the player in the "flow channel" — challenged but never frustrated, never bored.

## Current Game State
- Level: ${telemetry.level} | Rooms cleared this run: ${telemetry.roomsCleared}
- Player HP: ${telemetry.playerHP}/${telemetry.playerMaxHP} (${hpPercent}%)
- Enemies killed: ${telemetry.enemiesKilled} | Score: ${telemetry.score} | Coins: ${telemetry.coins}
- Damage dealt: ${telemetry.damageDealt.toFixed(1)} | Damage taken: ${telemetry.damageTaken.toFixed(1)}
- Play time: ${telemetry.playTimeSeconds.toFixed(0)}s | Character: ${telemetry.character} | Weapon: ${telemetry.weaponType}${last}

## Your Decision
Respond ONLY with valid JSON — no explanation outside the JSON:
{
  "difficultyDelta": <number from -0.3 to +0.3>,
  "enemyBias": <"melee" | "ranged" | "mixed" | "special" | "none">,
  "lootBias": <"health" | "offensive" | "coins" | "none">,
  "reason": <string, max 80 chars>
}

Guidelines:
- HP < 30%: ease difficulty (-0.1 to -0.2), lootBias="health"
- HP > 70% AND damageTaken < damageDealt * 0.3: increase difficulty (+0.1 to +0.2)
- Player is breezing (kills > 10, minimal damage taken): push harder, vary enemy types
- enemyBias "special" means exploders, shielded, and split-on-death enemies
- difficultyDelta affects enemy HP, speed, and count`;
}

export async function analyzeTelemetry(telemetry: TelemetryPayload): Promise<DirectorDecision> {
  console.log('📊 TELEMETRY RECEIVED:', JSON.stringify(telemetry, null, 2));

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.warn('[Director] No MISTRAL_API_KEY – returning default decision');
    return { ...DEFAULT_DECISION, reason: 'No API key configured' };
  }

  const mem = sessionMemory.get(telemetry.sessionId) ?? { lastDecision: null, callCount: 0 };
  const prompt = buildPrompt(telemetry, mem.lastDecision);

  try {
    const response = await axios.post(
      MISTRAL_URL,
      {
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[Director] Empty content from Mistral – returning default');
      return { ...DEFAULT_DECISION };
    }

    const parsed = JSON.parse(content);
    const decision = validateDirectorDecision(parsed);

    // Update session memory
    sessionMemory.set(telemetry.sessionId, {
      lastDecision: decision,
      callCount: mem.callCount + 1,
    });

    // Evict oldest sessions when map grows large
    if (sessionMemory.size > 200) {
      const firstKey = sessionMemory.keys().next().value;
      if (firstKey) sessionMemory.delete(firstKey);
    }

    console.log('🔥 AI DIRECTOR DECISION:', JSON.stringify(decision, null, 2));

    return decision;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        console.warn('[Director] ⏱ Mistral timeout after', TIMEOUT_MS, 'ms – returning default');
      } else {
        console.error('[Director] ❌ Axios error:', err.response?.status, err.response?.data ?? err.message);
      }
    } else {
      console.error('[Director] ❌ Unexpected error:', (err as Error).message);
    }
    return { ...DEFAULT_DECISION, reason: 'AI unavailable – baseline difficulty' };
  }
}
