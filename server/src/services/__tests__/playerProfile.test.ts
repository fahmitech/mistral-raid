/**
 * RM-2: Unit Tests for playerProfile.ts
 * Tests all 6 classification dimensions with known telemetry inputs.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile, formatProfileForPrompt } from '../playerProfile.js';
import type { TelemetrySummary } from '../../types.js';

function makeTelemetry(overrides: Partial<TelemetrySummary> = {}): TelemetrySummary {
    return {
        avgAccuracy: 0.5,
        cornerPercentageLast10s: 10,
        totalDashCount: 5,
        recentHitsTaken: 1,
        dominantZone: 'mid_center',
        bossHpPercent: 50,
        playerHpPercent: 70,
        sampleCount: 20,
        timestamp: Date.now(),
        bossActive: true,
        loreInteractionCount: 0,
        avgTimeReadingLore: 0,
        skippedMandatoryLore: 0,
        retreatDistance: 0,
        wallBias: 20,
        longTerm: {
            avgAccuracy: 0.5,
            cornerPercentage: 10,
            dashPerMin: 2,
            dominantZone: 'mid_center',
            sampleCount: 100,
            windowSeconds: 90,
        },
        ...overrides,
    };
}

// ── Aggression ───────────────────────────────────────────────────────────────

describe('buildPlayerProfile — aggression', () => {
    it('classifies reckless when accuracy >= 0.65 and dashPerMin >= 3', () => {
        const t = makeTelemetry({ avgAccuracy: 0.7, longTerm: { avgAccuracy: 0.7, cornerPercentage: 10, dashPerMin: 4, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).aggression).toBe('reckless');
    });

    it('classifies aggressive when accuracy >= 0.45 and dashPerMin >= 2', () => {
        const t = makeTelemetry({ avgAccuracy: 0.5, longTerm: { avgAccuracy: 0.5, cornerPercentage: 10, dashPerMin: 2, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).aggression).toBe('aggressive');
    });

    it('classifies passive when accuracy is very low', () => {
        const t = makeTelemetry({ avgAccuracy: 0.05, longTerm: { avgAccuracy: 0.05, cornerPercentage: 10, dashPerMin: 0.5, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).aggression).toBe('passive');
    });
});

// ── Movement Style ───────────────────────────────────────────────────────────

describe('buildPlayerProfile — movementStyle', () => {
    it('classifies static when cornerPercentage > 40', () => {
        const t = makeTelemetry({ cornerPercentageLast10s: 50 });
        expect(buildPlayerProfile(t).movementStyle).toBe('static');
    });

    it('classifies evasive when wallBias > 55 and dashPerMin > 2', () => {
        const t = makeTelemetry({ wallBias: 60, longTerm: { avgAccuracy: 0.5, cornerPercentage: 10, dashPerMin: 3, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).movementStyle).toBe('evasive');
    });

    it('classifies erratic when dashPerMin > 4 and corner < 20', () => {
        const t = makeTelemetry({ cornerPercentageLast10s: 5, longTerm: { avgAccuracy: 0.5, cornerPercentage: 5, dashPerMin: 5, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).movementStyle).toBe('erratic');
    });

    it('classifies methodical as default', () => {
        const t = makeTelemetry({ wallBias: 20, cornerPercentageLast10s: 10, longTerm: { avgAccuracy: 0.5, cornerPercentage: 10, dashPerMin: 2, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).movementStyle).toBe('methodical');
    });
});

// ── Lore Behavior ────────────────────────────────────────────────────────────

describe('buildPlayerProfile — loreBehavior', () => {
    it('classifies ignorant when no interactions and no skips', () => {
        const t = makeTelemetry({ loreInteractionCount: 0, skippedMandatoryLore: 0 });
        expect(buildPlayerProfile(t).loreBehavior).toBe('ignorant');
    });

    it('classifies dismissive when skipped > 2', () => {
        const t = makeTelemetry({ loreInteractionCount: 1, skippedMandatoryLore: 3 });
        expect(buildPlayerProfile(t).loreBehavior).toBe('dismissive');
    });

    it('classifies obsessive when 3+ interactions and avgReadTime > 8s', () => {
        const t = makeTelemetry({ loreInteractionCount: 4, avgTimeReadingLore: 12 });
        expect(buildPlayerProfile(t).loreBehavior).toBe('obsessive');
    });

    it('classifies engaged when 1+ interactions and avgReadTime > 3s', () => {
        const t = makeTelemetry({ loreInteractionCount: 2, avgTimeReadingLore: 5 });
        expect(buildPlayerProfile(t).loreBehavior).toBe('engaged');
    });

    it('classifies selective when interacted but short read time', () => {
        const t = makeTelemetry({ loreInteractionCount: 1, avgTimeReadingLore: 1 });
        expect(buildPlayerProfile(t).loreBehavior).toBe('selective');
    });
});

// ── Panic Response ───────────────────────────────────────────────────────────

describe('buildPlayerProfile — panicResponse', () => {
    it('classifies composed when no hits and low retreat', () => {
        const t = makeTelemetry({ recentHitsTaken: 0, retreatDistance: 50 });
        expect(buildPlayerProfile(t).panicResponse).toBe('composed');
    });

    it('classifies reactive when moderate retreat', () => {
        const t = makeTelemetry({ recentHitsTaken: 2, retreatDistance: 300 });
        expect(buildPlayerProfile(t).panicResponse).toBe('reactive');
    });

    it('classifies erratic when high retreat and high dash rate', () => {
        const t = makeTelemetry({ recentHitsTaken: 5, retreatDistance: 800, longTerm: { avgAccuracy: 0.3, cornerPercentage: 10, dashPerMin: 5, dominantZone: 'mid_center', sampleCount: 100, windowSeconds: 90 } });
        expect(buildPlayerProfile(t).panicResponse).toBe('erratic');
    });
});

// ── Environment Usage ────────────────────────────────────────────────────────

describe('buildPlayerProfile — environmentUsage', () => {
    it('classifies corner_locked when corner > 35', () => {
        const t = makeTelemetry({ cornerPercentageLast10s: 40 });
        expect(buildPlayerProfile(t).environmentUsage).toBe('corner_locked');
    });

    it('classifies wall_reliant when wallBias > 50', () => {
        const t = makeTelemetry({ wallBias: 55, cornerPercentageLast10s: 5 });
        expect(buildPlayerProfile(t).environmentUsage).toBe('wall_reliant');
    });

    it('classifies center_preferring when zone is mid_center and wallBias is low', () => {
        const t = makeTelemetry({ dominantZone: 'mid_center', wallBias: 10, cornerPercentageLast10s: 5 });
        expect(buildPlayerProfile(t).environmentUsage).toBe('center_preferring');
    });

    it('classifies roaming as default', () => {
        const t = makeTelemetry({ dominantZone: 'bot_left', wallBias: 30, cornerPercentageLast10s: 15 });
        expect(buildPlayerProfile(t).environmentUsage).toBe('roaming');
    });
});

// ── Format for prompt ────────────────────────────────────────────────────────

describe('formatProfileForPrompt', () => {
    it('includes all 6 dimensions in the output string', () => {
        const t = makeTelemetry();
        const profile = buildPlayerProfile(t);
        const formatted = formatProfileForPrompt(profile);

        expect(formatted).toContain('Aggression:');
        expect(formatted).toContain('Movement style:');
        expect(formatted).toContain('Lore engagement:');
        expect(formatted).toContain('Panic response:');
        expect(formatted).toContain('Environment usage:');
        expect(formatted).toContain('Healing style:');
    });
});
