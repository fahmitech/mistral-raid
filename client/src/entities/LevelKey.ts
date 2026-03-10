import Phaser from 'phaser';

export class LevelKey extends Phaser.Physics.Arcade.Sprite {
  private collected = false;
  private collectHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, LevelKey.ensureTexture(scene));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(7);
    const displayScale = 0.25;
    this.setScale(displayScale);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setAllowGravity(false);
      body.setCircle(6, 2, 2);
    }
    this.setAlpha(0.95);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.8, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  onCollect(handler: () => void): void {
    this.collectHandler = handler;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.collectHandler?.();
    this.scene.tweens.killTweensOf(this);
    this.disableBody(true, true);
  }

  private static ensureTexture(scene: Phaser.Scene): string {
    const key = 'ui_gate_key';
    if (scene.textures.exists(key)) return key;
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.setVisible(false);
    const w = 120;
    const h = 40;
    gfx.clear();
    gfx.translateCanvas(w / 2, h / 2);
    gfx.rotateCanvas(-Phaser.Math.DegToRad(30));
    gfx.translateCanvas(-w / 2, -h / 2);

    const gold = 0xc8a034;
    const highlight = 0xe8c050;
    const shadow = 0x7a5c18;

    // Shaft
    gfx.fillStyle(gold, 1);
    gfx.fillRect(40, 14, 70, 12);
    gfx.fillRect(100, 20, 12, 10);
    gfx.fillRect(112, 22, 8, 8);
    gfx.lineStyle(2, shadow, 1);
    gfx.strokeRect(40, 14, 70, 12);
    gfx.strokeRect(100, 20, 12, 10);
    gfx.strokeRect(112, 22, 8, 8);
    gfx.lineStyle(2, highlight, 0.8);
    gfx.beginPath();
    gfx.moveTo(42, 16);
    gfx.lineTo(108, 16);
    gfx.strokePath();

    // Ring
    gfx.fillStyle(gold, 1);
    gfx.fillCircle(28, 20, 18);
    gfx.fillStyle(0x1a1208, 1);
    gfx.fillCircle(28, 20, 10);
    gfx.lineStyle(3, shadow, 1);
    gfx.strokeCircle(28, 20, 18);
    gfx.lineStyle(1.5, highlight, 0.8);
    gfx.beginPath();
    gfx.arc(22, 12, 6, Phaser.Math.DegToRad(240), Phaser.Math.DegToRad(360), false);
    gfx.strokePath();
    gfx.fillStyle(0xfff6c0, 0.8);
    gfx.fillCircle(20, 10, 3);
    gfx.fillStyle(0xfff6c0, 0.6);
    gfx.fillCircle(70, 12, 2);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
    return key;
  }
}
