/**
 * RM-2: Player Profile Service
 *
 * Converts raw TelemetrySummary into a human-readable psychological profile
 * of the player. All classification is deterministic — no LLM call.
 * This profile is injected into the Watcher AI prompt so the boss can
 * speak about the player's personality rather than raw numbers.
 */

import type { TelemetrySummary, PlayerProfile } from '../types.js';

// ── Thresholds ───────────────────────────────────────────────────────────────

const AGGRESSION = {
    reckless: { accuracy: 0.65, dashes: 3 },   // high accuracy + many dashes
    aggressive: { accuracy: 0.45, dashes: 2 },
    cautious: { accuracy: 0.25, dashes: 1 },
    passive: { accuracy: 0, dashes: 0 },
};

const WALL_BIAS_THRESHOLDS = {
    wall_reliant: 50,  // % of time near walls
    center_preferring: 20,  // wall bias & not in corner
    corner_locked: 0,  // handled separately via cornerPercentage
};

/**
 * Classify aggression: based on accuracy (how well they hit) and
 * evasion rate (how often they dash).
 */
function classifyAggression(t: TelemetrySummary): PlayerProfile['aggression'] {
    const acc = t.avgAccuracy;
    const dashPerMin = t.longTerm.dashPerMin;

    if (acc >= AGGRESSION.reckless.accuracy && dashPerMin >= AGGRESSION.reckless.dashes) return 'reckless';
    if (acc >= AGGRESSION.aggressive.accuracy && dashPerMin >= AGGRESSION.aggressive.dashes) return 'aggressive';
    if (acc >= AGGRESSION.aggressive.accuracy && dashPerMin < AGGRESSION.cautious.dashes) return 'balanced';
    if (acc >= AGGRESSION.cautious.accuracy) return 'cautious';
    return 'passive';
}

/**
 * Classify movement style: how the player uses the arena space.
 */
function classifyMovementStyle(t: TelemetrySummary): PlayerProfile['movementStyle'] {
    const corner = t.cornerPercentageLast10s;
    const wallBias = t.wallBias ?? 0;
    const dashPerMin = t.longTerm.dashPerMin;

    if (corner > 40) return 'static';
    if (wallBias > 55 && dashPerMin > 2) return 'evasive';
    if (dashPerMin > 4 && corner < 20) return 'erratic';
    return 'methodical';
}

/**
 * Classify lore engagement.
 */
function classifyLoreBehavior(t: TelemetrySummary): PlayerProfile['loreBehavior'] {
    const interactions = t.loreInteractionCount ?? 0;
    const skipped = t.skippedMandatoryLore ?? 0;
    const avgReadTime = t.avgTimeReadingLore ?? 0;

    if (interactions === 0 && skipped === 0) return 'ignorant';
    if (skipped > 2) return 'dismissive';
    if (interactions >= 3 && avgReadTime > 8) return 'obsessive';
    if (interactions >= 1 && avgReadTime > 3) return 'engaged';
    return 'selective';
}

/**
 * Classify panic response: how the player reacts under pressure.
 * Uses retreat distance and hit frequency as proxies for panic.
 */
function classifyPanicResponse(t: TelemetrySummary): PlayerProfile['panicResponse'] {
    const hits = t.recentHitsTaken;
    const retreatPx = t.retreatDistance ?? 0;  // cumulative px moved away from boss
    const dashPerMin = t.longTerm.dashPerMin;

    if (hits === 0 && retreatPx < 100) return 'composed';
    if (retreatPx > 500 && dashPerMin > 3) return 'erratic';
    if (retreatPx > 200) return 'reactive';
    return 'freezing';
}

/**
 * Classify environment usage (how they interact with arena boundaries).
 */
function classifyEnvironmentUsage(t: TelemetrySummary): PlayerProfile['environmentUsage'] {
    const wallBias = t.wallBias ?? 0;
    const corner = t.cornerPercentageLast10s;
    const zone = t.dominantZone;

    if (corner > 35) return 'corner_locked';
    if (wallBias > WALL_BIAS_THRESHOLDS.wall_reliant) return 'wall_reliant';
    if (zone === 'mid_center' && wallBias < WALL_BIAS_THRESHOLDS.center_preferring) return 'center_preferring';
    return 'roaming';
}

/**
 * Classify healing style.
 * Placeholder until healing mechanic data is available in telemetry.
 */
function classifyHealingStyle(_t: TelemetrySummary): PlayerProfile['healingStyle'] {
    return 'none';
}

/**
 * Build a complete PlayerProfile from a TelemetrySummary.
 * All classification is deterministic and instant — no LLM needed.
 */
export function buildPlayerProfile(t: TelemetrySummary): PlayerProfile {
    return {
        aggression: classifyAggression(t),
        movementStyle: classifyMovementStyle(t),
        loreBehavior: classifyLoreBehavior(t),
        panicResponse: classifyPanicResponse(t),
        environmentUsage: classifyEnvironmentUsage(t),
        healingStyle: classifyHealingStyle(t),
    };
}

/**
 * Format the PlayerProfile as a compact string block for LLM prompts.
 */
export function formatProfileForPrompt(profile: PlayerProfile): string {
    return [
        `Psychological profile:`,
        `- Aggression:         ${profile.aggression}`,
        `- Movement style:     ${profile.movementStyle}`,
        `- Lore engagement:    ${profile.loreBehavior}`,
        `- Panic response:     ${profile.panicResponse}`,
        `- Environment usage:  ${profile.environmentUsage}`,
        `- Healing style:      ${profile.healingStyle}`,
    ].join('\n');
}
