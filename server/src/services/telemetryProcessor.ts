import type { RawTelemetry, Session, TelemetrySummary } from '../types.js';
import { emit, makeEvent } from './telemetry.js';

interface SampleEntry {
  sample: RawTelemetry;
  dashDelta: number;
  time: number;
}

interface SessionTelemetryState {
  recentSamples: SampleEntry[];
  longSamples: SampleEntry[];
  lastSummaryAt: number;
  lastDashCount: number | null;
}

const telemetryState = new Map<string, SessionTelemetryState>();

const SUMMARY_INTERVAL_MS = 1000;
const RECENT_WINDOW_MS = 10_000;
const LONG_WINDOW_MS = 120_000;

function getState(sessionId: string): SessionTelemetryState {
  const existing = telemetryState.get(sessionId);
  if (existing) return existing;
  const state: SessionTelemetryState = {
    recentSamples: [],
    longSamples: [],
    lastSummaryAt: 0,
    lastDashCount: null,
  };
  telemetryState.set(sessionId, state);
  return state;
}

export function ingest(session: Session, raw: RawTelemetry): void {
  const state = getState(session.id);
  const now = Date.now();
  const lastDash = state.lastDashCount ?? raw.dashCount;
  const dashDelta = Math.max(0, raw.dashCount - lastDash);
  state.lastDashCount = raw.dashCount;

  const entry = { sample: raw, dashDelta, time: now };
  state.recentSamples.push(entry);
  state.longSamples.push(entry);
  pruneSamples(state.recentSamples, now - RECENT_WINDOW_MS);
  pruneSamples(state.longSamples, now - LONG_WINDOW_MS);

  if (now - state.lastSummaryAt >= SUMMARY_INTERVAL_MS) {
    state.lastSummaryAt = now;
    session.latestTelemetrySummary = buildSummary(state.recentSamples, state.longSamples, now);
    emit(makeEvent(session.id, 'telemetry', 'telemetry.ingest', {
      sampleCount: state.recentSamples.length,
      playerHpPercent: session.latestTelemetrySummary.playerHpPercent,
      bossHpPercent: session.latestTelemetrySummary.bossHpPercent,
    }));
  }
}

export function getSummary(session: Session): TelemetrySummary | null {
  return session.latestTelemetrySummary;
}

function buildSummary(recentSamples: SampleEntry[], longSamples: SampleEntry[], timestamp: number): TelemetrySummary {
  if (!recentSamples.length && !longSamples.length) {
    return {
      avgAccuracy: 0,
      cornerPercentageLast10s: 0,
      totalDashCount: 0,
      recentHitsTaken: 0,
      dominantZone: 'center',
      bossHpPercent: 0,
      playerHpPercent: 0,
      sampleCount: 0,
      timestamp,
      bossActive: false,
      longTerm: {
        avgAccuracy: 0,
        cornerPercentage: 0,
        dashPerMin: 0,
        dominantZone: 'center',
        sampleCount: 0,
        windowSeconds: 0,
      },
    };
  }

  const recent = computeWindowStats(recentSamples);
  const longRaw = computeWindowStats(longSamples);
  const long = longRaw.sampleCount ? longRaw : recent;

  const latest = (recentSamples[recentSamples.length - 1] ?? longSamples[longSamples.length - 1])?.sample;
  const bossActive = typeof latest?.bossMaxHp === 'number' && latest.bossMaxHp > 0;
  const bossHpPercent = bossActive && typeof latest?.bossHp === 'number'
    ? Math.max(0, Math.min(100, (latest.bossHp / latest.bossMaxHp!) * 100))
    : 0;
  const playerHpPercent = typeof latest?.maxHp === 'number' && latest.maxHp > 0
    ? Math.max(0, Math.min(100, (latest.hp / latest.maxHp) * 100))
    : 0;

  return {
    avgAccuracy: recent.avgAccuracy,
    cornerPercentageLast10s: recent.cornerPercentage,
    totalDashCount: recent.dashCount,
    recentHitsTaken: latest?.recentHitsTaken ?? 0,
    dominantZone: recent.dominantZone,
    bossHpPercent,
    playerHpPercent,
    sampleCount: recent.sampleCount,
    timestamp,
    bossActive,
    longTerm: {
      avgAccuracy: long.avgAccuracy,
      cornerPercentage: long.cornerPercentage,
      dashPerMin: long.windowSeconds > 0 ? (long.dashCount / long.windowSeconds) * 60 : 0,
      dominantZone: long.dominantZone,
      sampleCount: long.sampleCount,
      windowSeconds: long.windowSeconds,
    },
  };
}

function pruneSamples(samples: SampleEntry[], cutoff: number): void {
  while (samples.length && samples[0].time < cutoff) {
    samples.shift();
  }
}

function computeWindowStats(samples: SampleEntry[]): {
  avgAccuracy: number;
  cornerPercentage: number;
  dashCount: number;
  dominantZone: string;
  sampleCount: number;
  windowSeconds: number;
} {
  if (!samples.length) {
    return {
      avgAccuracy: 0,
      cornerPercentage: 0,
      dashCount: 0,
      dominantZone: 'center',
      sampleCount: 0,
      windowSeconds: 0,
    };
  }

  let accuracySum = 0;
  let cornerSum = 0;
  let dashSum = 0;
  const zoneCounts = new Map<string, number>();

  for (const entry of samples) {
    accuracySum += entry.sample.accuracy;
    cornerSum += entry.sample.cornerPercentage;
    dashSum += entry.dashDelta;
    const zone = entry.sample.playerZone;
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
  }

  const dominantZone = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'center';
  const first = samples[0];
  const last = samples[samples.length - 1];
  const windowSeconds = Math.max(0, (last.time - first.time) / 1000);

  return {
    avgAccuracy: accuracySum / samples.length,
    cornerPercentage: cornerSum / samples.length,
    dashCount: dashSum,
    dominantZone,
    sampleCount: samples.length,
    windowSeconds,
  };
}
