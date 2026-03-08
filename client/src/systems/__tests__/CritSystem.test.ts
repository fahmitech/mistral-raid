import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRIT_CAP,
  HIT_COUNTER_CRIT_GAIN,
  HIT_COUNTER_CRIT_THRESHOLD,
  CritSystem,
} from '../CritSystem';

function makePlayer(critChance = 0.05, hitCounter = 0) {
  return {
    critChance,
    hitCounter,
  } as any;
}

describe('CritSystem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculateDamage never crits when critChance=0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = CritSystem.calculateDamage(10, 0, 2);

    expect(result.isCrit).toBe(false);
    expect(result.damage).toBe(10);
  });

  it('calculateDamage always crits when critChance=1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const result = CritSystem.calculateDamage(10, 1, 1.75);

    expect(result.isCrit).toBe(true);
    expect(result.damage).toBe(17.5);
  });

  it(`updateHitCounter adds crit chance every ${HIT_COUNTER_CRIT_THRESHOLD} hits`, () => {
    const player = makePlayer(0.1, HIT_COUNTER_CRIT_THRESHOLD - 1);

    CritSystem.updateHitCounter(player);

    expect(player.hitCounter).toBe(HIT_COUNTER_CRIT_THRESHOLD);
    expect(player.critChance).toBeCloseTo(0.1 + HIT_COUNTER_CRIT_GAIN, 6);
  });

  it('caps crit chance at CRIT_CAP regardless of hit count', () => {
    const player = makePlayer(CRIT_CAP - 0.005, HIT_COUNTER_CRIT_THRESHOLD - 1);

    CritSystem.updateHitCounter(player);

    expect(player.critChance).toBe(CRIT_CAP);
  });

  it('supports hit counter reset between phases', () => {
    const player = makePlayer(0.1, 9);

    CritSystem.updateHitCounter(player);
    expect(player.critChance).toBeCloseTo(0.12, 6);

    player.hitCounter = 0;
    CritSystem.updateHitCounter(player);

    expect(player.hitCounter).toBe(1);
    expect(player.critChance).toBeCloseTo(0.12, 6);
  });
});
