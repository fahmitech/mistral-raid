import Phaser from 'phaser';
import { Room, MazeData } from '../core/MazeGenerator';
import { INTERNAL_WIDTH } from '../config/constants';
import { RoomType, TileType } from '../config/types';

const ROOM_COLORS: Record<RoomType, number> = {
  [RoomType.Normal]: 0x334455,
  [RoomType.Start]: 0x2255aa,
  [RoomType.Boss]: 0xaa2222,
  [RoomType.Treasure]: 0xaaaa22,
  [RoomType.Secret]: 0x225522,
};

export class MiniMap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private rooms: Room[];
  private tiles: TileType[][];
  private scale = 0.1;
  private offsetX: number;
  private offsetY: number;
  private corridorDots: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene, maze: MazeData) {
    this.scene = scene;
    this.rooms = maze.rooms;
    this.tiles = maze.tiles;
    const mapWidth = Math.ceil(maze.width * this.scale);
    this.offsetX = INTERNAL_WIDTH - mapWidth - 6;
    this.offsetY = 6;
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(19);
    this.buildCorridors(maze);
  }

  update(playerTileX: number, playerTileY: number, stairsActive: boolean, stairsPos: { x: number; y: number }): void {
    this.graphics.clear();

    for (const room of this.rooms) {
      const color = ROOM_COLORS[room.type];
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRect(
        this.offsetX + room.x * this.scale,
        this.offsetY + room.y * this.scale,
        room.w * this.scale,
        room.h * this.scale
      );
    }

    this.graphics.fillStyle(0x445566, 1);
    for (const dot of this.corridorDots) {
      this.graphics.fillRect(this.offsetX + dot.x, this.offsetY + dot.y, 1, 1);
    }

    if (stairsActive) {
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillRect(
        this.offsetX + stairsPos.x * this.scale,
        this.offsetY + stairsPos.y * this.scale,
        2,
        2
      );
    }

    this.graphics.fillStyle(0xffff00, 1);
    this.graphics.fillRect(
      this.offsetX + playerTileX * this.scale - 1,
      this.offsetY + playerTileY * this.scale - 1,
      3,
      3
    );
  }

  private buildCorridors(maze: MazeData): void {
    const roomMap = new Set<string>();
    for (const room of maze.rooms) {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          roomMap.add(`${x},${y}`);
        }
      }
    }
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const tile = this.tiles[y][x];
        if (
          (tile === TileType.Floor || tile === TileType.SecretFloor || tile === TileType.PlayerSpawn || tile === TileType.BossSpawn) &&
          !roomMap.has(`${x},${y}`)
        ) {
          this.corridorDots.push({ x: x * this.scale, y: y * this.scale });
        }
      }
    }
  }

  destroy(): void {
    this.graphics?.destroy();
    // @ts-expect-error - best-effort cleanup.
    this.scene = undefined;
  }
}
