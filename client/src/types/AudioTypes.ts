// ─── Music Layers ──────────────────────────────────────────────────────────────
export type MusicLayer =
  | 'menu'
  | 'hero_select'
  | 'ambient'
  | 'combat'
  | 'boss'
  | 'credits'
  | 'none';

// ─── Volume Settings (persisted to localStorage) ───────────────────────────────
export interface AudioVolumes {
  master: number; // 0–1
  music: number;  // 0–1
  sfx: number;    // 0–1
}

export const DEFAULT_VOLUMES: AudioVolumes = {
  master: 0.8,
  music: 0.35,
  sfx: 1.0,
};

export const AUDIO_VOLUMES_KEY = 'mistral_raid_audio_volumes';

// ─── Telemetry sent to adaptive backend ────────────────────────────────────────
export interface AudioTelemetry {
  hp: number;
  maxHp: number;
  bossHp: number;
  bossMaxHp: number;
  enemyCount: number;
  recentDamageTaken: number; // total damage in last 10 s
}

// ─── Adaptive response from backend ───────────────────────────────────────────
export type MusicMood = 'calm' | 'tense' | 'intense' | 'critical';

export interface AdaptiveResponse {
  musicMood: MusicMood;
  addLayer: boolean;
  volumeMultiplier: number;
}

// ─── Debug state exposed by AudioManager ──────────────────────────────────────
export interface AudioDebugInfo {
  layer: MusicLayer;
  loaded: number;
  loading: number;
  heartbeat: boolean;
  presence: boolean;
  musicTracks: string[];
  recent: string[];
  // Live game state filled in by LevelScene
  hp: number;
  maxHp: number;
  bossHp: number;
  bossMaxHp: number;
  enemyCount: number;
  intensityLevel: MusicMood;
  // Volume levels
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}
