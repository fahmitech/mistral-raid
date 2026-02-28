# Type Contracts

> All shared data interfaces. These define the contract between client and server.
> Presented as TypeScript interfaces for reference — any language can implement these.

---

## Enums

### GamePhase

```typescript
enum GamePhase {
  BOOT = "BOOT",
  PHASE_1 = "PHASE_1",
  TRANSITION = "TRANSITION",
  PHASE_2 = "PHASE_2",
  PHASE_3 = "PHASE_3",
  VICTORY = "VICTORY",
  GAME_OVER = "GAME_OVER"
}
```

> **Note:** These are STRING values, not numeric.

### MechanicType

```typescript
enum MechanicType {
  PROJECTILE_SPAWNER = "projectile_spawner",
  HAZARD_ZONE = "hazard_zone",
  LASER_BEAM = "laser_beam",
  HOMING_ORB = "homing_orb",
  WALL_OF_DEATH = "wall_of_death",
  MINION_SPAWN = "minion_spawn"
}
```

---

## Telemetry

### TelemetryPayload

Collected during Phase 1, sent to server on phase transition.

```typescript
interface TelemetryPayload {
  player_id: string;                    // Always "player-1" (single player)
  phase_duration_seconds: number;       // How long Phase 1 lasted
  player_hp_at_transition: number;      // Player HP when transition triggered (0-100)
  phase_forced_by_timeout: boolean;     // True if 120s timeout forced transition

  movement_heatmap: {                   // 9-zone position frequency counts
    top_left: number;
    top_center: number;
    top_right: number;
    mid_left: number;
    mid_center: number;
    mid_right: number;
    bot_left: number;
    bot_center: number;
    bot_right: number;
  };

  dodge_bias: {                         // Directional dodge frequency counts
    left: number;
    right: number;
    up: number;
    down: number;
  };

  damage_taken_from: {                  // Cumulative damage by source type
    melee: number;
    projectile: number;
    hazard: number;
  };

  shots_fired: number;                  // Total player shots fired
  shots_hit: number;                    // Total player shots that hit boss
  orbs_destroyed: number;               // Homing orbs shot down by player
  average_distance_from_boss: number;   // Mean distance in pixels
  movement_distance: number;            // Total pixels traveled
  average_speed: number;                // movement_distance / phase_duration_seconds
  accuracy: number;                     // shots_hit / shots_fired (0-1, clamped)
  dash_frequency: number;              // Dashes per minute
  corner_time_pct: number;             // % of time in corner zones (0-100)
  reaction_time_avg_ms: number;        // Average reaction to telegraphed attacks
}
```

---

## Boss Response (AI Output)

### BossResponse

```typescript
interface BossResponse {
  analysis: string;          // 1-2 sentences referencing specific telemetry (for DevConsole)
  taunt: string;             // <30 words, spoken by ElevenLabs TTS
  mechanics: MechanicConfig[];  // Array of 2-3 mechanic configurations
}
```

### MechanicConfig (Union Type)

```typescript
type MechanicConfig =
  | ProjectileSpawnerConfig
  | HazardZoneConfig
  | LaserBeamConfig
  | HomingOrbConfig
  | WallOfDeathConfig
  | MinionSpawnConfig;
```

### ProjectileSpawnerConfig

```typescript
interface ProjectileSpawnerConfig {
  type: "projectile_spawner";
  pattern: "spiral" | "fan" | "random" | "aimed" | "ring";
  speed: number;              // 3-12
  projectile_count: number;   // 1-12
  fire_rate: number;          // 0.5-4 (volleys per second)
  projectile_size: number;    // 4-16 (pixels)
  homing: boolean;
  duration_seconds: number;   // 3-15
}
```

### HazardZoneConfig

```typescript
interface HazardZoneConfig {
  type: "hazard_zone";
  location: "top_left" | "top_right" | "bot_left" | "bot_right" | "center" | "player_position";
  shape: "circle" | "rectangle";
  radius: number;             // 50-300
  damage_per_tick: number;    // 5-20
  duration_seconds: number;   // 3-15
  warning_time: number;       // 0.5-2 (seconds)
}
```

### LaserBeamConfig

```typescript
interface LaserBeamConfig {
  type: "laser_beam";
  direction: "horizontal" | "vertical" | "diagonal" | "tracking";
  speed: number;              // 1-5
  width: number;              // 10-60
  damage_on_hit: number;      // 15-40
  duration_seconds: number;   // 3-10
  telegraph_time: number;     // 0.5-2 (seconds)
}
```

### HomingOrbConfig

```typescript
interface HomingOrbConfig {
  type: "homing_orb";
  count: number;              // 1-4
  speed: number;              // 2-6
  damage_on_hit: number;      // 20-40
  lifetime_seconds: number;   // 5-15
  size: number;               // 12-30 (pixels)
}
```

