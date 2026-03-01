/**
 * telemetry.ts
 *
 * Centralized production-grade telemetry service for Mistral Raid.
 *
 * Features:
 * - In-memory ring buffer (last 10,000 events) for fast dashboard queries
 * - NDJSON file logging to server/logs/telemetry.ndjson
 * - Per-session and aggregate stats tracking
 * - Convenience wrappers for common event patterns (start/end/error)
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type {
    TelemetryEvent,
    TelemetryCategory,
    TelemetryStats,
} from '../types/telemetryEvents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'telemetry.ndjson');
const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50 MB rotation threshold

// ── Ring Buffer ─────────────────────────────────────────────────────────────────

const RING_BUFFER_SIZE = 10_000;
const ringBuffer: TelemetryEvent[] = [];
let ringIndex = 0;
let totalEventsEver = 0;

// ── Aggregate Counters ──────────────────────────────────────────────────────────

const counters = {
    llmCalls: 0,
    llmErrors: 0,
    llmTotalLatency: 0,
    ttsCalls: 0,
    ttsErrors: 0,
    ttsTotalLatency: 0,
    sttCalls: 0,
    sttErrors: 0,
    sttTotalLatency: 0,
    audioGenerated: 0,
    audioCacheHits: 0,
    directorTicks: 0,
    wsConnections: 0,
    wsMessages: 0,
    gameEvents: 0,
};

const activeSessions = new Set<string>();
const startTime = Date.now();

// ── File Writer ─────────────────────────────────────────────────────────────────

let logStream: fs.WriteStream | null = null;

function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function getLogStream(): fs.WriteStream {
    if (logStream) return logStream;
    ensureLogDir();

    // Rotate if needed
    try {
        if (fs.existsSync(LOG_FILE)) {
            const stat = fs.statSync(LOG_FILE);
            if (stat.size > MAX_LOG_SIZE) {
                const rotatedName = LOG_FILE.replace('.ndjson', `.${Date.now()}.ndjson`);
                fs.renameSync(LOG_FILE, rotatedName);
                console.log(`[telemetry] Log rotated → ${path.basename(rotatedName)}`);
            }
        }
    } catch {
        // ignore rotation errors
    }

    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    logStream.on('error', (err) => {
        console.error('[telemetry] Log write error:', err.message);
        logStream = null;
    });
    return logStream;
}

function writeToLog(event: TelemetryEvent): void {
    try {
        const stream = getLogStream();
        stream.write(JSON.stringify(event) + '\n');
    } catch (err: any) {
        console.error(`[telemetry] Failed to write to log file:`, err?.message || err);
        // telemetry should never crash the server
    }
}

// ── Core Emit ───────────────────────────────────────────────────────────────────

export function emit(event: TelemetryEvent): void {
    // Ring buffer insert
    if (ringBuffer.length < RING_BUFFER_SIZE) {
        ringBuffer.push(event);
    } else {
        ringBuffer[ringIndex] = event;
    }
    ringIndex = (ringIndex + 1) % RING_BUFFER_SIZE;
    totalEventsEver++;

    // Update aggregate counters
    updateCounters(event);

    // Write to NDJSON log
    writeToLog(event);
}

function updateCounters(event: TelemetryEvent): void {
    switch (event.type) {
        case 'llm.call.end':
            counters.llmCalls++;
            counters.llmTotalLatency += event.data.latencyMs;
            break;
        case 'llm.call.error':
            counters.llmErrors++;
            break;
        case 'tts.call.end':
            counters.ttsCalls++;
            counters.ttsTotalLatency += event.data.latencyMs;
            break;
        case 'tts.call.error':
            counters.ttsErrors++;
            break;
        case 'stt.call.end':
            counters.sttCalls++;
            counters.sttTotalLatency += event.data.latencyMs;
            break;
        case 'stt.call.error':
            counters.sttErrors++;
            break;
        case 'audio.generate.end':
            counters.audioGenerated++;
            break;
        case 'audio.cache.hit':
            counters.audioCacheHits++;
            break;
        case 'director.tick.end':
            counters.directorTicks++;
            break;
        case 'ws.connection':
            counters.wsConnections++;
            break;
        case 'ws.message.in':
            counters.wsMessages++;
            break;
        case 'session.created':
            activeSessions.add(event.sessionId);
            break;
        case 'session.destroyed':
            activeSessions.delete(event.sessionId);
            break;
        default:
            if (event.category === 'game') counters.gameEvents++;
            break;
    }
}

// ── Query Helpers ───────────────────────────────────────────────────────────────

export function getRecentEvents(opts?: {
    category?: TelemetryCategory;
    sessionId?: string;
    limit?: number;
}): TelemetryEvent[] {
    const limit = Math.min(opts?.limit ?? 100, RING_BUFFER_SIZE);

    // Build ordered view of ring buffer (most recent last)
    const ordered: TelemetryEvent[] = [];
    const len = ringBuffer.length;
    for (let i = 0; i < len; i++) {
        const idx = (ringIndex - len + i + RING_BUFFER_SIZE * 2) % RING_BUFFER_SIZE;
        if (ringBuffer[idx]) ordered.push(ringBuffer[idx]);
    }

    // Filter
    let filtered = ordered;
    if (opts?.category) {
        filtered = filtered.filter((e) => e.category === opts.category);
    }
    if (opts?.sessionId) {
        filtered = filtered.filter((e) => e.sessionId === opts.sessionId);
    }

    return filtered.slice(-limit);
}

export function getStats(): TelemetryStats {
    return {
        uptime: Date.now() - startTime,
        totalEvents: totalEventsEver,
        activeSessions: activeSessions.size,
        counters: {
            llmCalls: counters.llmCalls,
            llmErrors: counters.llmErrors,
            llmAvgLatencyMs: counters.llmCalls > 0 ? Math.round(counters.llmTotalLatency / counters.llmCalls) : 0,
            ttsCalls: counters.ttsCalls,
            ttsErrors: counters.ttsErrors,
            ttsAvgLatencyMs: counters.ttsCalls > 0 ? Math.round(counters.ttsTotalLatency / counters.ttsCalls) : 0,
            sttCalls: counters.sttCalls,
            sttErrors: counters.sttErrors,
            sttAvgLatencyMs: counters.sttCalls > 0 ? Math.round(counters.sttTotalLatency / counters.sttCalls) : 0,
            audioGenerated: counters.audioGenerated,
            audioCacheHits: counters.audioCacheHits,
            directorTicks: counters.directorTicks,
            wsConnections: counters.wsConnections,
            wsMessages: counters.wsMessages,
            gameEvents: counters.gameEvents,
        },
    };
}

// ── Convenience Factories ───────────────────────────────────────────────────────

export function makeEvent<T extends TelemetryEvent>(
    sessionId: string,
    category: T['category'],
    type: T['type'],
    data: T['data'],
): T {
    return {
        id: randomUUID(),
        timestamp: Date.now(),
        sessionId,
        category,
        type,
        data,
    } as T;
}

/**
 * Track start → returns a finish() function that emits the end event.
 */
