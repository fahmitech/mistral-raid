import Phaser from 'phaser';
import {
  EXTRA_CORRIDOR_PERCENT,
  ITEM_SPAWN_CHANCE,
  ROOM_ATTEMPT_MULT,
  ROOM_HEIGHT_MAX,
  ROOM_HEIGHT_MIN,
  ROOM_PADDING,
  ROOM_WIDTH_MAX,
  ROOM_WIDTH_MIN,
  SECRET_ROOM_CHANCE,
  STAIRS_OFFSET_X,
  TREASURE_ROOM_CHANCE,
  TILE_SIZE,
} from '../config/constants';
import { LevelData, RoomType, TileType } from '../config/types';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  type: RoomType;
  cx: number;
  cy: number;
}

export interface MazeData {
  width: number;
  height: number;
  tiles: TileType[][];
  rooms: Room[];
  startRoom: Room;
  bossRoom: Room;
  playerSpawn: { x: number; y: number };
  bossSpawn: { x: number; y: number };
  stairs: { x: number; y: number };
  chestSpawns: { x: number; y: number }[];
  itemSpawns: { x: number; y: number }[];
  torchSpawns: { x: number; y: number }[];
}

export class MazeGenerator {
  generate(level: LevelData): MazeData {
    const width = level.mapW;
    const height = level.mapH;
    const tiles: TileType[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => TileType.Wall)
    );

    const rooms: Room[] = [];
    const maxAttempts = level.roomCount * ROOM_ATTEMPT_MULT;
    let attempts = 0;

    while (rooms.length < level.roomCount && attempts < maxAttempts) {
      attempts += 1;
      const w = Phaser.Math.Between(ROOM_WIDTH_MIN, ROOM_WIDTH_MAX);
      const h = Phaser.Math.Between(ROOM_HEIGHT_MIN, ROOM_HEIGHT_MAX);
      const x = Phaser.Math.Between(2, width - w - 2);
      const y = Phaser.Math.Between(2, height - h - 2);

      const candidate = { x, y, w, h };
      if (this.overlaps(candidate, rooms)) continue;
      rooms.push({
        ...candidate,
        type: RoomType.Normal,
        cx: Math.floor(x + w / 2),
        cy: Math.floor(y + h / 2),
      });
    }

    if (rooms.length === 0) {
      throw new Error('MazeGenerator: No rooms generated');
    }

    this.assignRoomTypes(rooms, width, height);
    const startRoom = rooms.find((room) => room.type === RoomType.Start) ?? rooms[0];
    const bossRoom = rooms.find((room) => room.type === RoomType.Boss) ?? rooms[rooms.length - 1];

    for (const room of rooms) {
      this.carveRoom(tiles, room);
    }

    this.connectRooms(tiles, rooms);

    const extraConnections = Math.floor(rooms.length * EXTRA_CORRIDOR_PERCENT);
    for (let i = 0; i < extraConnections; i += 1) {
      const a = Phaser.Utils.Array.GetRandom(rooms);
      const b = Phaser.Utils.Array.GetRandom(rooms);
      if (a !== b) {
        this.carveCorridor(tiles, a.cx, a.cy, b.cx, b.cy);
      }
    }

    const playerSpawn = { x: startRoom.cx, y: startRoom.cy };
    const bossSpawn = { x: bossRoom.cx, y: bossRoom.cy };
    const stairs = { x: bossRoom.cx + STAIRS_OFFSET_X, y: bossRoom.cy };

    tiles[playerSpawn.y][playerSpawn.x] = TileType.PlayerSpawn;
    tiles[bossSpawn.y][bossSpawn.x] = TileType.BossSpawn;
    if (this.isInBounds(stairs.x, stairs.y, width, height)) {
      tiles[stairs.y][stairs.x] = TileType.StairsDown;
    }

    const chestSpawns: { x: number; y: number }[] = [];
    const itemSpawns: { x: number; y: number }[] = [];
    const torchSpawns: { x: number; y: number }[] = [];

    for (const room of rooms) {
      if (room.type === RoomType.Treasure) {
        tiles[room.cy][room.cx] = TileType.ChestSpawn;
        chestSpawns.push({ x: room.cx, y: room.cy });
      }

      if (room.type === RoomType.Normal || room.type === RoomType.Secret) {
        if (Math.random() < ITEM_SPAWN_CHANCE) {
          const pos = this.randomPointInRoom(room, 8);
          tiles[pos.y][pos.x] = TileType.ItemSpawn;
          itemSpawns.push(pos);
        }
      }

      const torchCount = room.w > 7 ? 2 : 1;
      for (let t = 0; t < torchCount; t += 1) {
        const tx = Phaser.Math.Between(room.x + 1, room.x + room.w - 2);
        const ty = room.y - 1;
        if (this.isInBounds(tx, ty, width, height) && tiles[ty][tx] === TileType.Wall) {
          torchSpawns.push({ x: tx, y: ty });
        }
      }
    }

