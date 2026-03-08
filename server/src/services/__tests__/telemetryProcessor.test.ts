import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSummary,
  clearTelemetryStateForTests,
  computeWindowStats,
  getSummary,
  ingest,
} from '../telemetryProcessor.js';
import type { RawTelemetry, Session, SessionTelemetryState, SampleEntry } from '../../types.js';

function createSession(id: string): Session {
  return {
    id,
    turnState: 'LISTENING',
    aiState: 'listening',
    partialTranscript: '',
    stableTranscript: '',
    latestTelemetrySummary: null,
    rollingDebateNotes: '',
    activeLLMAbort: null,
    activeTTSAbort: null,
    lastSpeechEndTime: 0,
    lastBossSpeechTime: 0,
    ws: {
      OPEN: 1,
      readyState: 1,
      send: vi.fn(),
    } as any,
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
    // Story state (RM-4, RM-5)
    levelTag: 'unknown',
    loreDiscovered: [],
    bossHistory: [],
    playerClass: 'knight',
    sanctumReached: false,
  };
}

function sample(overrides: Partial<RawTelemetry> = {}): RawTelemetry {
  return {
    hp: 8,
    maxHp: 10,
    bossHp: 40,
    bossMaxHp: 80,
    accuracy: 0,
    recentMissStreak: 0,
    recentHitsTaken: 0,
    cornerPercentage: 0,
    dashCount: 0,
    playerZone: 'mid_center',
    ...overrides,
  };
}

function createDefaultState(): SessionTelemetryState {
  return {
    recentSamples: [],
    longSamples: [],
    lastSummaryAt: 0,
    lastDashCount: null,
    lastLoreInteractionCount: null,
    lastLoreReadTime: null,
    lastSkippedLore: null,
    lastRetreatDistance: null,
    sessionDashCount: 0,
    sessionLoreInteractionCount: 0,
    sessionLoreReadTimeSum: 0,
    sessionLoreReadTimeCount: 0,
    sessionSkippedLore: 0,
    sessionRetreatDistance: 0,
  };
}

function createEntry(s: RawTelemetry, time: number): SampleEntry {
  return {
    sample: s,
    dashDelta: 0,
    loreInteractionDelta: 0,
    loreReadTimeDelta: 0,
    skippedLoreDelta: 0,
    retreatDelta: 0,
    time
  };
}

describe('telemetryProcessor', () => {
  beforeEach(() => {
    clearTelemetryStateForTests();
    vi.restoreAllMocks();
  });

  it('computes window stats for accuracy, corners, dashes, and dominant zone', () => {
    const stats = computeWindowStats([
      { ...createEntry(sample({ accuracy: 0.4, cornerPercentage: 0.1, playerZone: 'mid_center' }), 0), dashDelta: 0 },
      { ...createEntry(sample({ accuracy: 0.6, cornerPercentage: 0.3, playerZone: 'mid_center' }), 1000), dashDelta: 1 },
      { ...createEntry(sample({ accuracy: 0.5, cornerPercentage: 0.5, playerZone: 'top_left' }), 2000), dashDelta: 2 },
    ]);

    expect(stats.avgAccuracy).toBeCloseTo(0.5, 6);
    expect(stats.cornerPercentage).toBeCloseTo(0.3, 6);
    expect(stats.dashCount).toBe(3);
    expect(stats.dominantZone).toBe('mid_center');
    expect(stats.sampleCount).toBe(3);
    expect(stats.windowSeconds).toBeCloseTo(2, 6);
  });

  it('returns safe defaults when buildSummary has no samples', () => {
    const summary = buildSummary(createDefaultState(), 123456);

    expect(summary.avgAccuracy).toBe(0);
    expect(summary.cornerPercentageLast10s).toBe(0);
    expect(summary.totalDashCount).toBe(0);
    expect(summary.sampleCount).toBe(0);
    expect(summary.dominantZone).toBe('center');
    expect(summary.timestamp).toBe(123456);
  });

  it('tracks dash deltas and updates summary through ingest()', () => {
    const session = createSession('dash-session');
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    ingest(session, sample({ dashCount: 2, accuracy: 0.5, playerZone: 'mid_center' }));
    now = 2_500;
    ingest(session, sample({ dashCount: 5, accuracy: 0.5, playerZone: 'mid_center' }));

    const summary = getSummary(session);
    expect(summary).not.toBeNull();
    expect(summary?.totalDashCount).toBe(3);
    expect(summary?.avgAccuracy).toBeCloseTo(0.5, 6);
    expect(summary?.dominantZone).toBe('mid_center');
  });

  it('computes player and boss HP percentages from latest sample', () => {
    const entry = createEntry(sample({ hp: 5, maxHp: 10, bossHp: 20, bossMaxHp: 40 }), 0);
    const state = createDefaultState();
    state.recentSamples.push(entry);
    const summary = buildSummary(state, 999);

    expect(summary.playerHpPercent).toBe(50);
    expect(summary.bossHpPercent).toBe(50);
  });
});
