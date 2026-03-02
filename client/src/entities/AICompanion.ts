import Phaser from 'phaser';
import {
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_OFFSET_X,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_BODY_WIDTH,
} from '../config/constants';
import type { CompanionPersonality } from '../systems/CoopState';

export interface CompanionDecision {
  movement: 'north' | 'south' | 'east' | 'west' | 'idle';
  attack: boolean;
  target_id: number | null;
  dash: boolean;
  protect: boolean;
  speak: string | null;
}

/** Callback the companion uses to fire a projectile (handled by LevelScene). */
export type CompanionShootCallback = (
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number
) => void;

// ── Tuning constants ──────────────────────────────────────────────────────────
const COMPANION_CHASE_SPEED   = 100; // speed while pursuing an enemy
const COMPANION_FOLLOW_SPEED  = 90;  // speed while following the player (no enemies)
const COMPANION_DASH_COOLDOWN_MS = 1600;
const COMPANION_FIRE_RATE_MS  = 480; // ms between shots
const COMPANION_ATTACK_RANGE  = 120; // start shooting when closer than this
const COMPANION_OPTIMAL_DIST  = 55;  // preferred distance from enemy while shooting
const COMPANION_LEASH_DIST    = 55;  // idle follow distance from player (no enemies)
const COMPANION_MAX_ENEMY_DIST = 180; // only chase enemies within this radius of the player
const COMPANION_RETURN_DIST   = 140; // companion snaps back to player if farther than this

export class AICompanion extends Phaser.Physics.Arcade.Sprite {
  readonly personality: CompanionPersonality;
  hp: number;
  readonly maxHp: number;

  dashCooldownUntil = 0;
  lastShotAt = 0;

  /** Set once by LevelScene after physics is enabled. */
  onShoot: CompanionShootCallback | null = null;

