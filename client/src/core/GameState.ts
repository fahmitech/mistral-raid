import { CHARACTER_CONFIGS } from '../config/characters';
import { ITEM_CONFIGS } from '../config/items';
import { WEAPON_CONFIGS } from '../config/weapons';
import { DASH_MAX_CHARGES } from '../config/constants';
import {
  CharacterType,
  GameStateData,
  InventorySlot,
  ItemConfig,
  ItemEffect,
  ItemType,
  SaveData,
  WeaponConfig,
} from '../config/types';
import { SAVE_KEY } from '../systems/SaveSystem';

export class GameState {
  private static readonly LEGACY_LORE_STORAGE_KEY = 'mistralraid_lore_discovered';
  private static instance = new GameState();
  private data: GameStateData;
  private speedBoostTimer: number | null = null;
  private damageBoostTimer: number | null = null;
  private shieldTimer: number | null = null;
  private multishotTimer: number | null = null;
  private livesCount = 3;
  private discoveredLore = new Set<string>();

  private constructor() {
    this.data = this.defaultState();
    this.loadDiscoveredLore();
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

  static markLoreDiscovered(id: string): void {
    GameState.instance.markLoreDiscovered(id);
  }

  static isLoreDiscovered(id: string): boolean {
    return GameState.instance.isLoreDiscovered(id);
  }

  static getDiscoveredLoreIds(): string[] {
    return GameState.instance.getDiscoveredLoreIds();
  }

  get snapshot(): GameStateData {
    return { ...this.data, inventory: this.data.inventory.map((slot) => ({ ...slot })) };
  }

  reset(): void {
    this.clearTimers();
    this.data = this.defaultState();
    this.livesCount = 3;
  }

  setLives(n: number): void {
    this.livesCount = Math.max(0, n);
  }

  getLives(): number {
    return this.livesCount;
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
    this.data.dashCharges = DASH_MAX_CHARGES;
  }

  loadSave(save: SaveData): void {
    this.clearTimers();
    this.data = {
      ...save.state,
      inventory: save.state.inventory.map((slot) => ({ ...slot })),
    };
    this.data.character = save.character;
    if (typeof this.data.dashCharges !== 'number') {
      this.data.dashCharges = DASH_MAX_CHARGES;
    }
    this.data.dashCharges = Math.max(0, Math.min(DASH_MAX_CHARGES, this.data.dashCharges));
    if (Array.isArray(save.discoveredLore)) {
      this.discoveredLore = new Set(save.discoveredLore.filter((id): id is string => typeof id === 'string'));
    }

    // RM-5: Restore story state
    this.data.loreDiscovered = Array.isArray(save.state.loreDiscovered) ? [...save.state.loreDiscovered] : [];
    this.data.bossHistory = Array.isArray(save.state.bossHistory) ? [...save.state.bossHistory] : [];
    this.data.sanctumReached = Boolean(save.state.sanctumReached);
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

  markLoreDiscovered(id: string): void {
    if (!id || this.discoveredLore.has(id)) return;
    this.discoveredLore.add(id);
    this.saveDiscoveredLore();
  }

  isLoreDiscovered(id: string): boolean {
    return this.discoveredLore.has(id);
  }

  getDiscoveredLoreIds(): string[] {
    return Array.from(this.discoveredLore);
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

  getDashCharges(): number {
    if (typeof this.data.dashCharges !== 'number') {
      this.data.dashCharges = DASH_MAX_CHARGES;
    }
    return this.data.dashCharges;
  }

  canDash(): boolean {
    return this.getDashCharges() > 0;
  }

  spendDashCharge(): boolean {
    if (!this.canDash()) {
      return false;
    }
    this.data.dashCharges -= 1;
    return true;
  }

  restoreDashCharges(amount: number): number {
    const next = Math.max(0, Math.min(DASH_MAX_CHARGES, this.getDashCharges() + Math.max(0, amount)));
    this.data.dashCharges = next;
    return next;
  }

  getEquippedWeaponType(): ItemType {
    return this.data.equippedWeapon;
  }

  getWeaponConfig(type: ItemType): WeaponConfig {
    return WEAPON_CONFIGS[type] ?? WEAPON_CONFIGS[ItemType.WeaponSword]!;
  }

  getEffectiveWeaponDamage(baseDamage: number, weapon = this.data.equippedWeapon): number {
    const config = WEAPON_CONFIGS[weapon];
    return baseDamage * (config?.damageMult ?? 1);
  }

  getEffectiveFireRate(baseRate: number, weapon = this.data.equippedWeapon): number {
    const config = WEAPON_CONFIGS[weapon];
    if (!config) return baseRate;
    const mult = config.fireRateMult || 1;
    return Math.max(60, baseRate / mult);
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
      dashCharges: DASH_MAX_CHARGES,
      activeBuffs: [],
      loreDiscovered: [],
      bossHistory: [],
      sanctumReached: false,
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

  // NEW: Buff system methods
  getActiveBuffs(): string[] {
    return [...this.data.activeBuffs];
  }

  resetBuffs(): void {
    this.data.activeBuffs = [];
  }

  loadDiscoveredLore(): void {
    const merged = [...this.readLoreFromSave(), ...this.readLoreFromLegacyStore()];
    this.discoveredLore = new Set(merged);
  }

  saveDiscoveredLore(): void {
    const loreIds = Array.from(this.discoveredLore);
    if (this.persistLoreToSave(loreIds)) {
      try {
        localStorage.removeItem(GameState.LEGACY_LORE_STORAGE_KEY);
      } catch {
        // Ignore cleanup failure
      }
      return;
    }
    this.persistLoreToLegacy(loreIds);
  }

  private readLoreFromSave(): string[] {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!Array.isArray(parsed.discoveredLore)) return [];
      return parsed.discoveredLore.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  }

  private readLoreFromLegacyStore(): string[] {
    try {
      const raw = localStorage.getItem(GameState.LEGACY_LORE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  }

  private persistLoreToSave(loreIds: string[]): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      parsed.discoveredLore = loreIds;
      localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
      return true;
    } catch {
      return false;
    }
  }

  private persistLoreToLegacy(loreIds: string[]): void {
    try {
      localStorage.setItem(GameState.LEGACY_LORE_STORAGE_KEY, JSON.stringify(loreIds));
    } catch {
      // Ignore storage errors (quota, privacy mode, etc.)
    }
  }

  // RM-5 Story Methods
  recordLore(id: string): void {
    if (!this.data.loreDiscovered.includes(id)) {
      this.data.loreDiscovered.push(id);
    }
  }

  recordBossDefeat(id: string): void {
    if (!this.data.bossHistory.includes(id)) {
      this.data.bossHistory.push(id);
    }
  }

  setSanctumReached(reached = true): void {
    this.data.sanctumReached = reached;
  }
}

export const getWeaponConfig = (type: ItemType): WeaponConfig => WEAPON_CONFIGS[type] ?? WEAPON_CONFIGS[ItemType.WeaponSword]!;
