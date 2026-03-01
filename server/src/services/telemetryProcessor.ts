import type { RawTelemetry, Session, TelemetrySummary } from '../types.js';

interface SampleEntry {
  sample: RawTelemetry;
  dashDelta: number;
  time: number;
}

interface SessionTelemetryState {
  samples: SampleEntry[];
  lastSummaryAt: number;
  lastDashCount: number | null;
}

const telemetryState = new Map<string, SessionTelemetryState>();

const SUMMARY_INTERVAL_MS = 1000;
const MAX_SAMPLES = 12;

function getState(sessionId: string): SessionTelemetryState {
  const existing = telemetryState.get(sessionId);
  if (existing) return existing;
  const state: SessionTelemetryState = {
    samples: [],
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

  state.samples.push({ sample: raw, dashDelta, time: now });
  if (state.samples.length > MAX_SAMPLES) state.samples.shift();

  if (now - state.lastSummaryAt >= SUMMARY_INTERVAL_MS) {
    state.lastSummaryAt = now;
    session.latestTelemetrySummary = buildSummary(state.samples, now);
  }
}

export function getSummary(session: Session): TelemetrySummary | null {
  return session.latestTelemetrySummary;
}

function buildSummary(samples: SampleEntry[], timestamp: number): TelemetrySummary {
  if (!samples.length) {
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

  const latest = samples[samples.length - 1]?.sample;
  const dominantZone = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'center';
  const bossHpPercent = latest?.bossHp && latest?.bossMaxHp
    ? Math.max(0, Math.min(100, (latest.bossHp / latest.bossMaxHp) * 100))
    : 0;
  const playerHpPercent = latest?.maxHp
    ? Math.max(0, Math.min(100, (latest.hp / latest.maxHp) * 100))
    : 0;

  return {
    avgAccuracy: accuracySum / samples.length,
    cornerPercentageLast10s: cornerSum / samples.length,
    totalDashCount: dashSum,
    recentHitsTaken: latest?.recentHitsTaken ?? 0,
    dominantZone,
    bossHpPercent,
    playerHpPercent,
    sampleCount: samples.length,
    timestamp,
  };
}
