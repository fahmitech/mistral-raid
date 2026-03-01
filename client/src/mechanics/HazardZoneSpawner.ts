import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, ZOOM } from '../config/constants';
import type { MechanicConfig } from '../types/arena';
import type { MechanicInstance } from '../systems/MechanicInterpreter';
import type { Player } from '../entities/Player';

interface Context {
  scene: Phaser.Scene;
  player: Player;
  boss: Phaser.GameObjects.Sprite;
  onDamage: (amount: number, source: 'hazard') => void;
}

export class HazardZoneSpawner implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private onDamage: (amount: number, source: 'hazard') => void;
  private graphics: Phaser.GameObjects.Graphics;
  private center: Phaser.Math.Vector2;
  private radius: number;
  private warningTime: number;
  private duration: number;
  private damage: number;
  private startTime: number;
  private lastDamageAt = 0;
  private shape: string;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.onDamage = ctx.onDamage;
    this.graphics = this.scene.add.graphics();

    const location = String(config.location ?? 'center');
    this.center = this.resolveLocation(location, ctx.player);
    this.radius = Number(config.radius ?? 140) / ZOOM;
    this.warningTime = Number(config.warning_time ?? 1);
    this.duration = Number(config.duration_seconds ?? 6);
    this.damage = Phaser.Math.Clamp(Number(config.damage_per_tick ?? 2), 1, 4);
    this.startTime = this.scene.time.now;
    this.shape = String(config.shape ?? 'circle');
  }

  update(time: number): void {
    if (this.isExpired) return;
    const elapsed = (time - this.startTime) / 1000;
    if (elapsed > this.duration + this.warningTime) {
      this.destroy();
      return;
    }

    const inWarning = elapsed < this.warningTime;
    this.drawZone(inWarning, time);

    if (!inWarning) {
      const dist = Phaser.Math.Distance.Between(this.center.x, this.center.y, this.player.x, this.player.y);
      if (dist <= this.radius) {
        if (time - this.lastDamageAt > 500) {
          this.lastDamageAt = time;
          this.onDamage(this.damage, 'hazard');
        }
      }
    }
  }

  destroy(): void {
    if (this.isExpired) return;
    this.isExpired = true;
    this.graphics.destroy();
  }

  private drawZone(warning: boolean, time: number): void {
    this.graphics.clear();
    const alpha = warning ? 0.2 + Math.sin(time / 120) * 0.05 : 0.35;
    const color = warning ? 0xff5f9c : 0xff2675;
    this.graphics.fillStyle(color, alpha);
    if (this.shape === 'rectangle') {
      const width = this.radius * 2;
      const height = this.radius * 1.2;
      this.graphics.fillRect(this.center.x - width / 2, this.center.y - height / 2, width, height);
    } else {
      this.graphics.fillCircle(this.center.x, this.center.y, this.radius);
    }
  }

  private resolveLocation(location: string, player: Player): Phaser.Math.Vector2 {
    const map: Record<string, Phaser.Math.Vector2> = {
      top_left: new Phaser.Math.Vector2(40, 45),
      top_right: new Phaser.Math.Vector2(280, 45),
      bot_left: new Phaser.Math.Vector2(40, 135),
      bot_right: new Phaser.Math.Vector2(280, 135),
      center: new Phaser.Math.Vector2(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2),
      player_position: new Phaser.Math.Vector2(player.x, player.y),
    };
    return map[location] ?? map.center;
  }
}
