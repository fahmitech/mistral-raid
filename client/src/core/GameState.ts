import { CHARACTER_CONFIGS } from '../config/characters';
import { ITEM_CONFIGS } from '../config/items';
import {
  CharacterType,
  GameStateData,
  InventorySlot,
  ItemConfig,
  ItemEffect,
  ItemType,
} from '../config/types';

export class GameState {
  private static instance = new GameState();
  private data: GameStateData;
  private speedBoostTimer: number | null = null;
  private damageBoostTimer: number | null = null;
  private shieldTimer: number | null = null;
  private multishotTimer: number | null = null;

  private constructor() {
    this.data = this.defaultState();
  }

  static get(): GameState {
    return GameState.instance;
  }

  static addScore(n: number): void {
    GameState.instance.addScore(n);
  }

  static takeDamage(n: number): void {
    GameState.instance.takeDamage(n);
  }

  static isDead(): boolean {
    return GameState.instance.isDead();
  }

  get snapshot(): GameStateData {
    return { ...this.data, inventory: this.data.inventory.map((slot) => ({ ...slot })) };
  }

  reset(): void {
    this.clearTimers();
    this.data = this.defaultState();
  }

  nextLevel(): void {
    this.data.level = Math.min(5, this.data.level + 1);
  }

  setLevel(level: number): void {
    this.data.level = Math.max(1, Math.min(5, Math.floor(level)));
  }

  setCharacter(type: CharacterType): void {
    const stats = CHARACTER_CONFIGS[type];
    this.data.character = type;
    this.data.playerMaxHP = stats.maxHP;
    this.data.playerHP = stats.maxHP;
    this.data.playerSpeed = stats.speed;
    this.data.playerDamage = stats.damage;
    this.data.playerFireRate = stats.fireRate;
    this.data.equippedWeapon = ItemType.WeaponSword;
  }

  loadSave(save: { character: CharacterType; state: GameStateData }): void {
    this.clearTimers();
    this.data = {
      ...save.state,
      inventory: save.state.inventory.map((slot) => ({ ...slot })),
    };
    this.data.character = save.character;
  }

  setHP(hp: number): void {
    this.data.playerHP = Math.max(0, Math.min(this.data.playerMaxHP, Math.floor(hp)));
  }

  heal(amount: number): void {
    this.setHP(this.data.playerHP + amount);
  }

  takeDamage(amount: number): void {
    if (this.data.hasShield) {
      this.data.hasShield = false;
      return;
    }
    this.setHP(this.data.playerHP - amount);
  }

  isDead(): boolean {
    return this.data.playerHP <= 0;
  }

  addCoins(n: number): void {
    this.data.coins += n;
    this.addScore(n * 5);
  }

  addScore(n: number): void {
    this.data.score += n;
  }

  addItem(config: ItemConfig, qty = 1): void {
    const existing = this.data.inventory.find((slot) => slot.config.type === config.type);
    if (existing) {
      existing.qty += qty;
    } else {
      this.data.inventory.push({ config, qty });
    }
  }

  removeItem(config: ItemConfig, qty = 1): void {
    const idx = this.data.inventory.findIndex((slot) => slot.config.type === config.type);
    if (idx === -1) return;
    const slot = this.data.inventory[idx];
    slot.qty -= qty;
    if (slot.qty <= 0) {
      this.data.inventory.splice(idx, 1);
    }
  }

  applySpeedBoost(mult: number, ms: number): void {
    if (this.speedBoostTimer) window.clearTimeout(this.speedBoostTimer);
    const base = CHARACTER_CONFIGS[this.data.character].speed;
    this.data.playerSpeed = base * mult;
    this.speedBoostTimer = window.setTimeout(() => {
      this.data.playerSpeed = base;
      this.speedBoostTimer = null;
    }, ms);
  }

  applyDamageBoost(mult: number, ms: number): void {
    if (this.damageBoostTimer) window.clearTimeout(this.damageBoostTimer);
    const base = CHARACTER_CONFIGS[this.data.character].damage;
    this.data.playerDamage = base * mult;
    this.damageBoostTimer = window.setTimeout(() => {
      this.data.playerDamage = base;
      this.damageBoostTimer = null;
    }, ms);
  }

  applyShield(ms: number): void {
    if (this.shieldTimer) window.clearTimeout(this.shieldTimer);
    this.data.hasShield = true;
    this.shieldTimer = window.setTimeout(() => {
      this.data.hasShield = false;
      this.shieldTimer = null;
    }, ms);
  }

  applyMultiShot(ms: number): void {
    if (this.multishotTimer) window.clearTimeout(this.multishotTimer);
    this.data.isMultiShot = true;
    this.multishotTimer = window.setTimeout(() => {
      this.data.isMultiShot = false;
      this.multishotTimer = null;
    }, ms);
  }

  equipWeapon(type: ItemType): void {
    this.data.equippedWeapon = type;
  }

  get inventory(): InventorySlot[] {
    return this.data.inventory;
  }

  getData(): GameStateData {
    return this.snapshot;
  }

  private defaultState(): GameStateData {
    return {
      level: 1,
      score: 0,
      coins: 0,
      playerHP: 6,
      playerMaxHP: 6,
      playerDamage: 1,
      playerSpeed: 110,
      playerFireRate: 280,
      character: CharacterType.Knight,
      equippedWeapon: ItemType.WeaponSword,
      inventory: [],
      hasShield: false,
      isMultiShot: false,
    };
  }

  private clearTimers(): void {
    if (this.speedBoostTimer) window.clearTimeout(this.speedBoostTimer);
    if (this.damageBoostTimer) window.clearTimeout(this.damageBoostTimer);
    if (this.shieldTimer) window.clearTimeout(this.shieldTimer);
    if (this.multishotTimer) window.clearTimeout(this.multishotTimer);
    this.speedBoostTimer = null;
    this.damageBoostTimer = null;
    this.shieldTimer = null;
    this.multishotTimer = null;
  }
}

export const getWeaponDamageMultiplier = (weapon: ItemType): number => {
  const config = ITEM_CONFIGS[weapon];
  return config?.effect === ItemEffect.BoostDamage ? config.value : 1;
};
