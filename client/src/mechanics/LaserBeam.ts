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

export class LaserBeam implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private boss: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number, source: 'hazard') => void;
  private graphics: Phaser.GameObjects.Graphics;
  private direction: string;
  private speed: number;
  private width: number;
  private damage: number;
  private duration: number;
  private telegraphTime: number;
  private startTime: number;
  private lastDamageAt = 0;
  private position = 0;
  private axisDir = 1;
  private angle = 0;
  private diagonalAngle = Math.PI / 4;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.boss = ctx.boss;
    this.onDamage = ctx.onDamage;
    this.graphics = this.scene.add.graphics();

    this.direction = String(config.direction ?? 'horizontal');
    this.speed = Number(config.speed ?? 2);
    this.width = Number(config.width ?? 28) / ZOOM;
    this.damage = Number(config.damage_on_hit ?? 20);
    this.duration = Number(config.duration_seconds ?? 5);
    this.telegraphTime = Number(config.telegraph_time ?? 1);
    this.startTime = this.scene.time.now;
    this.axisDir = Math.random() < 0.5 ? -1 : 1;
    this.position = this.direction === 'vertical' ? this.boss.y : this.boss.x;
    this.angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
    if (this.direction === 'diagonal') {
      this.diagonalAngle = Math.random() < 0.5 ? Math.PI / 4 : -Math.PI / 4;
    }
  }

  update(time: number, delta: number): void {
    if (this.isExpired) return;
    const elapsed = (time - this.startTime) / 1000;
    if (elapsed > this.telegraphTime + this.duration) {
      this.destroy();
      return;
    }

    const inTelegraph = elapsed < this.telegraphTime;
    this.graphics.clear();

    if (this.direction === 'horizontal') {
      const speedPx = (this.speed * 180) / ZOOM;
      this.position += this.axisDir * speedPx * (delta / 1000);
      if (this.position < 0 || this.position > INTERNAL_WIDTH) this.axisDir *= -1;
      const line = new Phaser.Geom.Line(this.position, 0, this.position, INTERNAL_HEIGHT);
      this.drawLine(line, inTelegraph);
      this.handleDamage(line, inTelegraph, time);
      return;
    }

    if (this.direction === 'vertical') {
      const speedPx = (this.speed * 140) / ZOOM;
      this.position += this.axisDir * speedPx * (delta / 1000);
      if (this.position < 0 || this.position > INTERNAL_HEIGHT) this.axisDir *= -1;
      const line = new Phaser.Geom.Line(0, this.position, INTERNAL_WIDTH, this.position);
      this.drawLine(line, inTelegraph);
      this.handleDamage(line, inTelegraph, time);
      return;
    }

    if (this.direction === 'tracking') {
      const target = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      const turnRate = this.speed * 0.8;
      this.angle = Phaser.Math.Angle.RotateTo(this.angle, target, turnRate * (delta / 1000));
      const line = this.angleToLine(this.angle);
      this.drawLine(line, inTelegraph);
      this.handleDamage(line, inTelegraph, time);
      return;
    }

    // diagonal
    const line = this.angleToLine(this.diagonalAngle);
    this.drawLine(line, inTelegraph);
    this.handleDamage(line, inTelegraph, time);
  }

  destroy(): void {
    if (this.isExpired) return;
    this.isExpired = true;
    this.graphics.destroy();
  }

  private drawLine(line: Phaser.Geom.Line, warning: boolean): void {
    if (warning) {
      this.graphics.lineStyle(2, 0xffffff, 0.6);
    } else {
      this.graphics.lineStyle(this.width, 0xff2266, 0.8);
    }
    this.graphics.strokeLineShape(line);
  }

  private handleDamage(line: Phaser.Geom.Line, warning: boolean, time: number): void {
    if (warning) return;
    if (time - this.lastDamageAt < 500) return;
    const distRaw = Phaser.Geom.Line.GetShortestDistance(line, new Phaser.Math.Vector2(this.player.x, this.player.y));
    const dist = typeof distRaw === 'number' ? distRaw : 0;
    if (dist <= this.width / 2) {
      this.lastDamageAt = time;
      this.onDamage(this.damage, 'hazard');
    }
  }

  private angleToLine(angle: number): Phaser.Geom.Line {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const length = 1000;
    return new Phaser.Geom.Line(
      this.boss.x - dx * length,
      this.boss.y - dy * length,
      this.boss.x + dx * length,
      this.boss.y + dy * length
    );
  }
}
