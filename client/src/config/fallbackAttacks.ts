import type { BossResponse } from '../types/arena';

export const FALLBACK_BOSS_RESPONSE: BossResponse = {
  analysis: 'Fallback pattern: central pressure and spiral fire.',
  taunt: 'You cannot escape.',
  mechanics: [
    {
      type: 'hazard_zone',
      location: 'center',
      shape: 'circle',
      radius: 140,
      damage_per_tick: 10,
      duration_seconds: 6,
      warning_time: 1,
    },
    {
      type: 'projectile_spawner',
      pattern: 'spiral',
      speed: 6,
      projectile_count: 6,
      fire_rate: 1.5,
      projectile_size: 8,
      homing: false,
      duration_seconds: 6,
    },
  ],
};
