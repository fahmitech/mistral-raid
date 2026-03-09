/**
 * RM-3: Director Narrative Translation Layer
 *
 * Translates the AI Director's mechanical output (difficultyDelta, enemyBias)
 * into story-language labels and dungeon dialogue lines.
 *
 * This makes the dungeon feel like it is *studying* the player rather than
 * adjusting a difficulty slider. No additional LLM call needed.
 */

import type { TelemetrySummary, DirectorNarrativeResult } from '../types.js';

// ── Narrative Mapping ───────────────────────────────────────────────────────

/**
 * Produce a narrative label and dialogue line from a Director decision.
 *
 * Priority: specific conditions first (player state + difficulty combo),
 * then enemy bias overrides, then generic delta fallback.
 */
export function buildNarrativeLabel(
    difficultyDelta: number,
    enemyBias: string,
    telemetry: TelemetrySummary | null
): DirectorNarrativeResult {
    const wallBias = telemetry?.wallBias ?? 0;
    const accuracy = telemetry?.avgAccuracy ?? 0;
    const playerHp = telemetry?.playerHpPercent ?? 100;

    // ── Increasing pressure ────────────────────────────────────────
    if (difficultyDelta > 0) {
        if (wallBias > 50) {
            return {
                narrativeLabel: 'punishing_passivity',
                narrativeLine: 'The dungeon grows impatient with your hesitation.',
            };
        }
        if (accuracy > 0.65) {
            return {
                narrativeLabel: 'escalating_commitment',
                narrativeLine: 'Your skill has not gone unnoticed. The dungeon responds in kind.',
            };
        }
        if (enemyBias === 'ranged') {
            return {
                narrativeLabel: 'testing_caution',
                narrativeLine: 'Something shifts. The threats now keep their distance.',
            };
        }
        if (enemyBias === 'melee') {
            return {
                narrativeLabel: 'demanding_proximity',
                narrativeLine: 'The dungeon brings its horrors close.',
            };
        }
        return {
            narrativeLabel: 'escalating_pressure',
            narrativeLine: 'The walls close in.',
        };
    }

    // ── Easing off ─────────────────────────────────────────────────
    if (difficultyDelta < 0) {
        if (playerHp < 25) {
            return {
                narrativeLabel: 'testing_limits',
                narrativeLine: 'The dungeon watches you recover. It is curious.',
            };
        }
        return {
            narrativeLabel: 'granting_breath',
            narrativeLine: 'Even predators let their prey rest.',
        };
    }

    // ── Holding steady ─────────────────────────────────────────────
    if (enemyBias === 'ranged') {
        return {
            narrativeLabel: 'maintaining_distance',
            narrativeLine: 'The dungeon watches. From a distance.',
        };
    }
    if (enemyBias === 'melee') {
        return {
            narrativeLabel: 'maintaining_proximity',
            narrativeLine: 'The dungeon keeps its creatures close.',
        };
    }

    return {
        narrativeLabel: 'observing',
        narrativeLine: 'The dungeon makes no move. It is still watching.',
    };
}