### WallOfDeathConfig

```typescript
interface WallOfDeathConfig {
  type: "wall_of_death";
  direction: "top" | "bottom" | "left" | "right" | "closing";
  speed: number;              // 1-4
  gap_position: number;       // 0-1 (fractional) or -1 (no gap)
  gap_width: number;          // 50-150
  damage_on_hit: number;      // 25-50
}
```

### MinionSpawnConfig

```typescript
interface MinionSpawnConfig {
  type: "minion_spawn";
  count: number;              // 1-5
  minion_speed: number;       // 1-4
  minion_hp: number;          // 10-30
  behavior: "chase" | "orbit" | "kamikaze";
  spawn_location: "edges" | "corners" | "near_player";
}
```

---

## WebSocket Messages

### ClientMessage

```typescript
type ClientMessage = {
  type: "ANALYZE";
  payload: TelemetryPayload;
};
```

### ServerMessage

```typescript
type ServerMessage =
  | { type: "BOSS_RESPONSE"; payload: BossResponse }
  | { type: "AUDIO_READY"; payload: { audioBase64: string; format: string } }
  | { type: "ERROR"; payload: { message: string; fallback: BossResponse } };
```

---

## E2E Test Bridge (Dev Only)

Exposed on `window.__MISTRAL_RAID__` in development builds:

```typescript
interface MistralRaidBridge {
  getPlayerHP(): number;
  getBossHP(): number;
  getPhase(): number;             // GamePhase enum value
  getLastMsg(): ServerMessage | null;
  triggerPhaseTransition(): void;
  isAudioUnlocked(): boolean;
  getDevConsoleLines(): string[];
  setBossHP(hp: number): void;    // Test helper
  setPlayerHP(hp: number): void;  // Test helper
}
```

**Guard:** Only available when `import.meta.env.DEV === true`

---

## Game-Level Types

These types are used within the game client for dungeon generation, enemies, items, characters, and state management.

### Constants

```typescript
const TILE = 16; // pixels per tile
```

### TileType

```typescript
enum TileType {
  Void        = 0,   // Empty space outside map
  Wall        = 1,   // Solid collision tile
  Floor       = 2,   // Walkable area
  PlayerSpawn = 3,   // Player start position
  BossSpawn   = 4,   // Boss spawn position
  ChestSpawn  = 5,   // Chest placement
  ItemSpawn   = 6,   // Random item placement
  StairsDown  = 7,   // Level exit (revealed on boss death)
  SecretFloor = 8,   // Secret room floor
}
```

### RoomType

```typescript
enum RoomType {
  Normal   = 'normal',
  Start    = 'start',
  Boss     = 'boss',
  Treasure = 'treasure',
  Secret   = 'secret',
}
```

### Room

```typescript
interface Room {
  x: number;     // tile column of top-left
  y: number;     // tile row of top-left
  w: number;     // width in tiles
  h: number;     // height in tiles
  cx: number;    // center column
  cy: number;    // center row
  type: RoomType;
  index: number;
}
```

### MazeData

```typescript
interface Point { x: number; y: number; }

interface MazeData {
  tiles:           TileType[][];   // 2D grid of tile types
  rooms:           Room[];         // All generated rooms
  playerSpawn:     Point;          // Tile coords of player start
  bossRoom:        Room;           // Reference to boss room
  stairsPos:       Point;          // Tile coords of level exit
  torchPositions:  Point[];        // Tile coords of torch placements
  mapWidth:        number;         // Map width in tiles
  mapHeight:       number;         // Map height in tiles
}
```

### EnemyType

```typescript
enum EnemyType {
  Goblin      = 'goblin',
  Imp         = 'imp',
  Chort       = 'chort',
  BigZombie   = 'big_zombie',
  IceZombie   = 'ice_zombie',
  MaskedOrc   = 'masked_orc',
  BigDemon    = 'big_demon',
  Skelet      = 'skelet',
  Necromancer = 'necromancer',
  OrcArmored  = 'orc_armored',
}
```

### EnemyBehavior

```typescript
enum EnemyBehavior {
  MeleeChase   = 'melee',
  RangedShoot  = 'ranged',
  Summoner     = 'summoner',
  Teleporter   = 'teleporter',
  Shielded     = 'shielded',
  Exploder     = 'exploder',
  SplitOnDeath = 'split',
}
```

### EnemyConfig

```typescript
interface EnemyConfig {
  type:            EnemyType;
  spriteKey:       string;
  hp:              number;
  speed:           number;
  damage:          number;
  xp:              number;
  behavior:        EnemyBehavior;
  scale:           number;
  hasRunAnim:      boolean;
  projectileColor: number;    // hex color for enemy projectiles
}
```

### BossType

