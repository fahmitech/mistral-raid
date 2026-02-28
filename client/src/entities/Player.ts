import Phaser from 'phaser';
import {
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_OFFSET_X,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_BODY_WIDTH,
} from '../config/constants';
import { ItemConfig } from '../config/types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  weaponSprite: Phaser.GameObjects.Image;
  invincibleUntil = 0;
  dashCooldownUntil = 0;
  shieldCooldownUntil = 0;
  shieldActiveUntil = 0;
  lastDir = new Phaser.Math.Vector2(1, 0);

  constructor(scene: Phaser.Scene, x: number, y: number, spriteKey: string, weaponConfig: ItemConfig) {
    super(scene, x, y, spriteKey);
    this.weaponSprite = scene.add.image(x + 8, y + 4, weaponConfig.sprite);
    this.weaponSprite.setDepth(11);
    this.setDepth(10);
    this.setOrigin(0.5, 0.6);
    this.setScale(1);
  }

  initPhysics(): void {
    // Arcade body is created only after `scene.physics.add.existing(this)`.
    this.setCollideWorldBounds(true);
    this.body?.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT).setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y);
  }

  setWeapon(config: ItemConfig): void {
    this.weaponSprite.setTexture(config.sprite);
  }

  setInvincible(durationMs: number, now: number): void {
    this.invincibleUntil = Math.max(this.invincibleUntil, now + durationMs);
  }

  isInvincible(now: number): boolean {
    return now < this.invincibleUntil;
  }

  setShieldActive(durationMs: number, now: number): void {
    this.shieldActiveUntil = now + durationMs;
  }

  isShieldActive(now: number): boolean {
    return now < this.shieldActiveUntil;
  }

  updateFacing(dir: Phaser.Math.Vector2): void {
    if (dir.lengthSq() > 0.01) {
      this.lastDir.copy(dir).normalize();
    }
  }

  updateBlink(now: number): void {
    if (this.isInvincible(now)) {
      const t = (now % 200) / 200;
      this.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 2)));
    } else {
      this.setAlpha(1);
    }
  }

  updateWeaponPosition(): void {
    const offsetX = this.flipX ? -8 : 8;
    this.weaponSprite.setPosition(this.x + offsetX, this.y + 4);
    this.weaponSprite.setFlipX(this.flipX);
  }
}
