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
  aimAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, spriteKey: string, weaponConfig: ItemConfig) {
    super(scene, x, y, spriteKey);
    this.weaponSprite = scene.add.image(x + 8, y + 4, weaponConfig.sprite);
    this.weaponSprite.setOrigin(0.5, 0.85);
    this.weaponSprite.setDepth(11);
    this.setDepth(10);
    this.setOrigin(0.5, 0.6);
    this.setScale(1);
  }

  initPhysics(): void {
    // Arcade body is created only after `scene.physics.add.existing(this)`.
    if (!this.body) return;
    this.ensureAnims();
    this.setCollideWorldBounds(true);
    this.body?.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT).setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y);
  }

  ensureAnims(): void {
    const self = this as unknown as { anims?: unknown; scene?: Phaser.Scene };
    if (self.anims) return;
    const AnimationState = (Phaser.Animations as unknown as { AnimationState?: new (parent: unknown) => unknown })
      .AnimationState;
    if (!AnimationState) return;
    self.anims = new AnimationState(this);
  }

  setWeapon(config: ItemConfig): void {
    this.weaponSprite.setTexture(config.sprite);
    if (config.sprite.startsWith('bomb')) {
      this.weaponSprite.setOrigin(0.5, 0.5);
    } else {
      this.weaponSprite.setOrigin(0.5, 0.85);
    }
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

  updateWeaponPosition(targetX?: number, targetY?: number): void {
    if (typeof targetX === 'number' && typeof targetY === 'number') {
      this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    }

    const step = (Math.PI * 2) / 8;
    const snapped = Math.round(this.aimAngle / step) * step;

    const holdRadius = 10;
    const offsetX = Math.cos(snapped) * holdRadius;
    const offsetY = Math.sin(snapped) * holdRadius;

    this.weaponSprite.setPosition(this.x + offsetX, this.y + offsetY);

    // Most 0x72 weapon sprites are oriented "up" by default, so rotate from up -> angle.
    this.weaponSprite.setRotation(snapped + Math.PI / 2);

    // Put weapon behind player when aiming upwards, in front otherwise.
    this.weaponSprite.setDepth(Math.sin(snapped) < -0.2 ? 9 : 11);
  }
}