```typescript
enum BossType {
  BigDemon        = 'level1',
  DarkKnight      = 'level2',
  Necromancer     = 'level3',
  ElementalFusion = 'level4',
  TheWatcher      = 'level5',
}
```

### BossConfig

```typescript
interface BossConfig {
  type:       BossType;
  name:       string;       // Display name (e.g., "THE DEMON LORD")
  spriteKey:  string;
  hp:         number;
  phases:     number;       // 2 or 3
  phase2Tint: number;       // Tint color applied in phase 2+
  scale:      number;       // Sprite scale multiplier
}
```

### ItemType

```typescript
enum ItemType {
  WeaponSword   = 'w_sword',
  WeaponDagger  = 'w_dagger',
  WeaponKatana  = 'w_katana',
  WeaponHammer  = 'w_hammer',
  WeaponBomb    = 'w_bomb',
  FlaskRed      = 'f_red',
  FlaskBlue     = 'f_blue',
  FlaskGreen    = 'f_green',
  FlaskYellow   = 'f_yellow',
  FlaskBigRed   = 'f_big_red',
  FlaskBigBlue  = 'f_big_blue',
  Coin          = 'coin',
  Chest         = 'chest',
  GoldenChest   = 'golden_chest',
}
```

### ItemEffect & ItemRarity

```typescript
enum ItemEffect {
  HealHP      = 'heal',
  BoostSpeed  = 'speed',
  BoostDamage = 'damage',
  Shield      = 'shield',
  MultiShot   = 'multishot',
  AddCoins    = 'coins',
}

enum ItemRarity {
  Common    = 'common',
  Uncommon  = 'uncommon',
  Rare      = 'rare',
  Legendary = 'legendary',
}
```

### ItemConfig

```typescript
interface ItemConfig {
  type:      ItemType;
  name:      string;
  sprite:    string;
  effect:    ItemEffect;
  value:     number;
  rarity:    ItemRarity;
  duration?: number;     // ms, for timed boosts
}
```

### CharacterType & CharacterStats

```typescript
enum CharacterType {
  Knight  = 'knight',
  Rogue   = 'rogue',
  Mage    = 'mage',
  Paladin = 'paladin',
}

interface CharacterStats {
  maxHP:     number;
  speed:     number;
  damage:    number;
  fireRate:  number;     // ms between shots (lower = faster)
  spriteKey: string;     // e.g. 'knight_m', 'elf_f', 'lizard_f', 'dwarf_m'
  label:     string;
  desc:      string;
}

// Exact values:
const CHARACTER_CONFIGS: Record<CharacterType, CharacterStats> = {
  knight:  { maxHP: 6,  speed: 110, damage: 1.0, fireRate: 280, spriteKey: 'knight_m', label: 'Knight',  desc: 'Balanced warrior. Strong shield, steady aim.' },
  rogue:   { maxHP: 4,  speed: 145, damage: 0.8, fireRate: 200, spriteKey: 'elf_f',    label: 'Rogue',   desc: 'Lightning fast. Low HP but rapid fire.' },
  mage:    { maxHP: 3,  speed: 100, damage: 2.0, fireRate: 420, spriteKey: 'lizard_f', label: 'Mage',    desc: 'High damage spells. Fragile but deadly.' },
  paladin: { maxHP: 8,  speed:  88, damage: 1.5, fireRate: 360, spriteKey: 'dwarf_m',  label: 'Paladin', desc: 'Iron tank. Maximum HP, heavy hits.' },
};
```

### Options & Save Data

```typescript
interface OptionsData {
  soundOn:     boolean;
  musicOn:     boolean;
  screenShake: boolean;
  fullscreen:  boolean;
}

interface InventorySlot {
  config: ItemConfig;
  qty:    number;
}

interface GameStateData {
  level:          number;
  score:          number;
  coins:          number;
  playerHP:       number;
  playerMaxHP:    number;
  playerDamage:   number;
  playerSpeed:    number;
  playerFireRate: number;
  character:      CharacterType;
  equippedWeapon: ItemType;
  inventory:      InventorySlot[];
  hasShield:      boolean;
  isMultiShot:    boolean;
}

interface SaveData {
  character: CharacterType;
  state:     GameStateData;
  savedAt:   number;          // Date.now() timestamp
}
```

### LevelData

```typescript
interface LevelData {
  level:        number;
  name:         string;       // e.g. "THE DUNGEON ENTRANCE"
  subtitle:     string;       // e.g. "Something stirs in the darkness…"
  mapW:         number;       // tiles
  mapH:         number;       // tiles
  roomCount:    number;
  bgColor:      number;       // hex color
  ambientColor: number;       // darkness overlay tint
  enemyTypes:   EnemyType[];
  enemyCount:   number;
  bossType:     BossType;
  enemyHPMult:  number;
  enemySpdMult: number;
  fogDensity:   number;       // 0=no fog, 1=pitch black
}
```
