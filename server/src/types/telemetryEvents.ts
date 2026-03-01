/**
 * telemetryEvents.ts
 *
 * Typed telemetry event definitions for production-grade observability.
 * Every significant server & client event is represented as a discriminated
 * union member so consumers get full type safety.
 */

// ── Base ────────────────────────────────────────────────────────────────────────

export interface TelemetryEventBase {
    id: string;
    timestamp: number;       // Date.now()
    sessionId: string;       // '' for system-level events
    category: TelemetryCategory;
}

export type TelemetryCategory =
    | 'llm'
    | 'tts'
    | 'stt'
    | 'audio'
    | 'session'
    | 'ws'
    | 'director'
    | 'telemetry'
    | 'game'
    | 'system';

// ── LLM Events ──────────────────────────────────────────────────────────────────

export interface LLMCallStartEvent extends TelemetryEventBase {
    category: 'llm';
    type: 'llm.call.start';
    data: {
        model: string;
        promptLength: number;
        purpose: 'boss_reply' | 'director';
    };
}

export interface LLMCallEndEvent extends TelemetryEventBase {
    category: 'llm';
    type: 'llm.call.end';
    data: {
        model: string;
        latencyMs: number;
        responseLength: number;
        tokenUsage?: { prompt?: number; completion?: number; total?: number };
        purpose: 'boss_reply' | 'director';
    };
}

export interface LLMCallErrorEvent extends TelemetryEventBase {
    category: 'llm';
    type: 'llm.call.error';
    data: {
        model: string;
        latencyMs: number;
        error: string;
        cascadeContinues: boolean;
        purpose: 'boss_reply' | 'director';
    };
}

// ── TTS Events ──────────────────────────────────────────────────────────────────

export interface TTSCallStartEvent extends TelemetryEventBase {
    category: 'tts';
    type: 'tts.call.start';
    data: {
        textLength: number;
        voiceId: string;
        streaming: boolean;
    };
}

export interface TTSCallEndEvent extends TelemetryEventBase {
    category: 'tts';
    type: 'tts.call.end';
    data: {
        latencyMs: number;
        chunkCount: number;
        streaming: boolean;
    };
}

export interface TTSCallErrorEvent extends TelemetryEventBase {
    category: 'tts';
    type: 'tts.call.error';
    data: {
        latencyMs: number;
        error: string;
        reason: 'timeout' | 'ws_error' | 'no_audio' | 'api_key_missing';
    };
}

// ── STT Events ──────────────────────────────────────────────────────────────────

export interface STTCallStartEvent extends TelemetryEventBase {
    category: 'stt';
    type: 'stt.call.start';
    data: {
        mode: 'streaming' | 'single_utterance';
        audioBytes?: number;
    };
}

export interface STTCallEndEvent extends TelemetryEventBase {
    category: 'stt';
    type: 'stt.call.end';
    data: {
        latencyMs: number;
        transcriptLength: number;
        wordCount: number;
        mode: 'streaming' | 'single_utterance';
    };
}

export interface STTCallErrorEvent extends TelemetryEventBase {
    category: 'stt';
    type: 'stt.call.error';
    data: {
        latencyMs: number;
        error: string;
        mode: 'streaming' | 'single_utterance';
    };
}

// ── Audio Generation Events ─────────────────────────────────────────────────────

export interface AudioGenerateStartEvent extends TelemetryEventBase {
    category: 'audio';
    type: 'audio.generate.start';
    data: {
        name: string;
        audioType: 'music' | 'sfx' | 'voice';
        durationSecs: number;
        prompt: string;
    };
}

export interface AudioGenerateEndEvent extends TelemetryEventBase {
    category: 'audio';
    type: 'audio.generate.end';
    data: {
        name: string;
        audioType: 'music' | 'sfx' | 'voice';
        latencyMs: number;
        fileSizeBytes: number;
        estimatedCredits: number;
    };
}

export interface AudioCacheHitEvent extends TelemetryEventBase {
    category: 'audio';
    type: 'audio.cache.hit';
    data: {
        name: string;
        audioType: 'music' | 'sfx';
        source: 'subfolder' | 'legacy';
    };
}

// ── Session Events ──────────────────────────────────────────────────────────────

export interface SessionCreatedEvent extends TelemetryEventBase {
    category: 'session';
    type: 'session.created';
    data: Record<string, never>;
}

export interface SessionDestroyedEvent extends TelemetryEventBase {
    category: 'session';
    type: 'session.destroyed';
    data: {
        durationMs: number;
    };
}

