import { beforeEach, describe, expect, it } from 'vitest';
import { DifficultyManager } from '../DifficultyManager';

describe('DifficultyManager', () => {
  beforeEach(() => {
    DifficultyManager.get().setDifficulty('medium');
  });

  it('applies easy preset multipliers', () => {
    const manager = DifficultyManager.get();
    manager.setDifficulty('easy');

    const settings = manager.getSettings();
    expect(settings.enemyHpMult).toBe(0.7);
    expect(settings.playerDamageMult).toBe(1.2);
    expect(settings.bossAiThrottleMs).toBe(180);
  });

  it('applies hard preset multipliers', () => {
    const manager = DifficultyManager.get();
    manager.setDifficulty('hard');

    const settings = manager.getSettings();
    expect(settings.bossHpMult).toBe(1.4);
    expect(settings.bossAiThrottleMs).toBe(0);
    expect(settings.bossDamageMult).toBe(1.2);
  });

  it('uses medium preset as identity/default baseline', () => {
    const manager = DifficultyManager.get();
    manager.setDifficulty('medium');

    const settings = manager.getSettings();
    expect(settings.enemyHpMult).toBe(1);
    expect(settings.playerDamageMult).toBe(1);
    expect(settings.bossDamageMult).toBe(1);
    expect(settings.bossHpMult).toBe(1);
    expect(settings.enemySpeedMult).toBe(1);
    expect(settings.bossAiThrottleMs).toBe(0);
  });

  it('applies multipliers correctly to base combat stats', () => {
    const manager = DifficultyManager.get();
    manager.setDifficulty('hard');
    const hard = manager.getSettings();

    const baseEnemyHp = 20;
    const baseBossHp = 100;
    const basePlayerDamage = 10;

    expect(baseEnemyHp * hard.enemyHpMult).toBe(26);
    expect(baseBossHp * hard.bossHpMult).toBe(140);
    expect(basePlayerDamage * hard.playerDamageMult).toBe(9);
  });
});
