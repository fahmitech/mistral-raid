import Phaser from 'phaser';
import { ZOOM } from '../config/constants';
import type { MechanicConfig } from '../types/arena';
import type { MechanicInstance } from '../systems/MechanicInterpreter';
import type { Player } from '../entities/Player';

interface Context {
  scene: Phaser.Scene;
  player: Player;
  boss: Phaser.GameObjects.Sprite;
  onDamage: (amount: number, source: 'projectile') => void;
}

interface Orb {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  createdAt: number;
  radius: number;
}

export class HomingOrb implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private boss: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number, source: 'projectile') => void;
  private orbs: Orb[] = [];
  private speed: number;
  private damage: number;
  private lifetime: number;
  private size: number;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.boss = ctx.boss;
    this.onDamage = ctx.onDamage;

    const count = Number(config.count ?? 2);
    this.speed = Number(config.speed ?? 4) * 15;
    this.damage = Phaser.Math.Clamp(Number(config.damage_on_hit ?? 3), 1, 4);
    this.lifetime = Number(config.lifetime_seconds ?? 8) * 1000;
    this.size = Number(config.size ?? 18) / ZOOM;

    for (let i = 0; i < Math.max(1, count); i += 1) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const x = this.boss.x + Math.cos(angle) * 14;
      const y = this.boss.y + Math.sin(angle) * 14;
      const orb = this.scene.add.circle(x, y, this.size, 0x9d5bff, 0.9);
      this.orbs.push({ obj: orb, vx: 0, vy: 0, createdAt: this.scene.time.now, radius: this.size });
    }
  }

  update(_time: number, delta: number): void {
    if (this.isExpired) return;
    const dt = delta / 1000;
    const lerpFactor = Phaser.Math.Clamp(this.speed / (6 * 15), 0.1, 0.5);

    this.orbs.forEach((orb) => {
      const dir = new Phaser.Math.Vector2(this.player.x - orb.obj.x, this.player.y - orb.obj.y);
      if (dir.lengthSq() > 0.01) {
        dir.normalize();
        const targetVx = dir.x * this.speed;
        const targetVy = dir.y * this.speed;
        orb.vx = Phaser.Math.Linear(orb.vx, targetVx, lerpFactor);
        orb.vy = Phaser.Math.Linear(orb.vy, targetVy, lerpFactor);
      }
      orb.obj.x += orb.vx * dt;
      orb.obj.y += orb.vy * dt;

      const dist = Phaser.Math.Distance.Between(orb.obj.x, orb.obj.y, this.player.x, this.player.y);
      if (dist <= orb.radius + 4) {
        this.onDamage(this.damage, 'projectile');
        orb.obj.destroy();
      }
    });

    this.orbs = this.orbs.filter((orb) => orb.obj.active && this.scene.time.now - orb.createdAt < this.lifetime);
    if (!this.orbs.length) this.isExpired = true;
  }

  destroy(): void {
    this.isExpired = true;
    this.orbs.forEach((orb) => orb.obj.destroy());
    this.orbs = [];
  }
}
