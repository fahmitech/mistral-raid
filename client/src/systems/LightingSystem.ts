import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, PLAYER_LIGHT_RADIUS, TORCH_RADIUS } from '../config/constants';

export class LightingSystem {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.RenderTexture;
  private lightTextureKey = 'light-gradient';
  private lightSprite: Phaser.GameObjects.Image;
  private fogAlpha = 0.65;
  private fogColor = 0x060810;
  private torchPositions: { x: number; y: number }[] = [];
  private softEdgePx = 14;

  constructor(scene: Phaser.Scene, fogAlpha: number) {
    this.scene = scene;
    this.fogAlpha = fogAlpha;
    this.overlay = scene.add.renderTexture(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT).setOrigin(0, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(16);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    if (!scene.textures.exists(this.lightTextureKey)) {
      const gfx = scene.add.graphics();
      const size = 256;
      const center = size / 2;
      const radius = center;
      // Build a radial alpha falloff used as the erase brush to avoid hard-edged / inconsistent fog borders.
      for (let r = radius; r > 0; r -= 1) {
        const t = r / radius; // 1 at edge -> 0 at center
        const alpha = Math.pow(1 - t, 2.1);
        if (alpha <= 0) continue;
        gfx.fillStyle(0xffffff, alpha);
        gfx.fillCircle(center, center, r);
      }
      gfx.generateTexture(this.lightTextureKey, size, size);
      gfx.destroy();
    }

    // Used only as a brush for RenderTexture.erase; keep it off the display list,
    // but still renderable (visible) so erase actually draws something.
    this.lightSprite = scene.make.image({ x: 0, y: 0, key: this.lightTextureKey, add: false }).setOrigin(0.5);
  }

  setTorches(positions: { x: number; y: number }[]): void {
    // Defensive: filter invalid points and de-dupe so we don't accidentally "double erase"
    // (which can look like a second light source at a fixed position).
    const seen = new Set<string>();
    this.torchPositions = positions.filter((p) => {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  update(playerX: number, playerY: number): void {
    const cam = this.scene.cameras.main;
    this.overlay.clear();
    // Use a slightly bluish fog instead of pure black to help distinguish "unlit" fog
    // from very dark environmental tiles.
    this.overlay.fill(this.fogColor, this.fogAlpha);

    const playerScreenX = playerX - cam.scrollX;
    const playerScreenY = playerY - cam.scrollY;
    this.lightSprite.setPosition(playerScreenX, playerScreenY);
    this.lightSprite.setScale(PLAYER_LIGHT_RADIUS / 128);
    this.overlay.erase(this.lightSprite);

    for (const torch of this.torchPositions) {
      const flicker = 0.9 + Math.random() * 0.2;
      const tx = torch.x - cam.scrollX;
      const ty = torch.y - cam.scrollY;
      this.lightSprite.setPosition(tx, ty);
      this.lightSprite.setScale((TORCH_RADIUS / 128) * flicker);
      this.overlay.erase(this.lightSprite);
    }
  }

  getLightFactor(worldX: number, worldY: number, playerX: number, playerY: number): number {
    const player = this.falloff(worldX, worldY, playerX, playerY, PLAYER_LIGHT_RADIUS, this.softEdgePx);
    let torch = 0;
    for (const t of this.torchPositions) {
      torch = Math.max(torch, this.falloff(worldX, worldY, t.x, t.y, TORCH_RADIUS, this.softEdgePx - 2));
      if (torch >= 1) break;
    }
    return Math.max(player, torch);
  }

  private falloff(px: number, py: number, cx: number, cy: number, radius: number, softEdgePx: number): number {
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= radius) return 0;
    const inner = Math.max(0, radius - Math.max(1, softEdgePx));
    if (dist <= inner) return 1;
    const t = (radius - dist) / (radius - inner); // 0..1
    // Smoothstep.
    return t * t * (3 - 2 * t);
  }
}
