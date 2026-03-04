export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultySettings {
  /** Multiplier applied to enemy max HP at spawn time. */
  enemyHpMult: number;
  /** Multiplier applied to player projectile damage. */
  playerDamageMult: number;
  /** Multiplier applied to boss projectile damage. */
  bossDamageMult: number;
  /** Multiplier applied to boss max HP. */
  bossHpMult: number;
  /**
   * Minimum milliseconds between boss AI update ticks.
   * 0 = every frame (default). Higher values slow boss attack frequency.
   */
  bossAiThrottleMs: number;
  /** Multiplier applied to enemy movement speed at spawn time. */
  enemySpeedMult: number;
}

const SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    enemyHpMult:      0.7,
    playerDamageMult: 1.2,
    bossDamageMult:   0.8,
    bossHpMult:       1.0,
    bossAiThrottleMs: 180, // boss attacks ~20% slower
    enemySpeedMult:   0.9,
  },
  medium: {
    enemyHpMult:      1.0,
    playerDamageMult: 1.0,
    bossDamageMult:   1.0,
    bossHpMult:       1.0,
    bossAiThrottleMs: 0,   // no throttle — same as current behavior
    enemySpeedMult:   1.0,
  },
  hard: {
    enemyHpMult:      1.3,
    playerDamageMult: 0.9,
    bossDamageMult:   1.2,  // boss hits 20% harder
    bossHpMult:       1.4,
    bossAiThrottleMs: 0,    // no throttle — boss is already hitting harder
    enemySpeedMult:   1.15,
  },
};

export class DifficultyManager {
  private static instance: DifficultyManager | null = null;
  private current: Difficulty = 'medium';

  private constructor() {}

  static get(): DifficultyManager {
    if (!DifficultyManager.instance) {
      DifficultyManager.instance = new DifficultyManager();
    }
    return DifficultyManager.instance;
  }

  setDifficulty(d: Difficulty): void {
    this.current = d;
  }

  getDifficulty(): Difficulty {
    return this.current;
  }

  getSettings(): DifficultySettings {
    return SETTINGS[this.current];
  }
}
