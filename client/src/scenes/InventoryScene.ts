import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { ITEM_CONFIGS } from '../config/items';
import { ItemConfig, ItemRarity, ItemType } from '../config/types';

const RARITY_COLORS: Record<ItemRarity, number> = {
  [ItemRarity.Common]: 0xaaaaaa,
  [ItemRarity.Uncommon]: 0x33cc55,
  [ItemRarity.Rare]: 0x3399ff,
  [ItemRarity.Legendary]: 0xffaa00,
};

export class InventoryScene extends Phaser.Scene {
  private rows: Phaser.GameObjects.GameObject[] = [];
  private descText?: Phaser.GameObjects.Text;
  private equippedText?: Phaser.GameObjects.Text;

  constructor() {
    super('InventoryScene');
  }

  create(): void {
    this.scene.pause('LevelScene');

    this.add.rectangle(160, 90, 320, 180, 0x000000, 0.6).setScrollFactor(0);
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0f1e, 0.94);
    panel.fillRoundedRect(26, 18, 268, 144, 8);
    panel.lineStyle(1, 0x224466, 0.9);
    panel.strokeRoundedRect(26, 18, 268, 144, 8);

    this.add
      .text(160, 28, 'INVENTORY', {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.descText = this.add
      .text(160, 140, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#cccccc',
      })
      .setOrigin(0.5, 0.5);

    this.equippedText = this.add
      .text(160, 150, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#ffdd44',
      })
      .setOrigin(0.5, 0.5);

    this.renderInventory();

    this.input.keyboard?.on('keydown-I', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.resume('LevelScene');
    this.scene.stop();
  }

  private renderInventory(): void {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const state = GameState.get();
    const inventory = state.inventory.slice();
    const weaponSlots = inventory.filter((slot) => slot.config.type.startsWith('w_'));
    if (!weaponSlots.find((slot) => slot.config.type === ItemType.WeaponSword)) {
      weaponSlots.unshift({ config: ITEM_CONFIGS[ItemType.WeaponSword], qty: 1 });
    }
    const itemSlots = inventory.filter((slot) => !slot.config.type.startsWith('w_'));

    const weaponsTitle = this.add
      .text(64, 48, 'WEAPONS', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#88bbff',
      })
      .setOrigin(0, 0.5);
    const itemsTitle = this.add
      .text(180, 48, 'ITEMS', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#88bbff',
      })
      .setOrigin(0, 0.5);
    this.rows.push(weaponsTitle, itemsTitle);

    weaponSlots.forEach((slot, idx) => {
      const y = 62 + idx * 14;
      this.rows.push(...this.renderRow(48, y, slot.config, slot.qty, true));
    });

    itemSlots.forEach((slot, idx) => {
      const y = 62 + idx * 14;
      this.rows.push(...this.renderRow(164, y, slot.config, slot.qty, false));
    });

    const equipped = state.getData().equippedWeapon;
    const equippedConfig = ITEM_CONFIGS[equipped];
    if (this.equippedText) {
      this.equippedText.setText(`Equipped: ${equippedConfig.name}`);
    }
  }

  private renderRow(x: number, y: number, config: ItemConfig, qty: number, isWeapon: boolean): Phaser.GameObjects.GameObject[] {
    const stripe = this.add.rectangle(x - 10, y, 3, 10, RARITY_COLORS[config.rarity]).setOrigin(0, 0.5);
    const icon = this.add.image(x, y, config.sprite).setOrigin(0, 0.5).setScale(0.7);
    const nameText = this.add
      .text(x + 12, y, config.name, {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    const qtyText = qty > 1
      ? this.add
          .text(x + 90, y, `x${qty}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '4px',
            color: '#cccccc',
          })
          .setOrigin(0, 0.5)
      : null;

    const hitArea = this.add.rectangle(x + 40, y, 90, 12, 0x000000, 0).setOrigin(0, 0.5);
    hitArea.setInteractive({ useHandCursor: isWeapon });
    hitArea.on('pointerover', () => this.showDescription(config));
    hitArea.on('pointerout', () => this.clearDescription());
    if (isWeapon) {
      hitArea.on('pointerdown', () => this.equipWeapon(config.type));
    }

    return [stripe, icon, nameText, hitArea, ...(qtyText ? [qtyText] : [])];
  }

  private showDescription(config: ItemConfig): void {
    if (!this.descText) return;
    this.descText.setText(`${config.name} (${config.rarity.toUpperCase()})`);
  }

  private clearDescription(): void {
    if (!this.descText) return;
    this.descText.setText('');
  }

  private equipWeapon(type: ItemType): void {
    if (!type.startsWith('w_')) return;
    GameState.get().equipWeapon(type);
    this.renderInventory();
  }
}
