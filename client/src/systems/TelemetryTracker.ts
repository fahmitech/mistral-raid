import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import type { AnalyzePayload, RawTelemetry } from '../types/arena';
import type { Player } from '../entities/Player';

interface DashEvent {
  dir: 'left' | 'right' | 'up' | 'down';
  time: number;
}

interface TelegraphEvent {
  time: number;
}

export class TelemetryTracker {
  private heatmap: Record<string, number> = {};
  private dashEvents: DashEvent[] = [];
  private shotsFired = 0;
  private shotsHit = 0;
  private orbsDestroyed = 0;
  private damageTakenFrom = { melee: 0, projectile: 0, hazard: 0 };
  private recentHits: number[] = [];
  private recentMissStreak = 0;
  private distanceSamples: number[] = [];
  private movementDistanceTotal = 0;
  private speedSamples: number[] = [];
  private cornerSamples = 0;
  private phaseStartTime = 0;
  private lastSampleAt = 0;
  private lastPosition: Phaser.Math.Vector2 | null = null;
  private bossMaxHp = 1;
  private telegraphEvents: TelegraphEvent[] = [];
  private reactionTimes: number[] = [];
  private playerHpAtTransition = 0;
  private phaseForcedByTimeout = false;

  startPhase(bossMaxHp: number): void {
    this.heatmap = this.defaultHeatmap();
    this.dashEvents = [];
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.orbsDestroyed = 0;
    this.damageTakenFrom = { melee: 0, projectile: 0, hazard: 0 };
    this.recentHits = [];
    this.recentMissStreak = 0;
    this.distanceSamples = [];
    this.movementDistanceTotal = 0;
    this.speedSamples = [];
    this.cornerSamples = 0;
    this.phaseStartTime = performance.now();
    this.lastSampleAt = 0;
    this.lastPosition = null;
    this.bossMaxHp = bossMaxHp;
    this.telegraphEvents = [];
    this.reactionTimes = [];
    this.playerHpAtTransition = 0;
    this.phaseForcedByTimeout = false;
  }

  update(player: Player, boss: Phaser.GameObjects.Sprite, delta: number): void {
    const now = performance.now();
    if (!this.lastPosition) this.lastPosition = new Phaser.Math.Vector2(player.x, player.y);

    const distMoved = Phaser.Math.Distance.Between(player.x, player.y, this.lastPosition.x, this.lastPosition.y);
    this.movementDistanceTotal += distMoved;
    const speed = delta > 0 ? (distMoved / delta) * 1000 : 0;
    this.speedSamples.push(speed);
    this.lastPosition.set(player.x, player.y);

    if (now - this.lastSampleAt >= 500) {
      this.lastSampleAt = now;
      const zone = this.computeZone(player.x, player.y);
      this.heatmap[zone] = (this.heatmap[zone] ?? 0) + 1;
      if (zone.startsWith('top') || zone.startsWith('bot')) {
        if (zone.includes('left') || zone.includes('right')) this.cornerSamples += 1;
      }
      const distToBoss = Phaser.Math.Distance.Between(player.x, player.y, boss.x, boss.y);
      this.distanceSamples.push(distToBoss);

      this.checkReaction(now, speed);
    }

    this.pruneRecentHits(now);
  }

  recordDash(dir: Phaser.Math.Vector2): void {
    const absX = Math.abs(dir.x);
    const absY = Math.abs(dir.y);
    const axis = absX >= absY ? (dir.x >= 0 ? 'right' : 'left') : (dir.y >= 0 ? 'down' : 'up');
    this.dashEvents.push({ dir: axis, time: performance.now() });
  }

  recordShotFired(): void {
    this.shotsFired += 1;
    this.recentMissStreak += 1;
  }

  recordShotHit(): void {
    this.shotsHit += 1;
    this.recentMissStreak = 0;
  }

  recordOrbDestroyed(): void {
    this.orbsDestroyed += 1;
  }

  recordDamage(source: 'melee' | 'projectile' | 'hazard', amount: number): void {
    this.damageTakenFrom[source] += amount;
    this.recentHits.push(performance.now());
  }

