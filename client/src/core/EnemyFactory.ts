import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { ENEMY_CONFIGS } from '../config/enemies';
import { LevelData, RoomType } from '../config/types';
import { TILE_SIZE } from '../config/constants';
import { MazeData } from './MazeGenerator';

export class EnemyFactory {
  static spawnEnemies(
    scene: Phaser.Scene,
    maze: MazeData,
    level: LevelData,
    group: Phaser.Physics.Arcade.Group
  ): Enemy[] {
    const rooms = maze.rooms.filter((room) => room.type === RoomType.Normal || room.type === RoomType.Secret);
    if (rooms.length === 0) return [];

    const enemies: Enemy[] = [];
    for (let i = 0; i < level.enemyCount; i += 1) {
      const room = rooms[i % rooms.length];
      const type = Phaser.Utils.Array.GetRandom(level.enemyTypes);
      const base = ENEMY_CONFIGS[type];
      const config = {
        ...base,
        hp: Math.round(base.hp * level.enemyHPMult),
        speed: base.speed * level.enemySpdMult,
      };
      const rx = Phaser.Math.Between(room.x + 1, room.x + room.w - 2);
      const ry = Phaser.Math.Between(room.y + 1, room.y + room.h - 2);
      const worldX = rx * TILE_SIZE + TILE_SIZE / 2;
      const worldY = ry * TILE_SIZE + TILE_SIZE / 2;
      const enemy = new Enemy(scene, worldX, worldY, config);
      scene.add.existing(enemy);
      scene.physics.add.existing(enemy);
      enemy.setCollideWorldBounds(true);
      group.add(enemy);
      enemies.push(enemy);
    }
    return enemies;
  }
}
