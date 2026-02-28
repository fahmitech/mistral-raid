import Phaser from 'phaser';
import { BossConfig } from '../config/types';

export class BossEntity extends Phaser.Physics.Arcade.Sprite {
  config: BossConfig;
  hp: number;
  maxHP: number;
  phase = 1;
  private phaseThresholds: number[];

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
