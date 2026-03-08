import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSummary,
  clearTelemetryStateForTests,
  computeWindowStats,
  getSummary,
  ingest,
} from '../telemetryProcessor.js';
import type { RawTelemetry, Session } from '../../types.js';

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
    } as Session['ws'],
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
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

describe('telemetryProcessor', () => {
  beforeEach(() => {
    clearTelemetryStateForTests();
    vi.restoreAllMocks();
  });

  it('computes window stats for accuracy, corners, dashes, and dominant zone', () => {
    const stats = computeWindowStats([
      { sample: sample({ accuracy: 0.4, cornerPercentage: 0.1, playerZone: 'mid_center' }), dashDelta: 0, time: 0 },
      { sample: sample({ accuracy: 0.6, cornerPercentage: 0.3, playerZone: 'mid_center' }), dashDelta: 1, time: 1000 },
      { sample: sample({ accuracy: 0.5, cornerPercentage: 0.5, playerZone: 'top_left' }), dashDelta: 2, time: 2000 },
    ]);

    expect(stats.avgAccuracy).toBeCloseTo(0.5, 6);
    expect(stats.cornerPercentage).toBeCloseTo(0.3, 6);
    expect(stats.dashCount).toBe(3);
    expect(stats.dominantZone).toBe('mid_center');
    expect(stats.sampleCount).toBe(3);
    expect(stats.windowSeconds).toBeCloseTo(2, 6);
  });

  it('returns safe defaults when buildSummary has no samples', () => {
    const summary = buildSummary([], [], 123456);

    expect(summary.avgAccuracy).toBe(0);
    expect(summary.cornerPercentageLast10s).toBe(0);
    expect(summary.totalDashCount).toBe(0);
    expect(summary.sampleCount).toBe(0);
    expect(summary.dominantZone).toBe('center');
    expect(summary.longTerm.sampleCount).toBe(0);
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

  it('prunes samples older than the 10s recent window', () => {
    const session = createSession('recent-prune-session');
    let now = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    ingest(session, sample({ accuracy: 0.2, playerZone: 'top_left' }));
    now += 15_000;
    ingest(session, sample({ accuracy: 0.8, playerZone: 'bot_right' }));

    const summary = getSummary(session);
    expect(summary?.sampleCount).toBe(1);
    expect(summary?.avgAccuracy).toBeCloseTo(0.8, 6);
    expect(summary?.dominantZone).toBe('bot_right');
  });

  it('prunes samples older than the 120s long window', () => {
    const session = createSession('long-prune-session');
    let now = 200_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    ingest(session, sample({ accuracy: 0.1, dashCount: 0, playerZone: 'top_left' }));
    now += 130_000;
    ingest(session, sample({ accuracy: 0.9, dashCount: 2, playerZone: 'mid_center' }));

    const summary = getSummary(session);
    expect(summary?.sampleCount).toBe(1);
    expect(summary?.longTerm.sampleCount).toBe(1);
    expect(summary?.longTerm.avgAccuracy).toBeCloseTo(0.9, 6);
  });

  it('computes player and boss HP percentages from latest sample', () => {
    const recent = [{ sample: sample({ hp: 5, maxHp: 10, bossHp: 20, bossMaxHp: 40 }), dashDelta: 0, time: 0 }];
    const summary = buildSummary(recent, recent, 999);

    expect(summary.playerHpPercent).toBe(50);
    expect(summary.bossHpPercent).toBe(50);
    expect(summary.bossActive).toBe(true);
  });
});