    return {
      width,
      height,
      tiles,
      rooms,
      startRoom,
      bossRoom,
      playerSpawn,
      bossSpawn,
      stairs,
      chestSpawns,
      itemSpawns,
      torchSpawns,
    };
  }

  private overlaps(candidate: { x: number; y: number; w: number; h: number }, rooms: Room[]): boolean {
    for (const room of rooms) {
      const ax1 = candidate.x - ROOM_PADDING;
      const ay1 = candidate.y - ROOM_PADDING;
      const ax2 = candidate.x + candidate.w + ROOM_PADDING;
      const ay2 = candidate.y + candidate.h + ROOM_PADDING;
      const bx1 = room.x;
      const by1 = room.y;
      const bx2 = room.x + room.w;
      const by2 = room.y + room.h;
      if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
        return true;
      }
    }
    return false;
  }

  private assignRoomTypes(rooms: Room[], mapW: number, mapH: number): void {
    const center = { x: mapW / 2, y: mapH / 2 };
    let closest = rooms[0];
    let farthest = rooms[0];
    let closestDist = Number.POSITIVE_INFINITY;
    let farthestDist = 0;

    for (const room of rooms) {
      const dx = room.cx - center.x;
      const dy = room.cy - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = room;
      }
      if (dist > farthestDist) {
        farthestDist = dist;
        farthest = room;
      }
    }

    closest.type = RoomType.Start;
    farthest.type = RoomType.Boss;

    for (const room of rooms) {
      if (room === closest || room === farthest) continue;
      const roll = Math.random();
      if (roll < TREASURE_ROOM_CHANCE) {
        room.type = RoomType.Treasure;
      } else if (roll < TREASURE_ROOM_CHANCE + SECRET_ROOM_CHANCE) {
        room.type = RoomType.Secret;
      } else {
        room.type = RoomType.Normal;
      }
    }
  }

  private carveRoom(tiles: TileType[][], room: Room): void {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        tiles[y][x] = room.type === RoomType.Secret ? TileType.SecretFloor : TileType.Floor;
      }
    }
  }

  private connectRooms(tiles: TileType[][], rooms: Room[]): void {
    const connected: Room[] = [rooms[0]];
    const unconnected = rooms.slice(1);

    while (unconnected.length > 0) {
      let bestA = connected[0];
      let bestB = unconnected[0];
      let bestDist = Number.POSITIVE_INFINITY;

      for (const a of connected) {
        for (const b of unconnected) {
          const dist = Phaser.Math.Distance.Between(a.cx, a.cy, b.cx, b.cy);
          if (dist < bestDist) {
            bestDist = dist;
            bestA = a;
            bestB = b;
          }
        }
      }

      this.carveCorridor(tiles, bestA.cx, bestA.cy, bestB.cx, bestB.cy);
      connected.push(bestB);
      const idx = unconnected.indexOf(bestB);
      if (idx >= 0) unconnected.splice(idx, 1);
    }
  }

  private carveCorridor(tiles: TileType[][], x1: number, y1: number, x2: number, y2: number): void {
    const horizDir = x2 >= x1 ? 1 : -1;
    const vertDir = y2 >= y1 ? 1 : -1;

    for (let x = x1; x !== x2; x += horizDir) {
      tiles[y1][x] = TileType.Floor;
    }
    for (let y = y1; y !== y2; y += vertDir) {
      tiles[y][x2] = TileType.Floor;
    }
    tiles[y2][x2] = TileType.Floor;
  }

  private randomPointInRoom(room: Room, marginPx: number): { x: number; y: number } {
    const marginTiles = Math.ceil(marginPx / TILE_SIZE);
    const minX = room.x + marginTiles;
    const maxX = room.x + room.w - marginTiles - 1;
    const minY = room.y + marginTiles;
    const maxY = room.y + room.h - marginTiles - 1;
    return {
      x: Phaser.Math.Between(Math.max(room.x, minX), Math.max(room.x, maxX)),
      y: Phaser.Math.Between(Math.max(room.y, minY), Math.max(room.y, maxY)),
    };
  }

  private isInBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
  }
}
