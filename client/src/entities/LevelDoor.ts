import Phaser from 'phaser';

export interface LevelDoorOptions {
  closedTexture: string;
  openTexture: string;
  tint?: number;
}

export class LevelDoor extends Phaser.Physics.Arcade.Sprite {
  private locked = true;
  private readonly openTexture: string;

  constructor(scene: Phaser.Scene, x: number, y: number, options: LevelDoorOptions) {
    super(scene, x, y, options.closedTexture);
    this.openTexture = options.openTexture;
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(8);
    this.setOrigin(0.5, 1);
    if (options.tint) {
      this.setTint(options.tint);
    }
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    body?.setSize(18, 28);
  }

  isLocked(): boolean {
    return this.locked;
  }

  open(): void {
    if (!this.locked) return;
    this.locked = false;
    this.setTexture(this.openTexture);
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) {
      body.checkCollision.none = true;
      body.enable = false;
    }
  }
}
