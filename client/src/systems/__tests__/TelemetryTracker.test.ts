import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Vector2 {
    x: number;
    y: number;

    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    set(x: number, y: number): this {
      this.x = x;
      this.y = y;
      return this;
    }
  }

  return {
    default: {
      Math: {
        Vector2,
        Distance: {
          Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
        },
      },
    },
  };
});

import { TelemetryTracker } from '../TelemetryTracker';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../config/constants';

describe('TelemetryTracker', () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies top-left zone correctly', () => {
    const tracker = new TelemetryTracker();
    expect(tracker.getCurrentZone(10, 10)).toBe('top_left');
  });

  it('classifies mid-center zone correctly', () => {
    const tracker = new TelemetryTracker();
    expect(tracker.getCurrentZone(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2)).toBe('mid_center');
  });

  it('classifies bottom-right zone correctly', () => {
    const tracker = new TelemetryTracker();
    expect(tracker.getCurrentZone(INTERNAL_WIDTH - 5, INTERNAL_HEIGHT - 5)).toBe('bot_right');
  });

  it('compile() returns required telemetry fields', () => {
    const tracker = new TelemetryTracker();
    tracker.startPhase(120);

    tracker.recordShotFired();
    tracker.recordShotFired();
    tracker.recordShotHit();
    tracker.recordDash({ x: 1, y: 0 } as any);
    tracker.recordDash({ x: -1, y: 0 } as any);
    tracker.recordDamage('projectile', 2);
    tracker.setPlayerHpAtTransition(4);
    tracker.setPhaseForcedByTimeout(true);

    now = 10_000;
    const payload = tracker.compile('player-1');

    expect(payload.player_id).toBe('player-1');
    expect(payload.shots_fired).toBe(2);
    expect(payload.shots_hit).toBe(1);
    expect(payload.accuracy).toBeCloseTo(0.5, 6);
    expect(payload.dodge_bias.left).toBe(1);
    expect(payload.dodge_bias.right).toBe(1);
    expect(payload.player_hp_at_transition).toBe(4);
    expect(payload.phase_forced_by_timeout).toBe(true);
    expect(payload).toHaveProperty('movement_heatmap');
    expect(payload).toHaveProperty('corner_time_pct');
    expect(payload).toHaveProperty('reaction_time_avg_ms');
  });

  it('startPhase() resets counters and phase state', () => {
    const tracker = new TelemetryTracker();
    tracker.startPhase(100);

    tracker.recordShotFired();
    tracker.recordShotHit();
    tracker.recordDash({ x: 0, y: 1 } as any);
    tracker.recordDamage('hazard', 1);

    now = 5_000;
    const beforeReset = tracker.compile('player-1');
    expect(beforeReset.shots_fired).toBe(1);

    now = 6_000;
    tracker.startPhase(160);
    now = 9_000;
    const afterReset = tracker.compile('player-1');

    expect(afterReset.shots_fired).toBe(0);
    expect(afterReset.shots_hit).toBe(0);
    expect(afterReset.dash_frequency).toBe(0);
    expect(afterReset.damage_taken_from.hazard).toBe(0);
    expect(Object.values(afterReset.movement_heatmap).every((v) => v === 0)).toBe(true);
  });
});