export interface SessionStateChangeEvent extends TelemetryEventBase {
    category: 'session';
    type: 'session.state.change';
    data: {
        from: string;
        to: string;
    };
}

// ── WebSocket Events ────────────────────────────────────────────────────────────

export interface WSConnectionEvent extends TelemetryEventBase {
    category: 'ws';
    type: 'ws.connection';
    data: Record<string, never>;
}

export interface WSMessageInEvent extends TelemetryEventBase {
    category: 'ws';
    type: 'ws.message.in';
    data: {
        messageType: string;
        isBinary: boolean;
        sizeBytes?: number;
    };
}

export interface WSMessageOutEvent extends TelemetryEventBase {
    category: 'ws';
    type: 'ws.message.out';
    data: {
        messageType: string;
    };
}

export interface WSDisconnectEvent extends TelemetryEventBase {
    category: 'ws';
    type: 'ws.disconnect';
    data: {
        sessionDurationMs: number;
    };
}

// ── Director Events ─────────────────────────────────────────────────────────────

export interface DirectorTickStartEvent extends TelemetryEventBase {
    category: 'director';
    type: 'director.tick.start';
    data: {
        bossActive: boolean;
    };
}

export interface DirectorTickEndEvent extends TelemetryEventBase {
    category: 'director';
    type: 'director.tick.end';
    data: {
        latencyMs: number;
        difficultyDelta: number;
        enemyBias: string;
        reason: string;
    };
}

// ── Telemetry Ingest Events ─────────────────────────────────────────────────────

export interface TelemetryIngestEvent extends TelemetryEventBase {
    category: 'telemetry';
    type: 'telemetry.ingest';
    data: {
        sampleCount: number;
        playerHpPercent: number;
        bossHpPercent: number;
    };
}

// ── Game Events (from client) ───────────────────────────────────────────────────

export interface GameSceneTransitionEvent extends TelemetryEventBase {
    category: 'game';
    type: 'game.scene.transition';
    data: {
        from: string;
        to: string;
        level?: number;
    };
}

export interface GameCombatEvent extends TelemetryEventBase {
    category: 'game';
    type: 'game.combat.damage' | 'game.combat.kill';
    data: {
        source?: string;
        target?: string;
        amount?: number;
        enemyType?: string;
    };
}

export interface GamePlayerActionEvent extends TelemetryEventBase {
    category: 'game';
    type: 'game.player.action';
    data: {
        action: 'dash' | 'shoot' | 'interact' | 'potion' | 'weapon_swap' | 'pause' | 'resume';
        detail?: string;
    };
}

export interface GameAudioPlayEvent extends TelemetryEventBase {
    category: 'game';
    type: 'game.audio.play';
    data: {
        category: string;
        fromCache: boolean;
    };
}

// ── System Events ───────────────────────────────────────────────────────────────

export interface SystemStartEvent extends TelemetryEventBase {
    category: 'system';
    type: 'system.start';
    data: {
        version: string;
        platform: string;
    };
}

// ── Union ───────────────────────────────────────────────────────────────────────

export type TelemetryEvent =
    | LLMCallStartEvent
    | LLMCallEndEvent
    | LLMCallErrorEvent
    | TTSCallStartEvent
    | TTSCallEndEvent
    | TTSCallErrorEvent
    | STTCallStartEvent
    | STTCallEndEvent
    | STTCallErrorEvent
    | AudioGenerateStartEvent
    | AudioGenerateEndEvent
    | AudioCacheHitEvent
    | SessionCreatedEvent
    | SessionDestroyedEvent
    | SessionStateChangeEvent
    | WSConnectionEvent
    | WSMessageInEvent
    | WSMessageOutEvent
    | WSDisconnectEvent
    | DirectorTickStartEvent
    | DirectorTickEndEvent
    | TelemetryIngestEvent
    | GameSceneTransitionEvent
    | GameCombatEvent
    | GamePlayerActionEvent
    | GameAudioPlayEvent
    | SystemStartEvent;

// ── Stats (for API response) ────────────────────────────────────────────────────

export interface TelemetryStats {
    uptime: number;
    totalEvents: number;
    activeSessions: number;
    counters: {
        llmCalls: number;
        llmErrors: number;
        llmAvgLatencyMs: number;
        ttsCalls: number;
        ttsErrors: number;
        ttsAvgLatencyMs: number;
        sttCalls: number;
        sttErrors: number;
        sttAvgLatencyMs: number;
        audioGenerated: number;
        audioCacheHits: number;
        directorTicks: number;
        wsConnections: number;
        wsMessages: number;
        gameEvents: number;
    };
}
