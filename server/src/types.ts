import type { WebSocket } from 'ws';

// ── Turn State Machine ──────────────────────────────────────────
export type TurnState =
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'USER_PAUSED'
  | 'THINKING'
  | 'AI_SPEAKING'
  | 'BARGE_IN';

// ── Session (one per connected browser client) ──────────────────
export interface Session {
  id: string;
  turnState: TurnState;
  aiState: 'listening' | 'thinking' | 'speaking';
  partialTranscript: string;        // accumulates TranscriptionTextDelta events
  stableTranscript: string;         // promoted after TranscriptionDone event
  latestTelemetrySummary: TelemetrySummary | null;
  rollingDebateNotes: string;       // last 3 boss turns (bounded string)
  activeLLMAbort: AbortController | null;
  activeTTSAbort: AbortController | null;
  lastSpeechEndTime: number;        // ms since epoch — for pause detection
  lastBossSpeechTime: number;       // ms since epoch — for cooldown enforcement
  ws: WebSocket;
  // Director state
  directorInterval: ReturnType<typeof setInterval> | null;
  lastDirectorDecision: { difficultyDelta: number; enemyBias: string; reason: string } | null;
}

// ── Telemetry ───────────────────────────────────────────────────
// Full field definitions: docs/reference/telemetry.md
export interface RawTelemetry {
  hp: number;
  maxHp: number;
  bossHp?: number;
  bossMaxHp?: number;
  accuracy: number;               // 0–1 (shots hit / shots fired)
  recentMissStreak: number;
  recentHitsTaken: number;
  cornerPercentage: number;       // 0–100
  dashCount: number;
  playerZone: string;             // e.g. "bot_left"
  notableEvent?: string;
}

export interface TelemetrySummary {
  avgAccuracy: number;
  cornerPercentageLast10s: number;
  totalDashCount: number;
  recentHitsTaken: number;
  dominantZone: string;
  bossHpPercent: number;
  playerHpPercent: number;
  sampleCount: number;
  timestamp: number;
}

// ── Boss Response (Mistral LLM output) ─────────────────────────
// Mechanic types + value ranges: docs/reference/mechanics.md
export interface MechanicConfig {
  type: 'projectile_spawner' | 'hazard_zone' | 'laser_beam' | 'homing_orb' | 'wall_of_death' | 'minion_spawn';
  [key: string]: unknown;
}

export interface BossResponse {
  analysis: string;               // 1-2 sentences, shown in DevConsole
  taunt: string;                  // <30 words, spoken via TTS
  mechanics: MechanicConfig[];    // 2–3 items
  roast_topic?: string;
  mood?: string;
}

// ── WebSocket Messages ──────────────────────────────────────────
// Full protocol: docs/reference/protocol.md
// NOTE: mic audio arrives as binary WS frames (Buffer), not JSON

export type ClientToServerMessage =
  | { type: 'telemetry';   payload: RawTelemetry }
  | { type: 'barge_in';    payload: Record<string, never> }
  | { type: 'vad_state';   payload: { speaking: boolean } }
  | { type: 'ANALYZE';     payload: Record<string, unknown> };

export type ServerToClientMessage =
  | { type: 'ai_state';         payload: { state: 'listening' | 'thinking' | 'speaking' } }
  | { type: 'captions_partial'; payload: { text: string } }
  | { type: 'captions_final';   payload: { text: string } }
  | { type: 'BOSS_RESPONSE';    payload: BossResponse }
  | { type: 'AUDIO_READY';      payload: { audioBase64: string; format: 'mp3' } }
  | { type: 'mechanics_update'; payload: MechanicConfig }
  | { type: 'director_update';  payload: { difficultyDelta: number; enemyBias: string; reason: string; timestamp: number } }
  | { type: 'error';            payload: { message: string; fallback: BossResponse } };
