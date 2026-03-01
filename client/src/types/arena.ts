export type TurnState =
  | 'LISTENING' | 'USER_SPEAKING' | 'USER_PAUSED'
  | 'THINKING' | 'AI_SPEAKING' | 'BARGE_IN';

export type AIState = 'listening' | 'thinking' | 'speaking';

export type ServerMessage =
  | { type: 'ai_state';         payload: { state: AIState } }
  | { type: 'captions_partial'; payload: { text: string } }
  | { type: 'captions_final';   payload: { text: string } }
  | { type: 'BOSS_RESPONSE';    payload: BossResponse }
  | { type: 'AUDIO_READY';      payload: { audioBase64: string; format: 'mp3' } }
  | { type: 'mechanics_update'; payload: MechanicConfig }
  | { type: 'director_update';  payload: { difficultyDelta: number; enemyBias: string; reason: string; timestamp: number } }
  | { type: 'error';            payload: { message: string; fallback: BossResponse } };

export type ClientMessage =
  | { type: 'telemetry';  payload: RawTelemetry }
  | { type: 'barge_in';   payload: Record<string, never> }
  | { type: 'vad_state';  payload: { speaking: boolean } }
  | { type: 'ANALYZE';    payload: AnalyzePayload };

export interface RawTelemetry {
  hp: number;
  maxHp: number;
  bossHp: number;
  bossMaxHp: number;
  accuracy: number;
  recentMissStreak: number;
  recentHitsTaken: number;
  cornerPercentage: number;
  dashCount: number;
  playerZone: string;
  notableEvent?: string;
}

export interface AnalyzePayload {
  player_id: string;
  phase_duration_seconds: number;
  player_hp_at_transition: number;
  phase_forced_by_timeout: boolean;
  movement_heatmap: Record<string, number>;
  dodge_bias: { left: number; right: number; up: number; down: number };
  damage_taken_from: { melee: number; projectile: number; hazard: number };
  shots_fired: number;
  shots_hit: number;
  orbs_destroyed: number;
  average_distance_from_boss: number;
  movement_distance: number;
  average_speed: number;
  accuracy: number;
  dash_frequency: number;
  corner_time_pct: number;
  reaction_time_avg_ms: number;
}

export interface BossResponse {
  analysis: string;
  taunt: string;
  mechanics: MechanicConfig[];
  roast_topic?: string;
  mood?: string;
}

export interface MechanicConfig {
  type: 'projectile_spawner' | 'hazard_zone' | 'laser_beam'
      | 'homing_orb' | 'wall_of_death' | 'minion_spawn';
  duration_seconds?: number;
  [key: string]: unknown;
}

export type ArenaPhase =
  | 'INTRO'
  | 'PHASE_1'
  | 'TRANSITIONING'
  | 'PHASE_2'
  | 'VICTORY'
  | 'DEFEAT';
