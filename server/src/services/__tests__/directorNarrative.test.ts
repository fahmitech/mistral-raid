/**
 * RM-3: Unit Tests for directorNarrative.ts
 * Tests every mapping case: delta + enemyBias combinations + edge cases.
 */

import { describe, expect, it } from 'vitest';
import { buildNarrativeLabel } from '../directorNarrative.js';
import type { TelemetrySummary } from '../../types.js';

function makeTelemetry(overrides: Partial<TelemetrySummary> = {}): TelemetrySummary {
    return {
        avgAccuracy: 0.4,
        cornerPercentageLast10s: 10,
        totalDashCount: 3,
        recentHitsTaken: 1,
        dominantZone: 'mid_center',
        bossHpPercent: 50,
        playerHpPercent: 70,
        sampleCount: 20,
        timestamp: Date.now(),
        bossActive: true,
        wallBias: 20,
        longTerm: {
            avgAccuracy: 0.4,
            cornerPercentage: 10,
            dashPerMin: 2,
            dominantZone: 'mid_center',
            sampleCount: 100,
            windowSeconds: 90,
        },
        ...overrides,
    };
}

// ── Increasing pressure (difficultyDelta > 0) ────────────────────────────────

describe('buildNarrativeLabel — difficultyDelta > 0', () => {
    it('returns punishing_passivity when wall bias is high', () => {
        const result = buildNarrativeLabel(1, 'mixed', makeTelemetry({ wallBias: 60 }));
        expect(result.narrativeLabel).toBe('punishing_passivity');
        expect(result.narrativeLine).toContain('impatient');
    });

    it('returns escalating_commitment when player accuracy is high', () => {
        const result = buildNarrativeLabel(1, 'mixed', makeTelemetry({ avgAccuracy: 0.7 }));
        expect(result.narrativeLabel).toBe('escalating_commitment');
        expect(result.narrativeLine).toContain('skill');
    });

    it('returns testing_caution when enemyBias is ranged', () => {
        const result = buildNarrativeLabel(1, 'ranged', makeTelemetry());
        expect(result.narrativeLabel).toBe('testing_caution');
    });

    it('returns demanding_proximity when enemyBias is melee', () => {
        const result = buildNarrativeLabel(1, 'melee', makeTelemetry());
        expect(result.narrativeLabel).toBe('demanding_proximity');
    });

    it('returns escalating_pressure as generic fallback', () => {
        const result = buildNarrativeLabel(1, 'mixed', makeTelemetry());
        expect(result.narrativeLabel).toBe('escalating_pressure');
        expect(result.narrativeLine).toContain('walls');
    });
});

// ── Easing off (difficultyDelta < 0) ─────────────────────────────────────────

describe('buildNarrativeLabel — difficultyDelta < 0', () => {
    it('returns testing_limits when player HP is critical', () => {
        const result = buildNarrativeLabel(-1, 'mixed', makeTelemetry({ playerHpPercent: 15 }));
        expect(result.narrativeLabel).toBe('testing_limits');
        expect(result.narrativeLine).toContain('recover');
    });

    it('returns granting_breath as generic fallback', () => {
        const result = buildNarrativeLabel(-1, 'mixed', makeTelemetry({ playerHpPercent: 80 }));
        expect(result.narrativeLabel).toBe('granting_breath');
        expect(result.narrativeLine).toContain('predators');
    });
});

// ── Holding steady (difficultyDelta == 0) ────────────────────────────────────

describe('buildNarrativeLabel — difficultyDelta == 0', () => {
    it('returns maintaining_distance when bias is ranged', () => {
        const result = buildNarrativeLabel(0, 'ranged', null);
        expect(result.narrativeLabel).toBe('maintaining_distance');
    });

    it('returns maintaining_proximity when bias is melee', () => {
        const result = buildNarrativeLabel(0, 'melee', null);
        expect(result.narrativeLabel).toBe('maintaining_proximity');
    });

    it('returns observing as default for steady/mixed', () => {
        const result = buildNarrativeLabel(0, 'mixed', null);
        expect(result.narrativeLabel).toBe('observing');
        expect(result.narrativeLine).toContain('watching');
    });
});

// ── Null telemetry handling ──────────────────────────────────────────────────

describe('buildNarrativeLabel — null telemetry', () => {
    it('handles null telemetry without throwing', () => {
        expect(() => buildNarrativeLabel(1, 'mixed', null)).not.toThrow();
        expect(() => buildNarrativeLabel(-1, 'mixed', null)).not.toThrow();
        expect(() => buildNarrativeLabel(0, 'mixed', null)).not.toThrow();
    });

    it('returns escalating_pressure with delta=1 and null telemetry', () => {
        const result = buildNarrativeLabel(1, 'mixed', null);
        expect(result.narrativeLabel).toBe('escalating_pressure');
    });
});
