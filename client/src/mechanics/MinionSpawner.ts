import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, ZOOM } from '../config/constants';
import type { MechanicConfig } from '../types/arena';
import type { MechanicInstance } from '../systems/MechanicInterpreter';
import type { Player } from '../entities/Player';

interface Context {
  scene: Phaser.Scene;
  player: Player;
  boss: Phaser.GameObjects.Sprite;
  onDamage: (amount: number, source: 'melee') => void;
  onMinionKilled: () => void;
}

interface Minion {
  sprite: Phaser.Physics.Arcade.Image;
  behavior: string;
  speed: number;
  createdAt: number;
  hp: number;
}

export class MinionSpawner implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private boss: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number, source: 'melee') => void;
  private onMinionKilled: () => void;
  private minions: Minion[] = [];
  private lifetime: number;
  private baseDamage: number;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.boss = ctx.boss;
    this.onDamage = ctx.onDamage;
    this.onMinionKilled = ctx.onMinionKilled;

    this.ensureTexture();

    const count = Number(config.count ?? 2);
    const speed = Number(config.minion_speed ?? 2) * 120 / ZOOM;
    const hp = Number(config.minion_hp ?? 18);
    const behavior = String(config.behavior ?? 'chase');
    const spawnLocation = String(config.spawn_location ?? 'edges');
    this.baseDamage = Phaser.Math.Clamp(Number(config.minion_damage ?? 2), 1, 4);
    this.lifetime = Number(config.duration_seconds ?? 10) * 1000;

    for (let i = 0; i < Math.max(1, count); i += 1) {
      const pos = this.resolveSpawn(spawnLocation);
      const sprite = this.scene.physics.add.image(pos.x, pos.y, 'minion-triangle');
      sprite.setScale(0.7);
      sprite.setDepth(8);
      this.minions.push({ sprite, behavior, speed, createdAt: this.scene.time.now, hp });
    }
  }

  update(time: number, delta: number): void {
    if (this.isExpired) return;
    const dt = delta / 1000;

    this.minions.forEach((minion, idx) => {
      if (!minion.sprite.active) return;
      if (time - minion.createdAt > this.lifetime) {
        minion.sprite.destroy();
        return;
      }

      if (minion.behavior === 'orbit') {
        const angle = (time / 1000) * (minion.speed / 150);
        minion.sprite.x = this.boss.x + Math.cos(angle + idx) * 40;
        minion.sprite.y = this.boss.y + Math.sin(angle + idx) * 40;
      } else {
        const dir = new Phaser.Math.Vector2(this.player.x - minion.sprite.x, this.player.y - minion.sprite.y);
        if (dir.lengthSq() > 0.01) dir.normalize();
        minion.sprite.x += dir.x * minion.speed * dt;
        minion.sprite.y += dir.y * minion.speed * dt;
      }

      const dist = Phaser.Math.Distance.Between(minion.sprite.x, minion.sprite.y, this.player.x, this.player.y);
      if (dist < 12) {
        const damage = minion.behavior === 'kamikaze'
          ? Math.min(4, this.baseDamage * 2)
          : this.baseDamage;
        this.onDamage(damage, 'melee');
        if (minion.behavior === 'kamikaze') {
          minion.sprite.destroy();
        }
      }
    });

    this.minions = this.minions.filter((minion) => minion.sprite.active);
    if (!this.minions.length) this.isExpired = true;
  }

  destroy(): void {
    if (this.isExpired) return;
    this.isExpired = true;
    this.minions.forEach((minion) => minion.sprite.destroy());
    this.minions = [];
  }

  private resolveSpawn(location: string): Phaser.Math.Vector2 {
    switch (location) {
      case 'corners': {
        const corners = [
          new Phaser.Math.Vector2(30, 30),
          new Phaser.Math.Vector2(INTERNAL_WIDTH - 30, 30),
          new Phaser.Math.Vector2(30, INTERNAL_HEIGHT - 30),
          new Phaser.Math.Vector2(INTERNAL_WIDTH - 30, INTERNAL_HEIGHT - 30),
        ];
        return corners[Math.floor(Math.random() * corners.length)];
      }
      case 'near_player': {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const radius = Phaser.Math.FloatBetween(15, 50);
        const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * radius, 10, INTERNAL_WIDTH - 10);
        const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * radius, 10, INTERNAL_HEIGHT - 10);
        return new Phaser.Math.Vector2(x, y);
      }
      case 'edges':
      default: {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) return new Phaser.Math.Vector2(40, Phaser.Math.Between(20, INTERNAL_HEIGHT - 20));
        if (edge === 1) return new Phaser.Math.Vector2(INTERNAL_WIDTH - 40, Phaser.Math.Between(20, INTERNAL_HEIGHT - 20));
        if (edge === 2) return new Phaser.Math.Vector2(Phaser.Math.Between(20, INTERNAL_WIDTH - 20), 40);
        return new Phaser.Math.Vector2(Phaser.Math.Between(20, INTERNAL_WIDTH - 20), INTERNAL_HEIGHT - 40);
      }
    }
  }

  private ensureTexture(): void {
    if (this.scene.textures.exists('minion-triangle')) return;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0x00ff66, 1);
    gfx.lineStyle(1, 0xafffd1, 1);
    gfx.beginPath();
    gfx.moveTo(8, 0);
    gfx.lineTo(16, 16);
    gfx.lineTo(0, 16);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();
    gfx.generateTexture('minion-triangle', 16, 16);
    gfx.destroy();
  }
}
