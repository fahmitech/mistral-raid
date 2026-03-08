import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, TILE_SIZE } from '../config/constants';
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
  private recentShotResults: boolean[] = [];
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

  // ── Story-aware telemetry ──────────────────────────────────────
  private loreInteractionCount = 0;
  private loreReadTimes: number[] = [];       // durations in seconds
  private loreLingerTimes: number[] = [];     // durations in seconds
  private skippedMandatoryLore = 0;
  private retreatDistance = 0;
  private wallProximitySamples = 0;
  private wallProximityHits = 0;
  private lastEnemyDistance: number | null = null;

  startPhase(bossMaxHp: number): void {
    this.heatmap = this.defaultHeatmap();
    this.dashEvents = [];
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.recentShotResults = [];
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
    // Story-aware resets
    this.loreInteractionCount = 0;
    this.loreReadTimes = [];
    this.loreLingerTimes = [];
    this.skippedMandatoryLore = 0;
    this.retreatDistance = 0;
    this.wallProximitySamples = 0;
    this.wallProximityHits = 0;
    this.lastEnemyDistance = null;
  }

  update(player: Player, boss: Phaser.GameObjects.Sprite | null, delta: number): void {
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
      if (boss) {
        const distToBoss = Phaser.Math.Distance.Between(player.x, player.y, boss.x, boss.y);
        this.distanceSamples.push(distToBoss);
        this.checkReaction(now, speed);
      }
    }

    // ── Wall proximity sampling ──────────────────────────────────
    this.wallProximitySamples += 1;
    const wallThreshold = TILE_SIZE * 1.5; // within ~1.5 tiles of world edge
    const worldW = this.worldWidth ?? INTERNAL_WIDTH;
    const worldH = this.worldHeight ?? INTERNAL_HEIGHT;
    if (
      player.x < wallThreshold ||
      player.x > worldW - wallThreshold ||
      player.y < wallThreshold ||
      player.y > worldH - wallThreshold
    ) {
      this.wallProximityHits += 1;
    }

    // ── Retreat tracking (distance increasing from nearest threat) ──
    if (boss) {
      const distToBoss = Phaser.Math.Distance.Between(player.x, player.y, boss.x, boss.y);
      if (this.lastEnemyDistance !== null && distToBoss > this.lastEnemyDistance) {
        this.retreatDistance += distToBoss - this.lastEnemyDistance;
      }
      this.lastEnemyDistance = distToBoss;
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
    this.recentShotResults.push(false);
    if (this.recentShotResults.length > 20) this.recentShotResults.shift();
  }

  recordShotHit(): void {
    this.shotsHit += 1;
    this.recentMissStreak = 0;
    const lastMissIndex = this.recentShotResults.lastIndexOf(false);
    if (lastMissIndex !== -1) this.recentShotResults[lastMissIndex] = true;
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

  setBossMaxHp(bossMaxHp: number): void {
    this.bossMaxHp = bossMaxHp;
  }

  setWorldBounds(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  // ── Story-aware recording methods ─────────────────────────────
  recordLoreInteraction(): void {
    this.loreInteractionCount += 1;
  }

  recordLoreRead(durationMs: number): void {
    this.loreReadTimes.push(durationMs / 1000);
  }

  recordLoreLinger(durationMs: number): void {
    this.loreLingerTimes.push(durationMs / 1000);
  }

  recordMandatoryLoreSkipped(): void {
    this.skippedMandatoryLore += 1;
  }

  private worldWidth: number | null = null;
  private worldHeight: number | null = null;

  getCurrentZone(x: number, y: number): string {
    return this.computeZone(x, y);
  }

  getRecentAccuracy(lastN: number): number {
    const recent = this.recentShotResults.slice(-lastN);
    if (!recent.length) return 0;
    return recent.filter(Boolean).length / recent.length;
  }

  getRecentDodgeBias(): { left: number; right: number; up: number; down: number } {
    const cutoff = performance.now() - 15000;
    const bias = { left: 0, right: 0, up: 0, down: 0 };
    this.dashEvents
      .filter((event) => event.time >= cutoff)
      .forEach((event) => {
        bias[event.dir] += 1;
      });
    return bias;
  }

  getRawTelemetry(playerHp: number, playerMaxHp: number, bossHp: number): RawTelemetry {
    const accuracy = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const totalSamples = Object.values(this.heatmap).reduce((sum, v) => sum + v, 0) || 1;
    const cornerPct = (this.cornerSamples / totalSamples) * 100;
    const playerZone = this.getDominantZone();

    const wallBias = this.wallProximitySamples > 0
      ? (this.wallProximityHits / this.wallProximitySamples) * 100
      : 0;
    const avgLoreReadTime = this.loreReadTimes.length > 0
      ? this.loreReadTimes.reduce((s, v) => s + v, 0) / this.loreReadTimes.length
      : 0;
    const avgLoreLingerTime = this.loreLingerTimes.length > 0
      ? this.loreLingerTimes.reduce((s, v) => s + v, 0) / this.loreLingerTimes.length
      : 0;

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
      // Story-aware fields
      loreInteractionCount: this.loreInteractionCount,
      timeSpentReadingLore: this.loreReadTimes.reduce((s, v) => s + v, 0),
      loreLingerTime: avgLoreLingerTime,
      skippedMandatoryLore: this.skippedMandatoryLore,
      retreatDistance: this.retreatDistance,
      wallBias,
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
      // Story-aware telemetry
      lore_interaction_count: this.loreInteractionCount,
      time_spent_reading_lore: this.loreReadTimes.reduce((s, v) => s + v, 0),
      lore_linger_time_avg: this.average(this.loreLingerTimes),
      skipped_mandatory_lore: this.skippedMandatoryLore,
      retreat_distance: this.retreatDistance,
      wall_bias_pct: this.wallProximitySamples > 0
        ? (this.wallProximityHits / this.wallProximitySamples) * 100
        : 0,
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
