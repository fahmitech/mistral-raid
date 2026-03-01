import Phaser from 'phaser';
import { ITEM_CONFIGS } from '../config/items';
import { ItemConfig, ItemType } from '../config/types';

const DROP_TABLE: { type: ItemType; weight: number }[] = [
  { type: ItemType.Coin, weight: 40 },
  { type: ItemType.FlaskRed, weight: 18 },
  { type: ItemType.FlaskBlue, weight: 12 },
  { type: ItemType.FlaskGreen, weight: 8 },
  { type: ItemType.FlaskYellow, weight: 8 },
  { type: ItemType.PoisonVial, weight: 6 },
  { type: ItemType.WeaponSword, weight: 5 },
  { type: ItemType.WeaponDagger, weight: 4 },
  { type: ItemType.WeaponHammer, weight: 3 },
  { type: ItemType.WeaponKatana, weight: 1 },
  { type: ItemType.FlaskBigRed, weight: 1 },
];

const CHEST_POOL: ItemType[] = [
  ItemType.FlaskBigRed,
  ItemType.FlaskBigBlue,
  ItemType.WeaponKatana,
  ItemType.FlaskGreen,
  ItemType.WeaponHammer,
  ItemType.WeaponSword,
  ItemType.PoisonVial,
];

const totalWeight = DROP_TABLE.reduce((sum, entry) => sum + entry.weight, 0);

export const LootSystem = {
  rollDrop(): ItemConfig {
    const roll = Math.random() * totalWeight;
    let acc = 0;
    for (const entry of DROP_TABLE) {
      acc += entry.weight;
      if (roll <= acc) {
        return ITEM_CONFIGS[entry.type];
      }
    }
    return ITEM_CONFIGS[ItemType.Coin];
  },
  rollChestLoot(isGolden: boolean): ItemConfig[] {
    const count = Phaser.Math.Between(2, 3);
    const drops: ItemConfig[] = [];
    for (let i = 0; i < count; i += 1) {
      const type = Phaser.Utils.Array.GetRandom(CHEST_POOL);
      drops.push(ITEM_CONFIGS[type]);
    }
    if (isGolden) {
      drops.push(ITEM_CONFIGS[ItemType.FlaskBigRed]);
    }
    return drops;
  },
};