export function trackStart(
    sessionId: string,
    category: TelemetryEvent['category'],
    startType: string,
    startData: Record<string, unknown>,
): { startTime: number; sessionId: string } {
    emit(makeEvent(sessionId, category, startType as TelemetryEvent['type'], startData as TelemetryEvent['data']));
    return { startTime: Date.now(), sessionId };
}

export function trackEnd(
    ctx: { startTime: number; sessionId: string },
    category: TelemetryEvent['category'],
    endType: string,
    endData: Record<string, unknown>,
): void {
    const latencyMs = Date.now() - ctx.startTime;
    emit(makeEvent(
        ctx.sessionId,
        category,
        endType as TelemetryEvent['type'],
        { ...endData, latencyMs } as TelemetryEvent['data'],
    ));
}

export function trackError(
    ctx: { startTime: number; sessionId: string },
    category: TelemetryEvent['category'],
    errorType: string,
    errorData: Record<string, unknown>,
): void {
    const latencyMs = Date.now() - ctx.startTime;
    emit(makeEvent(
        ctx.sessionId,
        category,
        errorType as TelemetryEvent['type'],
        { ...errorData, latencyMs } as TelemetryEvent['data'],
    ));
}

// ── Lifecycle ───────────────────────────────────────────────────────────────────

export function shutdown(): void {
    if (logStream) {
        logStream.end();
        logStream = null;
    }
}

// Initialize log directory on import
ensureLogDir();
console.log(`[telemetry] Initialized — logs → ${LOG_FILE}`);

// Record server start event
emit({
    id: 'server-init',
    timestamp: Date.now(),
    sessionId: '', // system-level event
    category: 'system',
    type: 'system.start',
    data: { version: '1.0.0', platform: process.platform }
});
