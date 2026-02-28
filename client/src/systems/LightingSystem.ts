import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, PLAYER_LIGHT_RADIUS, TORCH_RADIUS } from '../config/constants';

export class LightingSystem {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.RenderTexture;
  private lightTextureKey = 'light-circle';
  private lightSprite: Phaser.GameObjects.Image;
  private fogAlpha = 0.65;
  private torchPositions: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene, fogAlpha: number) {
    this.scene = scene;
    this.fogAlpha = fogAlpha;
    this.overlay = scene.add.renderTexture(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT).setOrigin(0, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(19);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    if (!scene.textures.exists(this.lightTextureKey)) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(64, 64, 64);
      gfx.generateTexture(this.lightTextureKey, 128, 128);
      gfx.destroy();
    }

    this.lightSprite = scene.add
      .image(0, 0, this.lightTextureKey)
      .setVisible(false)
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  setTorches(positions: { x: number; y: number }[]): void {
    this.torchPositions = positions;
  }

  update(playerX: number, playerY: number): void {
    const cam = this.scene.cameras.main;
    this.overlay.clear();
    this.overlay.fill(0x000000, this.fogAlpha);

    const playerScreenX = playerX - cam.scrollX;
    const playerScreenY = playerY - cam.scrollY;
    this.lightSprite.setPosition(playerScreenX, playerScreenY);
    this.lightSprite.setScale(PLAYER_LIGHT_RADIUS / 64);
    this.overlay.erase(this.lightSprite);

    for (const torch of this.torchPositions) {
      const flicker = 0.9 + Math.random() * 0.2;
      const tx = torch.x - cam.scrollX;
      const ty = torch.y - cam.scrollY;
      this.lightSprite.setPosition(tx, ty);
      this.lightSprite.setScale((TORCH_RADIUS / 64) * flicker);
      this.overlay.erase(this.lightSprite);
    }
  }
}
