import Phaser from 'phaser';
import {
  ENEMY_AGGRO_RANGE,
  ENEMY_PATROL_SPEED,
  ENEMY_RANGED_COOLDOWN_MS,
  ENEMY_RANGED_RANGE,
  ENEMY_SUMMON_COOLDOWN_MS,
  ENEMY_TELEPORT_COOLDOWN_MS,
} from '../config/constants';
import { EnemyBehavior, EnemyConfig, EnemyType } from '../config/types';
import { Player } from './Player';

export interface EnemyActions {
  shootProjectile: (x: number, y: number, vx: number, vy: number, damage: number, color: number) => void;
  spawnEnemy: (type: EnemyType, x: number, y: number) => void;
  shake: (duration: number, intensity: number) => void;
  /** Spatialized SFX callback — implemented by LevelScene via AudioManager.playSFXAt. */
  playSound?: (x: number, y: number, sfxName: string) => void;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  config: EnemyConfig;
  hp: number;
  maxHP: number;
  xp: number;
  patrolDir = new Phaser.Math.Vector2(0, 0);
  nextPatrolChange = 0;
  lastShotAt = 0;
  lastTeleportAt = 0;
  lastSummonAt = 0;
  shielded = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y, config.spriteKey);
    this.config = config;
    this.hp = config.hp;
    this.maxHP = config.hp;
    this.xp = config.xp;
    this.shielded = config.behavior === EnemyBehavior.Shielded;
    this.setDepth(10);
    this.setScale(config.scale);
    if (this.shielded) {
      this.setTint(0x4488ff);
    }
  }

  updateAI(player: Player, time: number, actions: EnemyActions): void {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.config.behavior === EnemyBehavior.Teleporter && time - this.lastTeleportAt > ENEMY_TELEPORT_COOLDOWN_MS) {
      this.lastTeleportAt = time;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(50, 90);
      this.setPosition(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius);
      actions.shake(60, 0.003);
    }

    if (this.config.behavior === EnemyBehavior.RangedShoot) {
      if (dist <= ENEMY_RANGED_RANGE) {
        this.setVelocity(0, 0);
        if (time - this.lastShotAt > ENEMY_RANGED_COOLDOWN_MS) {
          this.lastShotAt = time;
          const dir = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();
          actions.shootProjectile(this.x, this.y, dir.x, dir.y, this.config.damage, this.config.projectileColor);
          if (this.config.attackSfx) {
            actions.playSound?.(this.x, this.y, this.config.attackSfx);
          }
        }
      } else if (dist <= ENEMY_AGGRO_RANGE * 1.5) {
        this.scene.physics.moveToObject(this, player, this.config.speed);
      } else {
        this.patrol(time);
      }
      return;
    }

    if (this.config.behavior === EnemyBehavior.Summoner) {
      if (time - this.lastSummonAt > ENEMY_SUMMON_COOLDOWN_MS) {
        this.lastSummonAt = time;
        actions.spawnEnemy(EnemyType.Goblin, this.x + Phaser.Math.Between(-16, 16), this.y + Phaser.Math.Between(-16, 16));
      }
    }

    if (dist <= ENEMY_AGGRO_RANGE) {
      this.scene.physics.moveToObject(this, player, this.config.speed);
    } else {
      this.patrol(time);
    }
  }

  patrol(time: number): void {
    if (time > this.nextPatrolChange) {
      this.nextPatrolChange = time + Phaser.Math.Between(1800, 3000);
      this.patrolDir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize();
    }
    this.setVelocity(this.patrolDir.x * ENEMY_PATROL_SPEED, this.patrolDir.y * ENEMY_PATROL_SPEED);
  }

  takeDamage(amount: number): void {
    if (this.config.behavior === EnemyBehavior.Shielded && this.hp > this.maxHP * 0.5) {
      amount = Math.max(1, Math.floor(amount * 0.5));
      this.setTint(0x4488ff);
    }
    this.hp -= amount;
    if (this.config.behavior === EnemyBehavior.Shielded && this.hp <= this.maxHP * 0.5) {
      this.clearTint();
    }
  }

  die(): void {
    // Score is awarded by LevelScene.handleEnemyHit().
  }
}
