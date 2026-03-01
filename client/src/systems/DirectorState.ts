import { LevelData, EnemyType, EnemyBehavior, ItemType } from '../config/types';
import { ENEMY_CONFIGS } from '../config/enemies';
import { ITEM_CONFIGS } from '../config/items';
import { ItemConfig } from '../config/types';

export interface TelemetryPayload {
  sessionId: string;
  level: number;
  roomsCleared: number;
  enemiesKilled: number;
  playerHP: number;
  playerMaxHP: number;
  coins: number;
  score: number;
  damageDealt: number;
  damageTaken: number;
  playTimeSeconds: number;
  weaponType: string;
  character: string;
}

export interface DirectorDecision {
  difficultyDelta: number;
  enemyBias: 'melee' | 'ranged' | 'mixed' | 'special' | 'none';
  lootBias: 'health' | 'offensive' | 'coins' | 'none';
  reason: string;
}

const DEFAULT_DECISION: DirectorDecision = {
  difficultyDelta: 0,
  enemyBias: 'none',
  lootBias: 'none',
  reason: 'Waiting for AI analysis...',
};

const DIRECTOR_URL = 'http://localhost:8787/api/director/analyze';

export class DirectorState {
  private static instance: DirectorState;

  readonly sessionId: string;
  currentDecision: DirectorDecision = { ...DEFAULT_DECISION };
  isPending = false;
  lastAnalysisTime = 0;

  private constructor() {
    this.sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  static get(): DirectorState {
    if (!DirectorState.instance) {
      DirectorState.instance = new DirectorState();
    }
    return DirectorState.instance;
  }

  /** Reset decision state between full game resets (not between levels) */
  resetDecision(): void {
    this.currentDecision = { ...DEFAULT_DECISION };
    this.lastAnalysisTime = 0;
    this.isPending = false;
  }

  /**
   * Returns a modified copy of levelData with the current director decision applied.
   * Call this BEFORE EnemyFactory.spawnEnemies().
   */
  applyToLevelData(levelData: LevelData): LevelData {
    const d = this.currentDecision;
    const modified = { ...levelData };

    if (d.difficultyDelta !== 0) {
      modified.enemyHPMult = Math.max(0.5, levelData.enemyHPMult + d.difficultyDelta);
      modified.enemySpdMult = Math.max(0.5, levelData.enemySpdMult + d.difficultyDelta * 0.5);
      // Slightly adjust enemy count too (±15% max)
      modified.enemyCount = Math.max(
        2,
        Math.round(levelData.enemyCount * (1 + d.difficultyDelta * 0.5))
      );
    }

    if (d.enemyBias !== 'none' && d.enemyBias !== 'mixed') {
      const biasedTypes = this.buildBiasedPool(levelData.enemyTypes, d.enemyBias);
      if (biasedTypes.length > 0) {
        modified.enemyTypes = biasedTypes;
      }
    }

    return modified;
  }

  /**
   * Return a biased drop config based on current loot bias.
   * Returns null if no bias or random roll should be used normally.
   */
  getBiasedLootOverride(): ItemConfig | null {
    const bias = this.currentDecision.lootBias;
    if (bias === 'none') return null;

    const roll = Math.random();
    if (bias === 'health' && roll < 0.65) {
      return roll < 0.4 ? ITEM_CONFIGS[ItemType.FlaskRed] : ITEM_CONFIGS[ItemType.FlaskBigRed];
    }
    if (bias === 'coins' && roll < 0.65) {
      return ITEM_CONFIGS[ItemType.Coin];
    }
    if (bias === 'offensive' && roll < 0.45) {
      const weapons = [ItemType.WeaponSword, ItemType.WeaponDagger, ItemType.WeaponHammer];
      const pick = weapons[Math.floor(Math.random() * weapons.length)];
      return ITEM_CONFIGS[pick];
    }
    return null;
  }

  getPanelText(): string {
    const d = this.currentDecision;
    const pending = this.isPending ? ' ⟳' : '';
    const delta =
      d.difficultyDelta > 0
        ? `+${d.difficultyDelta.toFixed(2)}`
        : d.difficultyDelta.toFixed(2);
    return (
      `[AI Director]${pending}  [F5 hide]\n` +
      `Difficulty: ${delta}\n` +
      `Bias: ${d.enemyBias}  Loot: ${d.lootBias}\n` +
      `"${d.reason}"`
    );
  }

  async sendTelemetry(payload: TelemetryPayload): Promise<void> {
    if (this.isPending) return;
    this.isPending = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(DIRECTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as DirectorDecision;
        this.currentDecision = data;
        this.lastAnalysisTime = Date.now();
        console.log('📥 DIRECTOR_UPDATE RECEIVED:', data);
        console.log(
          `[Director] Applied → delta:${data.difficultyDelta} bias:${data.enemyBias} loot:${data.lootBias} | "${data.reason}"`
        );
      } else {
        console.warn('[Director] Server returned', response.status);
      }
    } catch (err) {
      console.warn('[Director] Telemetry request failed:', (err as Error).message);
    } finally {
      this.isPending = false;
    }
  }

  private buildBiasedPool(
    types: EnemyType[],
    bias: 'melee' | 'ranged' | 'special'
  ): EnemyType[] {
    const melee: EnemyType[] = [];
    const ranged: EnemyType[] = [];
    const special: EnemyType[] = [];

    for (const t of types) {
      const b = ENEMY_CONFIGS[t]?.behavior;
      if (!b) continue;
      if (b === EnemyBehavior.MeleeChase) melee.push(t);
      else if (b === EnemyBehavior.RangedShoot || b === EnemyBehavior.Summoner) ranged.push(t);
      else special.push(t);
    }

    const preferred =
      bias === 'melee' ? melee : bias === 'ranged' ? ranged : special;

    if (preferred.length === 0) return types;

    // Weight preferred types 2:1 over the full original pool
    return [...preferred, ...preferred, ...types];
  }
}
