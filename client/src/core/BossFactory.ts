import Phaser from 'phaser';
import { BossEntity } from '../entities/BossEntity';
import { BOSS_CONFIGS } from '../config/bosses';
import { BossType } from '../config/types';

export class BossFactory {
  static spawnBoss(
    scene: Phaser.Scene,
    type: BossType,
    x: number,
    y: number,
    group: Phaser.Physics.Arcade.Group
  ): BossEntity {
    const config = BOSS_CONFIGS[type];
    const boss = new BossEntity(scene, x, y, config);
    scene.add.existing(boss);
    group.add(boss);
    boss.setCollideWorldBounds(true);
    return boss;
  }
}
