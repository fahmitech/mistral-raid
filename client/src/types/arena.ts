export type TurnState =
  | 'LISTENING' | 'USER_SPEAKING' | 'USER_PAUSED'
  | 'THINKING' | 'AI_SPEAKING' | 'BARGE_IN';

export type AIState = 'listening' | 'thinking' | 'speaking';

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

export type ServerMessage =
  | { type: 'ai_state'; payload: { state: AIState } }
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

export type ClientMessage =
  | { type: 'telemetry'; payload: RawTelemetry }
  | { type: 'barge_in'; payload: Record<string, never> }
  | { type: 'vad_state'; payload: { speaking: boolean } }
  | { type: 'ANALYZE'; payload: AnalyzePayload }
  | { type: 'AI_ASSISTANT_QUERY'; payload: { message: string; context: CompanionContext } }
  | { type: 'LIVE_TELEMETRY'; payload: LiveTelemetry };

export interface CompanionContext {
  playerPos: { x: number; y: number };
  enemies: { x: number; y: number }[];
  boss: { x: number; y: number } | null;
  treasures: { x: number; y: number }[];
  playerHP: number;
  playerMaxHP: number;
  level: number;
  coins: number;
  // Story context (RM-6)
  loreDiscovered?: string[];
  bossHistory?: string[];
}

export interface CompanionReply {
  reply_text: string;
  warning: boolean;
  direction_hint: string;
  proximity_alert: boolean;
}

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
  // Story-aware telemetry
  loreInteractionCount?: number;
  timeSpentReadingLore?: number;     // seconds total this phase
  loreLingerTime?: number;           // avg seconds lingered near lore before interacting
  skippedMandatoryLore?: number;     // count of mandatory lore triggers walked past
  retreatDistance?: number;          // px moved backward during combat this phase
  wallBias?: number;                 // 0-100, % of time within 1 tile of a wall
}

export interface AnalyzePayload {
  player_id: string;
  phase_duration_seconds: number;
  player_hp_at_transition: number;
  phase_forced_by_timeout: boolean;
  player_said?: string;
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
  // Story-aware telemetry
  lore_interaction_count: number;
  time_spent_reading_lore: number;
  lore_linger_time_avg: number;
  skipped_mandatory_lore: number;
  retreat_distance: number;
  wall_bias_pct: number;
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
