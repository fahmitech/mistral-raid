import Phaser from 'phaser';
import {
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_OFFSET_X,
  PLAYER_BODY_OFFSET_Y,
  PLAYER_BODY_WIDTH,
} from '../config/constants';
import { ItemConfig, ItemType, WeaponConfig } from '../config/types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  weaponSprite: Phaser.GameObjects.Sprite;
  invincibleUntil = 0;
  dashCooldownUntil = 0;
  dashActiveUntil = 0;
  dashVelocity = new Phaser.Math.Vector2(0, 0);
  shieldCooldownUntil = 0;
  shieldActiveUntil = 0;
  lastDir = new Phaser.Math.Vector2(1, 0);
  aimAngle = 0;
  private invincibleTintOn = false;
  private weaponHoldOffset = new Phaser.Math.Vector2(0, 3);
  private weaponRotationOffset = Math.PI / 2;
  private weaponScale = 1;
  private currentWeaponType: ItemType = ItemType.WeaponSword;
  private sceneRef: Phaser.Scene;

  // NEW: Player stats for buff system
  baseDamage: number = 1;
  critChance: number = 0.05;
  critMultiplier: number = 1.75;
  maxHp: number = 6;
  attackSpeed: number = 1.0;
  hitCounter: number = 0;  // Track consecutive hits for dynamic crit gain

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spriteKey: string,
    weaponItem: ItemConfig,
    weaponConfig: WeaponConfig
  ) {
    super(scene, x, y, spriteKey);
    this.sceneRef = scene;
    this.weaponSprite = scene.add.sprite(x + 8, y + 4, weaponItem.sprite);
    this.weaponSprite.setDepth(18);
    this.setDepth(17);
    this.setOrigin(0.5, 0.6);
    this.setScale(1);
    this.setWeapon(weaponItem, weaponConfig, weaponItem.type);
  }

  initPhysics(): void {
    // Arcade body is created only after `scene.physics.add.existing(this)`.
    if (!this.body) return;
    this.setCollideWorldBounds(true);
    this.body?.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT).setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y);
  }

  setWeapon(itemConfig: ItemConfig, weaponConfig: WeaponConfig, type: ItemType): void {
    this.currentWeaponType = type;
    this.weaponSprite.setTexture(itemConfig.sprite);
    this.weaponScale = weaponConfig.weaponScale ?? 1;
    this.weaponSprite.setScale(this.weaponScale);
    this.weaponHoldOffset.set(weaponConfig.holdOffset.x, weaponConfig.holdOffset.y);
    this.weaponRotationOffset = weaponConfig.rotationOffset;
    const originY = itemConfig.sprite.startsWith('bomb') ? 0.5 : 0.92;
    this.weaponSprite.setOrigin(0.5, originY);
    this.weaponSprite.anims?.stop();
    if (weaponConfig.holdAnimationKey && this.scene.anims.exists(weaponConfig.holdAnimationKey)) {
      this.weaponSprite.play(weaponConfig.holdAnimationKey);
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
    // Defensive: if `now` is ever invalid (e.g. NaN), never leave the player invisible.
    if (!Number.isFinite(now)) {
      this.setVisible(true);
      this.setAlpha(1);
      this.invincibleTintOn = false;
      this.clearTint();
      return;
    }

    if (this.isInvincible(now)) {
      // Keep the body fully visible. Under the fog-of-war multiply overlay, alpha blinking
      // (and even some tint-fill approaches) can make the sprite appear to disappear on
      // certain frames/palettes. Use a stable tint instead.
      if (!this.invincibleTintOn) {
        this.invincibleTintOn = true;
        this.setTint(0xff7777);
      }
      this.setVisible(true);
      this.setAlpha(1);
    } else {
      this.setVisible(true);
      this.setAlpha(1);
      if (this.invincibleTintOn) {
        this.invincibleTintOn = false;
        this.clearTint();
      }
    }
  }

  updateWeaponPosition(targetX?: number, targetY?: number): void {
    if (typeof targetX === 'number' && typeof targetY === 'number') {
      this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    }

    const angle = this.aimAngle;

    const holdRadius = 9;
    const offsetX = Math.cos(angle) * holdRadius;
    const offsetY = Math.sin(angle) * holdRadius;

    const baseX = this.x + this.weaponHoldOffset.x;
    const baseY = this.y + this.weaponHoldOffset.y;
    this.weaponSprite.setPosition(baseX + offsetX, baseY + offsetY);

    // Most 0x72 weapon sprites are oriented "up" by default, so rotate from up -> angle.
    this.weaponSprite.setRotation(angle + this.weaponRotationOffset);

    // Put weapon behind player when aiming upwards, in front otherwise.
    const playerDepth = this.depth ?? 0;
    this.weaponSprite.setDepth(Math.sin(angle) < -0.2 ? playerDepth - 1 : playerDepth + 1);
  }

  playWeaponAttack(_config: WeaponConfig, weapon: ItemType): void {
    const swing = weapon === ItemType.WeaponHammer ? Phaser.Math.DegToRad(35) : Phaser.Math.DegToRad(12);
    const duration = weapon === ItemType.WeaponHammer ? 160 : weapon === ItemType.WeaponKatana ? 140 : 90;
    const scaleBump = weapon === ItemType.WeaponHammer ? 0.12 : weapon === ItemType.WeaponKatana ? 0.08 : 0.05;
    this.sceneRef.tweens.killTweensOf(this.weaponSprite);
    this.sceneRef.tweens.add({
      targets: this.weaponSprite,
      rotation: this.weaponSprite.rotation + swing,
      duration,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    this.sceneRef.tweens.add({
      targets: this.weaponSprite,
      scaleX: this.weaponScale + scaleBump,
      scaleY: this.weaponScale + scaleBump,
      duration: duration * 0.5,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    if (weapon === ItemType.WeaponDagger) {
      this.sceneRef.tweens.add({
        targets: this.weaponSprite,
        alpha: { from: 1, to: 0.4 },
        duration: 60,
        yoyo: true,
      });
    }
  }

  setAimAngle(angle: number): void {
    if (!Number.isFinite(angle)) return;
    this.aimAngle = angle;
  }
}
