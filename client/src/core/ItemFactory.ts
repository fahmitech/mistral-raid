import Phaser from 'phaser';
import { Item } from '../entities/Item';
import { ItemConfig } from '../config/types';

export class ItemFactory {
  static spawnItem(
    scene: Phaser.Scene,
    config: ItemConfig,
    x: number,
    y: number,
    group: Phaser.Physics.Arcade.Group,
    isManual = false
  ): Item {
    const item = new Item(scene, x, y, config, 1, isManual);
    scene.add.existing(item);
    scene.physics.add.existing(item);
    item.setDepth(5);
    group.add(item);
    return item;
  }
}
