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
  difficultyDelta: number;   // -0.3 to +0.3 — positive = harder
  enemyBias: 'melee' | 'ranged' | 'mixed' | 'special' | 'none';
  lootBias: 'health' | 'offensive' | 'coins' | 'none';
  reason: string;
}

export const DEFAULT_DECISION: DirectorDecision = {
  difficultyDelta: 0,
  enemyBias: 'none',
  lootBias: 'none',
  reason: 'Baseline – no adjustment',
};

export function validateDirectorDecision(raw: unknown): DirectorDecision {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DECISION };

  const r = raw as Record<string, unknown>;

  const difficultyDelta =
    typeof r.difficultyDelta === 'number'
      ? Math.max(-0.3, Math.min(0.3, r.difficultyDelta))
      : 0;

  const validEnemyBias = ['melee', 'ranged', 'mixed', 'special', 'none'];
  const enemyBias = validEnemyBias.includes(r.enemyBias as string)
    ? (r.enemyBias as DirectorDecision['enemyBias'])
    : 'none';

  const validLootBias = ['health', 'offensive', 'coins', 'none'];
  const lootBias = validLootBias.includes(r.lootBias as string)
    ? (r.lootBias as DirectorDecision['lootBias'])
    : 'none';

  const reason =
    typeof r.reason === 'string' ? r.reason.slice(0, 200) : 'No reason provided';

  return { difficultyDelta, enemyBias, lootBias, reason };
}
