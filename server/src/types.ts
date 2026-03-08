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
  sttStream: {
    queue: { push: (chunk: Uint8Array) => void; close: () => void };
    task: Promise<void> | null;
    finalTranscript: string;
  } | null;
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
  // Story-aware telemetry
  loreInteractionCount?: number;
  timeSpentReadingLore?: number;     // seconds total
  loreLingerTime?: number;           // avg seconds near lore before interacting
  skippedMandatoryLore?: number;
  retreatDistance?: number;          // px moved backward
  wallBias?: number;                 // 0-100 %
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
  bossActive: boolean;
  // Story-aware aggregates
  loreInteractionCount: number;
  avgTimeReadingLore: number;        // seconds
  avgLoreLingerTime: number;         // seconds
  skippedMandatoryLore: number;
  retreatDistance: number;           // cumulative px
  wallBias: number;                  // 0-100 %
  longTerm: {
    avgAccuracy: number;
    cornerPercentage: number;
    dashPerMin: number;
    dominantZone: string;
    sampleCount: number;
    windowSeconds: number;
  };
}

export type BossMovementMode =
  | 'chase'
  | 'circle'
  | 'strafe'
  | 'retreat'
  | 'idle';

export type BossAttackMode =
  | 'aimed_shot'
  | 'burst'
  | 'charge'
  | 'spiral'
  | 'ring'
  | 'fan'
  | 'suppress';

export type EnemyBehaviorDirective =
  | 'melee'
  | 'ranged'
  | 'summoner'
  | 'teleporter'
  | 'shielded'
  | 'exploder'
  | 'split';

export interface BossDirective {
  movement_mode: BossMovementMode;
  attack_mode: BossAttackMode;
  speed_multiplier: number;
  attack_cooldown_ms: number;
  circle_radius?: number;
  duration_ms: number;
}

export interface EnemyDirective {
  aggro_range_multiplier: number;
  speed_multiplier: number;
  patrol_to_aggro_ms?: number;
  behavior_override?: EnemyBehaviorDirective;
  duration_ms: number;
}

export interface LiveTelemetry {
  context: 'arena' | 'dungeon';
  player_hp_pct: number;
  boss_hp_pct?: number;
  enemy_count?: number;
  player_zone: string;
  recent_dodge_bias: { left: number; right: number; up: number; down: number };
  recent_accuracy: number;
  avg_distance_from_boss?: number;
  in_corner: boolean;
  elapsed_ms: number;
  last_damage_source?: 'melee' | 'projectile' | 'hazard';
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

// ── Companion (AI dungeon guide) ────────────────────────────────
export interface CompanionContext {
  playerPos: { x: number; y: number };
  enemies: { x: number; y: number }[];
  boss: { x: number; y: number } | null;
  treasures: { x: number; y: number }[];
  playerHP: number;
  playerMaxHP: number;
  level: number;
  coins: number;
}

export interface CompanionReply {
  reply_text: string;
  warning: boolean;
  direction_hint: string;
  proximity_alert: boolean;
}

export type ClientToServerMessage =
  | { type: 'telemetry'; payload: RawTelemetry }
  | { type: 'barge_in'; payload: Record<string, never> }
  | { type: 'vad_state'; payload: { speaking: boolean } }
  | { type: 'ANALYZE'; payload: Record<string, unknown> }
  | { type: 'AI_ASSISTANT_QUERY'; payload: { message: string; context: CompanionContext } }
  | { type: 'LIVE_TELEMETRY'; payload: LiveTelemetry };

export type ServerToClientMessage =
  | { type: 'ai_state'; payload: { state: 'listening' | 'thinking' | 'speaking' } }
  | { type: 'captions_partial'; payload: { text: string } }
  | { type: 'captions_final'; payload: { text: string } }
  | { type: 'BOSS_RESPONSE'; payload: BossResponse }
  | { type: 'AUDIO_CHUNK'; payload: { audioBase64: string; format: 'mp3' | 'wav' | 'ogg' } }
  | { type: 'AUDIO_DONE'; payload: { format: 'mp3' | 'wav' | 'ogg' } }
  | { type: 'AUDIO_READY'; payload: { audioBase64: string; format: 'mp3' } }
  | { type: 'mechanics_update'; payload: MechanicConfig }
  | { type: 'director_update'; payload: { difficultyDelta: number; enemyBias: string; reason: string; timestamp: number } }
  | { type: 'BOSS_DIRECTIVE'; payload: BossDirective }
  | { type: 'ENEMY_DIRECTIVE'; payload: EnemyDirective }
  | { type: 'AI_ASSISTANT_REPLY'; payload: CompanionReply }
  | { type: 'error'; payload: { message: string; fallback: BossResponse } };
