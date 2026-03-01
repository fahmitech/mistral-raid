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

interface WallSegment {
  rect: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
}

export class WallOfDeath implements MechanicInstance {
  isExpired = false;
  private scene: Phaser.Scene;
  private player: Player;
  private onDamage: (amount: number, source: 'hazard') => void;
  private segments: WallSegment[] = [];
  private damage: number;
  private speed: number;
  private direction: string;
  private gapPosition: number;
  private gapWidth: number;
  private startTime: number;
  private duration: number;
  private lastDamageAt = 0;

  constructor(ctx: Context, config: MechanicConfig) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.onDamage = ctx.onDamage;

    this.direction = String(config.direction ?? 'top');
    this.speed = Number(config.speed ?? 2) * 60 / ZOOM;
    this.gapPosition = Number(config.gap_position ?? 0.5);
    this.gapWidth = Number(config.gap_width ?? 90) / ZOOM;
    this.damage = Number(config.damage_on_hit ?? 30);
    this.duration = Number(config.duration_seconds ?? 6) * 1000;
    this.startTime = this.scene.time.now;

    this.spawnWalls();
  }

  update(time: number, delta: number): void {
    if (this.isExpired) return;
    if (time - this.startTime > this.duration) {
      this.destroy();
      return;
    }

    const dt = delta / 1000;
    this.segments.forEach((seg) => {
      seg.rect.x += seg.vx * dt;
      seg.rect.y += seg.vy * dt;
    });

    if (time - this.lastDamageAt > 200) {
      const playerRect = this.player.getBounds();
      const hit = this.segments.some((seg) => Phaser.Geom.Rectangle.Overlaps(playerRect, seg.rect.getBounds()));
      if (hit) {
        this.lastDamageAt = time;
        this.onDamage(this.damage, 'hazard');
      }
    }
  }

  destroy(): void {
    if (this.isExpired) return;
    this.isExpired = true;
    this.segments.forEach((seg) => seg.rect.destroy());
    this.segments = [];
  }

  private spawnWalls(): void {
    const thickness = 60 / ZOOM;
    const hasGap = this.gapPosition >= 0;

    if (this.direction === 'left' || this.direction === 'right') {
      const gapCenter = this.gapPosition * INTERNAL_HEIGHT;
      const gapHalf = this.gapWidth / 2;
      const topHeight = Math.max(0, gapCenter - gapHalf);
      const bottomHeight = Math.max(0, INTERNAL_HEIGHT - (gapCenter + gapHalf));
      const x = this.direction === 'left' ? -thickness / 2 : INTERNAL_WIDTH + thickness / 2;
      const vx = this.direction === 'left' ? this.speed : -this.speed;

      if (!hasGap) {
        this.segments.push(this.makeSegment(x, INTERNAL_HEIGHT / 2, thickness, INTERNAL_HEIGHT, vx, 0));
      } else {
        if (topHeight > 0) {
          this.segments.push(this.makeSegment(x, topHeight / 2, thickness, topHeight, vx, 0));
        }
        if (bottomHeight > 0) {
          const y = gapCenter + gapHalf + bottomHeight / 2;
          this.segments.push(this.makeSegment(x, y, thickness, bottomHeight, vx, 0));
        }
      }
      return;
    }

    if (this.direction === 'closing') {
      const x = -thickness / 2;
      const rightX = INTERNAL_WIDTH + thickness / 2;
      this.segments.push(this.makeSegment(x, INTERNAL_HEIGHT / 2, thickness, INTERNAL_HEIGHT, this.speed, 0));
      this.segments.push(this.makeSegment(rightX, INTERNAL_HEIGHT / 2, thickness, INTERNAL_HEIGHT, -this.speed, 0));
      return;
    }

    const gapCenter = this.gapPosition * INTERNAL_WIDTH;
    const gapHalf = this.gapWidth / 2;
    const leftWidth = Math.max(0, gapCenter - gapHalf);
    const rightWidth = Math.max(0, INTERNAL_WIDTH - (gapCenter + gapHalf));
    const y = this.direction === 'top' ? -thickness / 2 : INTERNAL_HEIGHT + thickness / 2;
    const vy = this.direction === 'top' ? this.speed : -this.speed;

    if (!hasGap) {
      this.segments.push(this.makeSegment(INTERNAL_WIDTH / 2, y, INTERNAL_WIDTH, thickness, 0, vy));
    } else {
      if (leftWidth > 0) {
        this.segments.push(this.makeSegment(leftWidth / 2, y, leftWidth, thickness, 0, vy));
      }
      if (rightWidth > 0) {
        const x = gapCenter + gapHalf + rightWidth / 2;
        this.segments.push(this.makeSegment(x, y, rightWidth, thickness, 0, vy));
      }
    }
  }

  private makeSegment(x: number, y: number, w: number, h: number, vx: number, vy: number): WallSegment {
    const rect = this.scene.add.rectangle(x, y, w, h, 0xff2266, 0.85);
    rect.setStrokeStyle(1, 0xff7aa8, 0.9);
    return { rect, vx, vy };
  }
}