  recordTelegraph(): void {
    this.telegraphEvents.push({ time: performance.now() });
  }

  setPlayerHpAtTransition(hp: number): void {
    this.playerHpAtTransition = hp;
  }

  setPhaseForcedByTimeout(forced: boolean): void {
    this.phaseForcedByTimeout = forced;
  }

  getRawTelemetry(playerHp: number, playerMaxHp: number, bossHp: number): RawTelemetry {
    const accuracy = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const totalSamples = Object.values(this.heatmap).reduce((sum, v) => sum + v, 0) || 1;
    const cornerPct = (this.cornerSamples / totalSamples) * 100;
    const playerZone = this.getDominantZone();

    return {
      hp: playerHp,
      maxHp: playerMaxHp,
      bossHp,
      bossMaxHp: this.bossMaxHp,
      accuracy,
      recentMissStreak: this.recentMissStreak,
      recentHitsTaken: this.recentHits.length,
      cornerPercentage: cornerPct,
      dashCount: this.dashEvents.length,
      playerZone,
    };
  }

  compile(playerId: string): AnalyzePayload {
    const durationSeconds = (performance.now() - this.phaseStartTime) / 1000;
    const accuracy = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const dashFrequency = durationSeconds > 0 ? this.dashEvents.length / (durationSeconds / 60) : 0;
    const totalSamples = Object.values(this.heatmap).reduce((sum, v) => sum + v, 0) || 1;
    const cornerTimePct = (this.cornerSamples / totalSamples) * 100;
    const avgDistance = this.average(this.distanceSamples);
    const avgSpeed = durationSeconds > 0 ? this.movementDistanceTotal / durationSeconds : 0;

    const dodgeBias = { left: 0, right: 0, up: 0, down: 0 };
    this.dashEvents.forEach((ev) => { dodgeBias[ev.dir] += 1; });

    return {
      player_id: playerId,
      phase_duration_seconds: durationSeconds,
      player_hp_at_transition: this.playerHpAtTransition,
      phase_forced_by_timeout: this.phaseForcedByTimeout,
      movement_heatmap: { ...this.heatmap },
      dodge_bias: dodgeBias,
      damage_taken_from: { ...this.damageTakenFrom },
      shots_fired: this.shotsFired,
      shots_hit: this.shotsHit,
      orbs_destroyed: this.orbsDestroyed,
      average_distance_from_boss: avgDistance,
      movement_distance: this.movementDistanceTotal,
      average_speed: avgSpeed,
      accuracy,
      dash_frequency: dashFrequency,
      corner_time_pct: cornerTimePct,
      reaction_time_avg_ms: this.average(this.reactionTimes),
    };
  }

  private checkReaction(now: number, speed: number): void {
    if (!this.telegraphEvents.length) return;
    if (speed < 10) return;
    const event = this.telegraphEvents.shift();
    if (!event) return;
    this.reactionTimes.push(now - event.time);
  }

  private pruneRecentHits(now: number): void {
    this.recentHits = this.recentHits.filter((t) => now - t <= 3000);
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private computeZone(x: number, y: number): string {
    const thirdW = INTERNAL_WIDTH / 3;
    const thirdH = INTERNAL_HEIGHT / 3;
    const col = x < thirdW ? 'left' : x < thirdW * 2 ? 'center' : 'right';
    const row = y < thirdH ? 'top' : y < thirdH * 2 ? 'mid' : 'bot';
    return `${row}_${col}`;
  }

  private getDominantZone(): string {
    let best = 'center';
    let bestCount = -1;
    Object.entries(this.heatmap).forEach(([zone, count]) => {
      if (count > bestCount) {
        best = zone;
        bestCount = count;
      }
    });
    return best;
  }

  private defaultHeatmap(): Record<string, number> {
    return {
      top_left: 0,
      top_center: 0,
      top_right: 0,
      mid_left: 0,
      mid_center: 0,
      mid_right: 0,
      bot_left: 0,
      bot_center: 0,
      bot_right: 0,
    };
  }
}
