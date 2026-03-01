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

interface ProjectileEntry {
  obj: Phaser.GameObjects.Arc;
  homing: boolean;
  createdAt: number;
  radius: number;
}

export class ProjectileSpawner implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private boss: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number, source: 'projectile') => void;
  private projectiles: ProjectileEntry[] = [];
  private fireTimer: Phaser.Time.TimerEvent;
  private endTime: number;
  private pattern: string;
  private speed: number;
  private count: number;
  private fireRate: number;
  private size: number;
  private homing: boolean;
  private damage: number;
  private spiralAngle = 0;
  private projectileLifetime = 1500;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.boss = ctx.boss;
    this.onDamage = ctx.onDamage;

    this.pattern = String(config.pattern ?? 'fan');
    this.speed = Number(config.speed ?? 6) * 15;
    this.count = Number(config.projectile_count ?? 6);
    this.fireRate = Number(config.fire_rate ?? 1.5);
    this.size = Number(config.projectile_size ?? 8) / ZOOM;
    this.homing = Boolean(config.homing ?? false);
    this.damage = Phaser.Math.Clamp(Number((config as Record<string, unknown>).damage_on_hit ?? 2), 1, 4);

    const duration = Number(config.duration_seconds ?? 6);
    this.endTime = this.scene.time.now + duration * 1000;
    this.projectileLifetime = Math.max(1500, duration * 1000);

    this.fireTimer = this.scene.time.addEvent({
      delay: Math.max(100, 1000 / Math.max(0.1, this.fireRate)),
      loop: true,
      callback: () => this.fireVolley(),
    });
  }

  update(time: number, delta: number): void {
    if (this.isExpired) return;
    if (time >= this.endTime) {
      this.destroy();
      return;
    }

    this.projectiles.forEach((proj) => {
      const body = proj.obj.body as Phaser.Physics.Arcade.Body | null;
      if (!body) return;
      if (proj.homing) {
        const dir = new Phaser.Math.Vector2(this.player.x - proj.obj.x, this.player.y - proj.obj.y);
        if (dir.lengthSq() > 0.01) {
          dir.normalize();
          body.setVelocity(dir.x * this.speed, dir.y * this.speed);
        }
      }
      const dist = Phaser.Math.Distance.Between(proj.obj.x, proj.obj.y, this.player.x, this.player.y);
      if (dist <= proj.radius + 4) {
        this.onDamage(this.damage, 'projectile');
        proj.obj.destroy();
      }
    });

    this.projectiles = this.projectiles.filter((proj) => {
      if (!proj.obj.active) return false;
      if (time - proj.createdAt > this.projectileLifetime) {
        proj.obj.destroy();
        return false;
      }
      return true;
    });
  }

  destroy(): void {
    if (this.isExpired) return;
    this.isExpired = true;
    this.fireTimer.remove(false);
    this.projectiles.forEach((proj) => proj.obj.destroy());
    this.projectiles = [];
  }

  private fireVolley(): void {
    const originX = this.boss.x;
    const originY = this.boss.y;
    const baseAngle = Phaser.Math.Angle.Between(originX, originY, this.player.x, this.player.y);
    const count = Math.max(1, Math.round(this.count));

    switch (this.pattern) {
      case 'spiral': {
        for (let i = 0; i < count; i += 1) {
          const angle = this.spiralAngle + (i * Math.PI * 2) / count;
          this.spawnProjectile(originX, originY, angle);
        }
        this.spiralAngle += 0.35;
        break;
      }
      case 'random': {
        for (let i = 0; i < count; i += 1) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          this.spawnProjectile(originX, originY, angle);
        }
        break;
      }
      case 'aimed': {
        const spread = Phaser.Math.DegToRad(25);
        if (count === 1) {
          this.spawnProjectile(originX, originY, baseAngle);
        } else {
          for (let i = 0; i < count; i += 1) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            const angle = baseAngle - spread / 2 + t * spread;
            this.spawnProjectile(originX, originY, angle);
          }
        }
        break;
      }
      case 'ring': {
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2;
          this.spawnProjectile(originX, originY, angle);
        }
        break;
      }
      case 'fan':
      default: {
        const spread = Phaser.Math.DegToRad(90);
        for (let i = 0; i < count; i += 1) {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const angle = baseAngle - spread / 2 + t * spread;
          this.spawnProjectile(originX, originY, angle);
        }
        break;
      }
    }
  }

  private spawnProjectile(x: number, y: number, angle: number): void {
    const radius = Math.max(2, this.size);
    const proj = this.scene.add.circle(x, y, radius, 0xffcc00, 1);
    this.scene.physics.add.existing(proj);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(radius);
    body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);

    this.projectiles.push({ obj: proj, homing: this.homing, createdAt: this.scene.time.now, radius });
  }
}
