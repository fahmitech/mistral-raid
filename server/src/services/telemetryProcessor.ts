import type { RawTelemetry, Session, TelemetrySummary, SampleEntry, SessionTelemetryState } from '../types.js';
import { logger } from './loggingService.js';

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
    logCounter: 0,
  };
  telemetryState.set(sessionId, state);
  return state;
}

export function ingest(session: Session, raw: RawTelemetry): void {
  const state = getState(session.id);
  const now = Date.now();

  // Log raw telemetry to production log file (Sampled 1 in 10)
  state.logCounter++;
  if (state.logCounter % 10 === 0) {
    logger.writeLog('telemetry', { sessionId: session.id, raw });
  }

  const lastDash = state.lastDashCount ?? 0;
  const dashDelta = Math.max(0, raw.dashCount - lastDash);
  state.lastDashCount = raw.dashCount;

  const lastLoreInt = state.lastLoreInteractionCount ?? 0;
  const loreInteractionDelta = Math.max(0, (raw.loreInteractionCount ?? 0) - lastLoreInt);
  state.lastLoreInteractionCount = raw.loreInteractionCount ?? 0;

  const lastReadTime = state.lastLoreReadTime ?? 0;
  const loreReadTimeDelta = Math.max(0, (raw.timeSpentReadingLore ?? 0) - lastReadTime);
  state.lastLoreReadTime = raw.timeSpentReadingLore ?? 0;

  const lastSkipped = state.lastSkippedLore ?? 0;
  const skippedLoreDelta = Math.max(0, (raw.skippedMandatoryLore ?? 0) - lastSkipped);
  state.lastSkippedLore = raw.skippedMandatoryLore ?? 0;

  const lastRetreat = state.lastRetreatDistance ?? 0;
  const retreatDelta = Math.max(0, (raw.retreatDistance ?? 0) - lastRetreat);
  state.lastRetreatDistance = raw.retreatDistance ?? 0;

  // Update session totals
  state.sessionDashCount += dashDelta;
  state.sessionLoreInteractionCount += loreInteractionDelta;
  state.sessionLoreReadTimeSum += loreReadTimeDelta;
  if (loreReadTimeDelta > 0) state.sessionLoreReadTimeCount += 1;
  state.sessionSkippedLore += skippedLoreDelta;
  state.sessionRetreatDistance += retreatDelta;

  const entry: SampleEntry = {
    sample: raw,
    dashDelta,
    loreInteractionDelta,
    loreReadTimeDelta,
    skippedLoreDelta,
    retreatDelta,
    time: now
  };

  state.recentSamples.push(entry);
  state.longSamples.push(entry);
  pruneSamples(state.recentSamples, now - RECENT_WINDOW_MS);
  pruneSamples(state.longSamples, now - LONG_WINDOW_MS);

  if (now - state.lastSummaryAt >= SUMMARY_INTERVAL_MS) {
    state.lastSummaryAt = now;
    session.latestTelemetrySummary = buildSummary(state, now);
  }
}

export function getSummary(session: Session): TelemetrySummary | null {
  return session.latestTelemetrySummary;
}

export function buildSummary(state: SessionTelemetryState, timestamp: number): TelemetrySummary {
  const { recentSamples, longSamples } = state;
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
      loreInteractionCount: 0,
      avgTimeReadingLore: 0,
      avgLoreLingerTime: 0,
      skippedMandatoryLore: 0,
      retreatDistance: 0,
      wallBias: 0,
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
  const bossMaxHp = typeof latest?.bossMaxHp === 'number' ? latest.bossMaxHp : 0;
  const bossActive = bossMaxHp > 0;
  const bossHpPercent = bossActive && typeof latest?.bossHp === 'number'
    ? Math.max(0, Math.min(100, (latest.bossHp / bossMaxHp) * 100))
    : 0;
  const playerHpPercent = typeof latest?.maxHp === 'number' && latest.maxHp > 0
    ? Math.max(0, Math.min(100, (latest.hp / latest.maxHp) * 100))
    : 0;

  return {
    avgAccuracy: recent.avgAccuracy,
    cornerPercentageLast10s: recent.cornerPercentage,
    totalDashCount: state.sessionDashCount,
    recentHitsTaken: latest?.recentHitsTaken ?? 0,
    dominantZone: recent.dominantZone,
    bossHpPercent,
    playerHpPercent,
    sampleCount: recent.sampleCount,
    timestamp,
    bossActive,
    loreInteractionCount: state.sessionLoreInteractionCount,
    avgTimeReadingLore: state.sessionLoreReadTimeCount > 0 ? state.sessionLoreReadTimeSum / state.sessionLoreReadTimeCount : 0,
    avgLoreLingerTime: recent.avgLoreLingerTime,
    skippedMandatoryLore: state.sessionSkippedLore,
    retreatDistance: state.sessionRetreatDistance,
    wallBias: recent.wallBias,
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

export function computeWindowStats(samples: SampleEntry[]): {
  avgAccuracy: number;
  cornerPercentage: number;
  dashCount: number;
  dominantZone: string;
  sampleCount: number;
  windowSeconds: number;
  loreInteractionCount: number;
  avgTimeReadingLore: number;
  avgLoreLingerTime: number;
  skippedMandatoryLore: number;
  retreatDistance: number;
  wallBias: number;
} {
  if (!samples.length) {
    return {
      avgAccuracy: 0,
      cornerPercentage: 0,
      dashCount: 0,
      dominantZone: 'center',
      sampleCount: 0,
      windowSeconds: 0,
      loreInteractionCount: 0,
      avgTimeReadingLore: 0,
      avgLoreLingerTime: 0,
      skippedMandatoryLore: 0,
      retreatDistance: 0,
      wallBias: 0,
    };
  }

  let accuracySum = 0;
  let cornerSum = 0;
  let dashSum = 0;
  let loreInteractionSum = 0;
  let loreReadTimeSum = 0;
  let loreReadTimeCount = 0;
  let loreLingerSum = 0;
  let loreLingerCount = 0;
  let skippedLoreSum = 0;
  let retreatSum = 0;
  let wallBiasSum = 0;
  const zoneCounts = new Map<string, number>();

  for (const entry of samples) {
    accuracySum += entry.sample.accuracy;
    cornerSum += entry.sample.cornerPercentage;
    dashSum += entry.dashDelta;
    const zone = entry.sample.playerZone;
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);

    // Story fields
    loreInteractionSum += entry.loreInteractionDelta;
    loreReadTimeSum += entry.loreReadTimeDelta;
    if (entry.loreReadTimeDelta > 0) { loreReadTimeCount += 1; }

    const lingerTime = entry.sample.loreLingerTime ?? 0;
    if (lingerTime > 0) { loreLingerSum += lingerTime; loreLingerCount += 1; }

    skippedLoreSum += entry.skippedLoreDelta;
    retreatSum += entry.retreatDelta;
    wallBiasSum += entry.sample.wallBias ?? 0;
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
    loreInteractionCount: loreInteractionSum,
    avgTimeReadingLore: loreReadTimeCount > 0 ? loreReadTimeSum / loreReadTimeCount : 0,
    avgLoreLingerTime: loreLingerCount > 0 ? loreLingerSum / loreLingerCount : 0,
    skippedMandatoryLore: skippedLoreSum,
    retreatDistance: retreatSum,
    wallBias: wallBiasSum / samples.length,
  };
}

export function clearTelemetryStateForTests(): void {
  telemetryState.clear();
}
