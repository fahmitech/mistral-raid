/**
 * GameTelemetry.ts
 *
 * Client-side telemetry collector for Mistral Raid.
 * Batches events and sends them via WebSocket to the server every 5s.
 * Falls back to console.log when WebSocket is disconnected.
 */

import { wsClient } from '../network/WebSocketClient';
import { GameTelemetryEvent } from '../types/arena';

class GameTelemetryCollector {
    private queue: GameTelemetryEvent[] = [];
    private flushInterval: ReturnType<typeof setInterval> | null = null;
    private readonly FLUSH_INTERVAL_MS = 5000;
    private readonly MAX_QUEUE_SIZE = 200;
    private enabled = true;

    constructor() {
        this.startFlushLoop();
    }

    // ── Scene Tracking ──────────────────────────────────────────────────────────

    trackSceneTransition(from: string, to: string, level?: number): void {
        this.push({
            category: 'game',
            type: 'game.scene.transition',
            data: { from, to, level },
        });
    }

    // ── Player Actions ───────────────────────────────────────────────────────────

    trackPlayerAction(
        action: 'dash' | 'shoot' | 'interact' | 'potion' | 'weapon_swap' | 'pause' | 'resume' | 'move',
        detail?: string,
        data?: Record<string, unknown>,
    ): void {
        this.push({
            category: 'game',
            type: 'game.player.action',
            data: { action, detail, ...data },
        });
    }

    // ── Combat Events ────────────────────────────────────────────────────────────

    trackDamage(source: string, target: string, amount: number): void {
        this.push({
            category: 'game',
            type: 'game.combat.damage',
            data: { source, target, amount },
        });
    }

    trackKill(enemyType: string): void {
        this.push({
            category: 'game',
            type: 'game.combat.kill',
            data: { enemyType },
        });
    }

    trackBossPhase(phase: string, bossHp?: number): void {
        this.push({
            category: 'game',
            type: 'game.combat.damage',
            data: { source: 'boss_phase', target: 'boss', phase, bossHp },
        });
    }

    // ── Audio Events ─────────────────────────────────────────────────────────────

    trackAudio(action: string, audioCategory: string, fromCache?: boolean): void {
        this.push({
            category: 'game',
            type: 'game.audio.play',
            data: { category: audioCategory, action, fromCache: fromCache ?? false },
        });
    }

    // ── Performance ──────────────────────────────────────────────────────────────

    trackPerformance(fps: number, avgDelta: number): void {
        this.push({
            category: 'game',
            type: 'game.player.action',
            data: { action: 'performance', fps: Math.round(fps), avgDelta: Math.round(avgDelta) },
        });
    }

    // ── Error Capture ────────────────────────────────────────────────────────────

    trackError(error: string, context?: string): void {
        this.push({
            category: 'game',
            type: 'game.player.action',
            data: { action: 'error', error, context },
        });
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    destroy(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush(); // drain remaining events
    }

    // ── Internals ────────────────────────────────────────────────────────────────

    private push(event: Omit<GameTelemetryEvent, 'timestamp'>): void {
        if (!this.enabled) return;
        this.queue.push({ ...event, timestamp: Date.now() });
        if (this.queue.length > this.MAX_QUEUE_SIZE) {
            this.queue.shift(); // drop oldest
        }
    }

    private startFlushLoop(): void {
        this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }

    private flush(): void {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0);

        if (wsClient.isConnected) {
            try {
                // Send as a special message type that the server handles
                const msg: import('../types/arena').ClientMessage = {
                    type: 'game_telemetry',
                    payload: { events: batch },
                };
                wsClient.send(msg);
            } catch {
                // If send fails, log to console as fallback
                batch.forEach((e) => console.log('[telemetry]', e.type, e.data));
            }
        } else {
            // Fallback: log to console
            batch.forEach((e) => console.log('[telemetry]', e.type, e.data));
        }
    }
}

// Export singleton
export const gameTelemetry = new GameTelemetryCollector();