  /** Decorative aura displayed by LevelScene. */
  aura: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spriteKey: string,
    personality: CompanionPersonality,
    hp = 6
  ) {
    super(scene, x, y, spriteKey);
    this.personality = personality;
    this.hp = hp;
    this.maxHp = hp;
    this.setDepth(17);
    this.setOrigin(0.5, 0.6);

    // Purple aura to distinguish companion from player
    this.aura = scene.add.arc(x, y, 9, 0, 360, false, 0x8844ff, 0.25).setDepth(16);
  }

  initPhysics(): void {
    if (!this.body) return;
    this.setCollideWorldBounds(true);
    (this.body as Phaser.Physics.Arcade.Body)
      .setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT)
      .setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y);
  }

  /**
   * Main update call from LevelScene every frame.
   *
   * Core loop (runs regardless of Mistral decision):
   *   1. Find nearest active enemy across the entire scene.
   *   2. If an enemy exists → chase it and shoot when in range.
   *   3. If no enemies exist → follow the player.
   *
   * Mistral decision only refines:
   *   - Which enemy to prioritize (target_id)
   *   - Whether to dash
   *   - The speak line (shown by LevelScene)
   *   - "protect" mode: temporarily stop chasing and glue to player
   */
  tick(
    decision: CompanionDecision | null,
    playerX: number,
    playerY: number,
    enemies: Phaser.Physics.Arcade.Group,
    time: number
  ): void {
    // Protect mode from Mistral: ignore enemies, rush to player
    if (decision?.protect) {
      this.moveToward(playerX, playerY, COMPANION_FOLLOW_SPEED * 1.2);
      this.aura.setPosition(this.x, this.y);
      return;
    }

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);

    // Leash: if companion has strayed too far from the player, snap back first
    if (distToPlayer > COMPANION_RETURN_DIST) {
      this.moveToward(playerX, playerY, COMPANION_FOLLOW_SPEED * 1.2);
      this.aura.setPosition(this.x, this.y);
      return;
    }

    // Find the best target — only enemies near the player
    const target = this.pickTarget(decision?.target_id ?? null, enemies, playerX, playerY);

    if (target) {
      this.chaseAndAttack(target, time);
    } else {
      // No enemies in range — follow the player
      if (distToPlayer > COMPANION_LEASH_DIST) {
        this.moveToward(playerX, playerY, COMPANION_FOLLOW_SPEED);
      } else {
        this.setVelocity(0, 0);
        this.syncIdleAnim();
      }
    }

    // Low-HP dash away from danger
    if (this.hp / this.maxHp < 0.3 && time >= this.dashCooldownUntil) {
      const target2 = this.pickTarget(null, enemies, playerX, playerY);
      if (target2) {
        const angle = Phaser.Math.Angle.Between(target2.x, target2.y, this.x, this.y);
        this.dash(Math.cos(angle), Math.sin(angle), time);
      }
    }

    // Explicit dash from Mistral
    if (decision?.dash && time >= this.dashCooldownUntil) {
      const angle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y);
      this.dash(Math.cos(angle), Math.sin(angle), time);
    }

    this.aura.setPosition(this.x, this.y);
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.setTint(0xff6666);
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.clearTint();
    });
  }

  dash(dirX: number, dirY: number, time: number): void {
    if (time < this.dashCooldownUntil) return;
    const bounds = this.scene.physics.world.bounds;
    const newX = Phaser.Math.Clamp(this.x + dirX * 40, bounds.x + 8, bounds.right - 8);
    const newY = Phaser.Math.Clamp(this.y + dirY * 40, bounds.y + 8, bounds.bottom - 8);
    this.setPosition(newX, newY);
    this.dashCooldownUntil = time + COMPANION_DASH_COOLDOWN_MS;
    this.setTint(0x00ffee);
    this.scene.time.delayedCall(90, () => { if (this.active) this.clearTint(); });
  }

  destroyCompanion(): void {
    this.aura?.destroy();
    this.destroy();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Find the best enemy to attack.
   * If target_id is provided (from Mistral) and that enemy is still alive, prefer it.
   * Otherwise return the nearest active enemy (whole map).
   */
  private pickTarget(
    targetId: number | null,
    enemies: Phaser.Physics.Arcade.Group,
    playerX: number,
    playerY: number
  ): Phaser.Physics.Arcade.Sprite | null {
    const all = enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    // Only consider enemies within the player-relative chase radius
    const active = all.filter(
      (e) =>
        e.active &&
        Phaser.Math.Distance.Between(e.x, e.y, playerX, playerY) <= COMPANION_MAX_ENEMY_DIST
    );
    if (active.length === 0) return null;

    // Try Mistral-preferred target first (must also be in range)
    if (targetId !== null) {
      const preferred = all[targetId];
      if (
        preferred?.active &&
        Phaser.Math.Distance.Between(preferred.x, preferred.y, playerX, playerY) <= COMPANION_MAX_ENEMY_DIST
      ) {
        return preferred;
      }
    }

    // Fall back to nearest active enemy in range
    return active.reduce((best, e) => {
      const dBest = Phaser.Math.Distance.Between(this.x, this.y, best.x, best.y);
      const dE    = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      return dE < dBest ? e : best;
    });
  }

  /**
   * Chase an enemy and shoot it when close enough.
   * - If farther than ATTACK_RANGE → sprint toward it.
   * - If within OPTIMAL_DIST → stand still and shoot.
   * - Between the two → slow approach while shooting.
   */
  private chaseAndAttack(target: Phaser.Physics.Arcade.Sprite, time: number): void {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (dist > COMPANION_ATTACK_RANGE) {
      // Too far to shoot — sprint
      this.moveToward(target.x, target.y, COMPANION_CHASE_SPEED);
    } else if (dist > COMPANION_OPTIMAL_DIST) {
      // In shooting range but not yet optimal — slow approach + shoot
      this.moveToward(target.x, target.y, COMPANION_CHASE_SPEED * 0.5);
      this.shoot(target, time);
    } else {
      // Optimal distance — stand and shoot
      this.setVelocity(0, 0);
      this.shoot(target, time);
    }

    // Flip sprite toward target
    if (target.x > this.x) this.setFlipX(false);
    else this.setFlipX(true);
  }

  private shoot(target: Phaser.Physics.Arcade.Sprite, time: number): void {
    if (!this.onShoot) return;
    if (time - this.lastShotAt < COMPANION_FIRE_RATE_MS) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const speed = 170;
    this.onShoot(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
    this.lastShotAt = time;
  }

  private moveToward(targetX: number, targetY: number, speed: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    if (Math.cos(angle) > 0) this.setFlipX(false);
    else this.setFlipX(true);
    this.syncRunAnim();
  }

  private syncRunAnim(): void {
    const spriteKey = this.texture.key.replace('_idle_anim_f0', '').replace('_anim_f0', '');
    const runKey = `${spriteKey}_run`;
    if (this.scene.anims.exists(runKey) && this.anims.currentAnim?.key !== runKey) {
      this.play(runKey, true);
    }
  }

  private syncIdleAnim(): void {
    const spriteKey = this.texture.key.replace('_idle_anim_f0', '').replace('_anim_f0', '');
    const idleKey = `${spriteKey}_idle`;
    if (this.scene.anims.exists(idleKey) && this.anims.currentAnim?.key !== idleKey) {
      this.play(idleKey, true);
    }
  }
}
