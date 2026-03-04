import Phaser from 'phaser';
import {
  BOSS_AGGRO_RANGE,
  BOSS_BURST_COUNT,
  BOSS_CHARGE_DURATION_MS,
  BOSS_CHARGE_SPEED_MULT,
  BOSS_MELEE_RANGE,
  BOSS_SUMMON_COOLDOWN_MS,
} from '../config/constants';
import { BossConfig, EnemyType } from '../config/types';
import type { BossDirective } from '../types/arena';
import { Player } from './Player';

export interface BossActions {
  shootProjectile: (x: number, y: number, vx: number, vy: number, damage: number, color: number) => void;
  spawnEnemy: (type: EnemyType, x: number, y: number) => void;
  shake: (duration: number, intensity: number) => void;
}

export class BossEntity extends Phaser.Physics.Arcade.Sprite {
  config: BossConfig;
  hp: number;
  maxHP: number;
  phase = 1;
  private phaseThresholds: number[];
  private lastAttackAt = 0;
  private lastSummonAt = 0;
  private charging = false;
  private chargeUntil = 0;
  private chargeDir = new Phaser.Math.Vector2(0, 0);
  private directive: BossDirective | null = null;
  private directiveExpiresAt = 0;
  private circleAngle = 0;
  private spiralAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: BossConfig) {
    super(scene, x, y, config.spriteKey);
    this.config = config;
    this.hp = config.hp;
    this.maxHP = config.hp;
    this.setScale(config.scale);
    this.setDepth(10);
    this.phaseThresholds = this.buildThresholds(config);
  }

  applyDamage(amount: number): { died: boolean; phaseChanged: boolean } {
    this.hp -= amount;
    if (this.hp <= 0) {
      return { died: true, phaseChanged: false };
    }
    const nextThreshold = this.phaseThresholds[this.phase - 1];
    if (nextThreshold !== undefined && this.hp <= nextThreshold) {
      this.phase += 1;
      if (this.phase >= 2) {
        this.setTint(this.config.phase2Tint);
      }
      return { died: false, phaseChanged: true };
    }
    return { died: false, phaseChanged: false };
  }

  applyDirective(directive: BossDirective, currentTime: number): void {
    this.directive = directive;
    this.directiveExpiresAt = currentTime + directive.duration_ms;
  }

  clearDirective(): void {
    this.directive = null;
    this.directiveExpiresAt = 0;
  }

  updateAI(player: Player, time: number, actions: BossActions): void {
    if (!this.body) return;

    if (this.directive && time >= this.directiveExpiresAt) {
      this.directive = null;
      this.directiveExpiresAt = 0;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist > BOSS_AGGRO_RANGE) {
      this.setVelocity(0, 0);
      return;
    }

    if (this.directive) {
      if (this.applyDirectiveMovement(player, time)) {
        return;
      }

      if (this.phase >= 3 && this.config.phases >= 3 && time - this.lastSummonAt > BOSS_SUMMON_COOLDOWN_MS) {
        this.lastSummonAt = time;
        for (let i = 0; i < 2; i += 1) {
          actions.spawnEnemy(
            EnemyType.Goblin,
            this.x + Phaser.Math.Between(-22, 22),
            this.y + Phaser.Math.Between(-22, 22)
          );
        }
      }

      const cooldown = Math.max(400, this.directive.attack_cooldown_ms);
      if (time - this.lastAttackAt < cooldown) return;
      this.lastAttackAt = time;
      this.executeDirectiveAttack(player, time, actions);
      return;
    }

    if (this.charging) {
      if (time >= this.chargeUntil) {
        this.charging = false;
        this.setVelocity(0, 0);
        return;
      }
      const speed = this.getPhaseSpeed() * BOSS_CHARGE_SPEED_MULT;
      this.setVelocity(this.chargeDir.x * speed, this.chargeDir.y * speed);
      return;
    }

    const speed = this.getPhaseSpeed();
    if (dist > BOSS_MELEE_RANGE) {
      this.scene.physics.moveToObject(this, player, speed);
    } else {
      this.setVelocity(0, 0);
    }

    if (this.phase >= 3 && this.config.phases >= 3 && time - this.lastSummonAt > BOSS_SUMMON_COOLDOWN_MS) {
      this.lastSummonAt = time;
      for (let i = 0; i < 2; i += 1) {
        actions.spawnEnemy(
          EnemyType.Goblin,
          this.x + Phaser.Math.Between(-22, 22),
          this.y + Phaser.Math.Between(-22, 22)
        );
      }
    }

    const cooldown = this.config.attackCooldownMs / this.phase;
    if (time - this.lastAttackAt < cooldown) return;
    this.lastAttackAt = time;

    if (this.phase === 1) {
      this.fireAimedShot(player, actions);
      return;
    }

    if (Math.random() < 0.6) {
      this.fireBurst(player, actions);
    } else {
      this.startCharge(player, time, actions);
    }
  }

  private applyDirectiveMovement(player: Player, time: number): boolean {
    if (this.charging) {
      if (time >= this.chargeUntil) {
        this.charging = false;
        this.setVelocity(0, 0);
      } else {
        const speed = this.getPhaseSpeed() * BOSS_CHARGE_SPEED_MULT;
        this.setVelocity(this.chargeDir.x * speed, this.chargeDir.y * speed);
      }
      return true;
    }

    if (!this.directive) return false;
    const speed = this.getPhaseSpeed() * this.directive.speed_multiplier;

    switch (this.directive.movement_mode) {
      case 'chase': {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist > BOSS_MELEE_RANGE) {
          this.scene.physics.moveToObject(this, player, speed);
        } else {
          this.setVelocity(0, 0);
        }
        break;
      }
      case 'circle': {
        const radius = this.directive.circle_radius ?? 120;
        this.circleAngle += speed / Math.max(radius, 1) / 60;
        const targetX = player.x + Math.cos(this.circleAngle) * radius;
        const targetY = player.y + Math.sin(this.circleAngle) * radius;
        this.scene.physics.moveTo(this, targetX, targetY, speed * 2);
        break;
      }
      case 'strafe': {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const perpendicular = angle + Math.PI / 2;
        const flip = Math.floor(time / 2000) % 2 === 0 ? 1 : -1;
        this.setVelocity(
          Math.cos(perpendicular) * speed * flip,
          Math.sin(perpendicular) * speed * flip
        );
        break;
      }
      case 'retreat': {
        const retreatAngle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
        const retreatDistance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const targetDistance = BOSS_AGGRO_RANGE * 0.8;
        if (retreatDistance < targetDistance) {
          this.setVelocity(Math.cos(retreatAngle) * speed, Math.sin(retreatAngle) * speed);
        } else {
          this.setVelocity(0, 0);
        }
        break;
      }
      case 'idle':
      default:
        this.setVelocity(0, 0);
        break;
    }

    return false;
  }

  private executeDirectiveAttack(player: Player, time: number, actions: BossActions): void {
    if (!this.directive) return;

    switch (this.directive.attack_mode) {
      case 'aimed_shot':
        this.fireAimedShot(player, actions);
        break;
      case 'burst':
        this.fireBurst(player, actions);
        break;
      case 'charge':
        this.startCharge(player, time, actions);
        break;
      case 'ring':
        this.fireRing(actions);
        break;
      case 'fan':
        this.fireFan(player, actions, 5, 120);
        break;
      case 'spiral':
        this.fireSpiral(actions);
        break;
      case 'suppress':
      default:
        this.fireAimedShot(player, actions);
        break;
    }
  }

  private fireRing(actions: BossActions): void {
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      actions.shootProjectile(
        this.x,
        this.y,
        Math.cos(angle),
        Math.sin(angle),
        this.config.damage,
        this.config.projectileColor
      );
    }
    actions.shake(60, 0.002);
  }

  private fireFan(player: Player, actions: BossActions, count: number, spreadDeg: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const spread = Phaser.Math.DegToRad(spreadDeg);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = baseAngle - spread / 2 + t * spread;
      actions.shootProjectile(
        this.x,
        this.y,
        Math.cos(angle),
        Math.sin(angle),
        this.config.damage,
        this.config.projectileColor
      );
    }
    actions.shake(80, 0.0025);
  }

  private fireSpiral(actions: BossActions): void {
    const count = 3;
    for (let i = 0; i < count; i += 1) {
      const angle = this.spiralAngle + (i / count) * Math.PI * 2;
      actions.shootProjectile(
        this.x,
        this.y,
        Math.cos(angle),
        Math.sin(angle),
        this.config.damage,
        this.config.projectileColor
      );
    }
    this.spiralAngle += 0.35;
  }

  private getPhaseSpeed(): number {
    const mult = 1 + (this.phase - 1) * 0.25;
    return this.config.speed * mult;
  }

  private fireAimedShot(player: Player, actions: BossActions): void {
    const dir = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
    if (dir.lengthSq() < 0.0001) return;
    dir.normalize();
    actions.shootProjectile(this.x, this.y, dir.x, dir.y, this.config.damage, this.config.projectileColor);
  }

  private fireBurst(player: Player, actions: BossActions): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const spread = Phaser.Math.DegToRad(90);
    const count = Math.max(1, BOSS_BURST_COUNT);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = baseAngle - spread / 2 + t * spread;
      actions.shootProjectile(
        this.x,
        this.y,
        Math.cos(angle),
        Math.sin(angle),
        this.config.damage,
        this.config.projectileColor
      );
    }
    actions.shake(80, 0.0025);
  }

  private startCharge(player: Player, time: number, actions: BossActions): void {
    const dir = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
    if (dir.lengthSq() < 0.0001) return;
    dir.normalize();
    this.chargeDir.copy(dir);
    this.charging = true;
    this.chargeUntil = time + BOSS_CHARGE_DURATION_MS;
    actions.shake(120, 0.004);
  }

  private buildThresholds(config: BossConfig): number[] {
    if (config.phases === 2) {
      return [config.hp * 0.5];
    }
    if (config.phases === 3) {
      return [config.hp * 0.66, config.hp * 0.33];
    }
    return [];
  }
}
