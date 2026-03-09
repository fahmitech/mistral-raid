export enum CharacterType {
  Knight = 'knight',
  Rogue = 'rogue',
  Mage = 'mage',
  Paladin = 'paladin',
}

export interface CharacterStats {
  maxHP: number;
  speed: number;
  damage: number;
  fireRate: number;
  spriteKey: string;
  label: string;
  desc: string;
}

export enum EnemyType {
  Goblin = 'goblin',
  Imp = 'imp',
  Chort = 'chort',
  BigZombie = 'big_zombie',
  IceZombie = 'ice_zombie',
  MaskedOrc = 'masked_orc',
  BigDemon = 'big_demon',
  Skelet = 'skelet',
  Necromancer = 'necromancer',
  OrcArmored = 'orc_armored',
}

export enum EnemyBehavior {
  MeleeChase = 'melee',
  RangedShoot = 'ranged',
  Summoner = 'summoner',
  Teleporter = 'teleporter',
  Shielded = 'shielded',
  Exploder = 'exploder',
  SplitOnDeath = 'split',
}

export interface EnemyConfig {
  type: EnemyType;
  spriteKey: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  behavior: EnemyBehavior;
  scale: number;
  hasRunAnim: boolean;
  projectileColor: number;
  /** SFX category name played when this enemy attacks. */
  attackSfx?: string;
}

export enum BossType {
  BigDemon = 'level1',
  DarkKnight = 'level2',
  Necromancer = 'level3',
  ElementalFusion = 'level4',
  TheWatcher = 'level5',
}

export interface BossConfig {
  type: BossType;
  name: string;
  spriteKey: string;
  hp: number;
  phases: number;
  phase2Tint: number;
  scale: number;
  hasRunAnim: boolean;
  speed: number;
  damage: number;
  projectileColor: number;
  attackCooldownMs: number;
}

export enum ItemType {
  WeaponSword = 'w_sword',
  WeaponDagger = 'w_dagger',
  WeaponKatana = 'w_katana',
  WeaponHammer = 'w_hammer',
  WeaponBomb = 'w_bomb',
  FlaskRed = 'f_red',
  FlaskBlue = 'f_blue',
  FlaskGreen = 'f_green',
  FlaskYellow = 'f_yellow',
  FlaskBigRed = 'f_big_red',
  FlaskBigBlue = 'f_big_blue',
  PoisonVial = 'f_poison',
  Coin = 'coin',
  Chest = 'chest',
  GoldenChest = 'golden_chest',
}

export enum ItemEffect {
  HealHP = 'heal',
  BoostSpeed = 'speed',
  BoostDamage = 'damage',
  Shield = 'shield',
  MultiShot = 'multishot',
  AddCoins = 'coins',
  RestoreDash = 'restore_dash',
}

export enum ItemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Legendary = 'legendary',
}

export interface ItemConfig {
  type: ItemType;
  name: string;
  sprite: string;
  effect: ItemEffect;
  value: number;
  rarity: ItemRarity;
  duration?: number;
}

export interface InventorySlot {
  config: ItemConfig;
  qty: number;
}

export interface WeaponExplosionConfig {
  radius: number;
  fuseMs: number;
  flashColor: number;
  shake: number;
}

export interface WeaponConfig {
  damageMult: number;
  fireRateMult: number;
  projectileCount: number;
  spreadDeg: number;
  projectileSpeed: number;
  knockback: number;
  projectileKey: string;
  projectileScale: number;
  projectileSpinDegPerSec?: number;
  projectileRotationOffset?: number;
  muzzleFlashColor: number;
  muzzleFlashSize: number;
  shakeIntensity: number;
  holdOffset: { x: number; y: number };
  rotationOffset: number;
  weaponScale: number;
  pierce?: number;
  critChance?: number;
  explosion?: WeaponExplosionConfig;
  holdAnimationKey?: string;
}

export interface GameStateData {
  level: number;
  score: number;
  coins: number;
  playerHP: number;
  playerMaxHP: number;
  playerDamage: number;
  playerSpeed: number;
  playerFireRate: number;
  character: CharacterType;
  equippedWeapon: ItemType;
  inventory: InventorySlot[];
  hasShield: boolean;
  isMultiShot: boolean;
  dashCharges: number;
  activeBuffs: string[]; // Buff ID array (BuffType strings)
}

export interface SaveData {
  character: CharacterType;
  state: GameStateData;
  savedAt: number;
  discoveredLore?: string[];
}

export interface OptionsData {
  soundOn: boolean;
  musicOn: boolean;
  screenShake: boolean;
  fullscreen: boolean;
}

export interface LevelData {
  level: number;
  name: string;
  subtitle: string;
  mapW: number;
  mapH: number;
  roomCount: number;
  bgColor: number;
  ambientColor: number;
  enemyTypes: EnemyType[];
  enemyCount: number;
  bossType: BossType;
  enemyHPMult: number;
  enemySpdMult: number;
  fogDensity: number;
}

export enum RoomType {
  Start = 'start',
  Boss = 'boss',
  Treasure = 'treasure',
  Secret = 'secret',
  Normal = 'normal',
}

export enum TileType {
  Void = 0,
  Wall = 1,
  Floor = 2,
  PlayerSpawn = 3,
  BossSpawn = 4,
  ChestSpawn = 5,
  ItemSpawn = 6,
  StairsDown = 7,
  SecretFloor = 8,
}
