import Phaser from 'phaser';
import { ItemConfig, ItemType } from '../config/types';

export class Item extends Phaser.Physics.Arcade.Sprite {
  config: ItemConfig;
  qty: number;
  isManual: boolean;
  opened = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ItemConfig, qty = 1, isManual = false) {
    super(scene, x, y, config.sprite);
    this.config = config;
    this.qty = qty;
    this.isManual = isManual;
  }

  get isChest(): boolean {
    return this.config.type === ItemType.Chest || this.config.type === ItemType.GoldenChest;
  }

  openChest(): void {
    if (!this.isChest) return;
    this.opened = true;
    const openKey = this.config.type === ItemType.GoldenChest ? 'chest_golden_open_full' : 'chest_open_full';
    if (this.scene.textures.exists(openKey)) {
      this.setTexture(openKey);
    }
  }
}
