# Dungeon Crawler — LevelScene Specification

> The core gameplay loop. Procedural dungeon generation, combat, items, boss encounters, and level progression across 5 levels.

---

## Overview

LevelScene is the main game scene — a top-down dungeon crawler where the player explores procedurally generated rooms connected by corridors. Each level has enemies, items, chests, a boss room, and stairs to the next level. The game has 5 levels of increasing size and difficulty.

---

## Procedural Dungeon Generation

### Algorithm: Room-and-Corridor with Nearest-Neighbor MST

1. **Fill entire map with Wall tiles**
2. **Place rooms** with random positions and sizes
   - Room width: 5–12 tiles, height: 4–9 tiles
   - Margin of 2 tiles between rooms (overlap check with padding)
   - Max placement attempts: `roomCount × 40`
3. **Assign room types** by distance to map center:
   - Closest to center → `Start` (player spawn)
   - Farthest from center → `Boss` (boss spawn)
   - Middle rooms: 12% chance → `Treasure`, 8% chance → `Secret`, rest → `Normal`
4. **Carve rooms** (set tiles to Floor)
5. **Connect rooms** using nearest-neighbor spanning tree (MST):
   - Start with room 0 in "connected" set
   - Repeatedly find closest unconnected room to any connected room
   - Carve L-shaped corridor (horizontal leg first, then vertical)
6. **Add extra corridors** for loop variety: ~25% of room count additional random connections
7. **Place special tiles:**
   - Player spawn: center of Start room
   - Boss spawn: center of Boss room
   - Stairs: 2 tiles right of Boss room center (hidden until boss dies)
   - Chests: center of Treasure rooms
   - Items: 40% chance in Normal/Secret rooms (random floor position)
8. **Place torches** on wall tiles above rooms (1–2 per room, wider rooms get 2)

### Map Sizes Per Level

| Level | Name | Map (tiles) | Rooms | Enemies |
|-------|------|-------------|-------|---------|
| 1 | THE DUNGEON ENTRANCE | 40×40 | 8 | 10 |
| 2 | THE DARK CORRIDORS | 60×60 | 14 | 20 |
| 3 | THE CRYPT | 80×80 | 20 | 32 |
| 4 | THE ELEMENTAL FORGE | 100×100 | 28 | 48 |
| 5 | THE ABYSS | 120×120 | 38 | 65 |

### Tile Types

| Enum | Value | Usage |
|------|-------|-------|
| Void | 0 | Empty space outside map |
| Wall | 1 | Solid collision tile |
| Floor | 2 | Walkable area |
| PlayerSpawn | 3 | Player start position |
| BossSpawn | 4 | Boss spawn position |
| ChestSpawn | 5 | Chest placement |
| ItemSpawn | 6 | Random item placement |
| StairsDown | 7 | Level exit (revealed on boss death) |
| SecretFloor | 8 | Secret room floor |

### Room Types

| Type | Assignment Rule |
|------|----------------|
| Start | Closest room to map center |
| Boss | Farthest room from map center |
| Treasure | 12% chance (middle rooms) |
| Secret | 8% chance (middle rooms) |
| Normal | All remaining rooms |

---

## World Building

### Floor Rendering
- Uses `RenderTexture` drawn once for performance
- 4 floor tile variants (`floor_1` through `floor_4`)
- Tile selected by `(x + y) % 4` — creates checkerboard pattern
- Tile size: 16×16 pixels

### Wall Rendering
- Individual images + invisible static physics bodies
- Wall tile selection based on neighbors: if tile above is not a wall → `wall_top`, otherwise `wall_mid`

### Decorations (No Collision)
- **Torches**: Dedicated torch sprites (`torch_1` through `torch_8`, 8 FPS) mounted on wall tiles
- **Room decor**: 60% chance per room — skull, crate, box, boxes_stacked, or column in a corner
- **Wall banners**: One per room — randomly red or blue, on top wall
- **Blood stains**: 50% chance in Normal rooms — floor_stain_1/2/3 at 70% alpha

### Depth Layers

| Layer | Depth | Contents |
|-------|-------|----------|
| FLOOR | 0 | Floor RenderTexture |
| WALL | 1 | Wall images |
| DECOR | 2 | Torches, banners, stains, skulls |
| ITEM | 5 | Collectible items |
| ENTITY | 10 | Player, enemies, boss, projectiles |
| UI | 20 | HUD elements |

---

## Player Controls

### Movement
- **WASD** or **Arrow Keys**: 4-directional movement
- Speed: from GameState (`playerSpeed`), default 110 px/s
- Collision with walls via Arcade physics
- Sprite flips horizontally based on last horizontal direction
- Animations: `char_idle` (standing) / `char_run` (moving), 4 frames each at 8 FPS

### Shooting (Left Mouse Button)
- **Hold LMB** for continuous fire
- Fire rate: from GameState (`playerFireRate`), default 280ms cooldown
- Projectile speed: 160 px/s
- Projectile lifetime: 3000ms (auto-destroy)
- Projectile texture: generated at runtime — yellow circle, 6×6px
- Direction: toward mouse cursor (world coordinates)
- Damage: from GameState (`playerDamage`), default 1.0
- **Multi-shot**: if active, fires 3 projectiles (angle, angle ± 0.2 radians)
- **Visual effects on shoot:** muzzle flash (white 3px circle, 45ms), player recoil (1px), micro screen shake (28ms, 0.002)

### Dash (Space Bar)
- **Teleport** 44px in held direction (or facing direction if no keys held)
- Clamped to world bounds
- Cooldown: 1500ms
- Grants 180ms invincibility + 50% alpha flash
- **Visual**: 8 cyan ghost circles along dash path, fading over 160–336ms
- Micro screen shake: 28ms, intensity 0.0025
- Cannot dash during active invincibility (> 60ms remaining)

### Shield (Right Mouse Button)
- Activates a glowing ring (blue, pulsing, radius 11px around player)
- Duration: 1.2 seconds (auto-deactivates if not hit)
- Blocks one hit completely (then enters cooldown)
- Cooldown: 1800ms
- **Shield shatter effect**: 10 blue particles radiate outward, 280ms fade
- Screen shake on shatter: 60ms, intensity 0.004

### Weapon Switch (Q Key)
- Cycles through owned weapons: Sword → Dagger → Katana → Hammer → Bomb
- Sword is always owned (default)
- Other weapons must be in inventory
- Visual: weapon sprite tints white for 80ms, micro shake

### Use Potion (R Key)
- Searches inventory for FlaskRed, FlaskBigRed, or FlaskGreen (in that order)
- FlaskBigRed heals 3 HP, others heal 1 HP
- Consumed from inventory
- **Visual**: 8 green particles radiate outward, 350ms fade
- Shows floating heal number

### Interact (E Key)
- For chests and weapons that require manual pickup
- "[E] Pick up" hint text appears when near interactive item

### Pause (ESC Key)
- Launches PauseScene as overlay (game pauses underneath)
- Only if no other overlay is active

### Inventory (I Key)
- Launches InventoryScene as overlay
- Only if no other overlay is active

---

## Invincibility Frames

- Duration: 700ms after taking damage
- Visual: player blinks (alpha alternates between 1 and 0.4 using sine wave)
- Prevents all damage during duration
- Also applied during dash (180ms, shorter)

---

## Damage System

When player is hit:
1. Check shield → if active, shatter shield, block damage, start cooldown
2. Check invincibility → if active, ignore
3. Apply damage via GameState.takeDamage()
4. Start invincibility timer (700ms)
5. **Visual effects:**
   - Camera shake: 200ms, intensity 0.010
   - Red camera flash: 80ms
   - 8 red particles radiate from player, 380–500ms fade
6. If HP ≤ 0: fade to black (600ms) → GameOverScene

---

## Enemy System

### 10 Enemy Types

| Type | Sprite | Base HP | Speed | Damage | XP | Behavior | Scale |
|------|--------|---------|-------|--------|-----|----------|-------|
| Goblin | goblin | 4 | 58 | 1 | 5 | MeleeChase | 1.0 |
| Imp | imp | 3 | 75 | 1 | 6 | RangedShoot | 1.0 |
| Chort | chort | 6 | 68 | 2 | 9 | MeleeChase | 1.0 |
| BigZombie | big_zombie | 14 | 38 | 3 | 16 | MeleeChase | 1.0 |
| IceZombie | ice_zombie | 8 | 30 | 2 | 13 | Exploder | 1.0 |
| MaskedOrc | masked_orc | 16 | 52 | 4 | 22 | Shielded | 1.0 |
| BigDemon | big_demon | 22 | 48 | 5 | 32 | RangedShoot | 1.2 |
| Skelet | skelet | 6 | 62 | 2 | 11 | SplitOnDeath | 1.0 |
| Necromancer | necromancer | 20 | 42 | 3 | 28 | Summoner | 1.0 |
| OrcArmored | orc_armored | 28 | 44 | 5 | 38 | Shielded | 1.1 |

### Level Scaling

Enemy stats scale per level:

| Level | HP Multiplier | Speed Multiplier |
|-------|---------------|-------------------|
| 1 | 1.0× | 1.0× |
| 2 | 1.3× | 1.1× |
| 3 | 1.6× | 1.2× |
| 4 | 2.0× | 1.4× |
| 5 | 2.5× | 1.6× |

### Enemy Types Per Level

| Level | Available Enemy Types |
|-------|----------------------|
| 1 | Goblin, Imp |
| 2 | Goblin, Imp, Chort, BigZombie |
| 3 | Chort, BigZombie, Skelet, IceZombie |
| 4 | Skelet, MaskedOrc, BigZombie, BigDemon |
| 5 | Necromancer, MaskedOrc, BigDemon, OrcArmored |

### 7 Enemy Behaviors

| Behavior | Description |
|----------|-------------|
| MeleeChase | Move directly toward player, damage on contact |
| RangedShoot | Fire projectiles at player from range |
| Summoner | Summon additional enemies |
| Teleporter | Teleport to random positions |
| Shielded | Block some damage, require multiple hits |
| Exploder | Explode on death dealing area damage |
| SplitOnDeath | Split into smaller enemies when killed |

### Behavior Constants (Enemy.ts)

- Aggro range: 110px
- Ranged shoot range: 85px
- Ranged shoot cooldown: 1600ms
- Teleport cooldown: 2800ms (teleport 50–90px around player, camera shake 60ms @ 0.003)
- Summon cooldown: 4500ms (spawns Goblin near summoner)
- Explode trigger range: 18px (deals `damage × 3`, shakes camera 80ms @ 0.008)
- Patrol: picks random 18px/s drift direction every 1.8–3.0s

### Ranged Projectiles

- Speed: 85 px/s
- Lifetime: 2800ms
- Damage: `cfg.damage`

### Shielded Enemies

- Start with blue tint (`0x4488ff`)
- Shield breaks when HP < 50% of max

### Enemy Spawning
- Enemies spawn in Normal and Secret rooms only (not Start, Boss, or Treasure)
- Distributed round-robin across available rooms
- Random type selection from level's enemy pool
- Random offset within room bounds (±room_half_size tiles, with 8px margin)

### Enemy Combat
- **Player hit on enemy**: Knockback (95px), magenta spark burst (5 particles), screen shake (45ms)
- **Enemy death**: Score is incremented twice (`Enemy.die()` adds `xp × 10`, LevelScene adds `xp` + floating text), then death particles (10 multi-color) and loot drop
- **Enemy projectiles → player**: Standard hurt flow (invincibility, particles, shake)
- **Enemy touch → player**: Melee damage using enemy's damage value

### Sprite Fallbacks
Missing sprites fall back to alternatives (at BootScene texture-alias level):
- skelet → chort
- necromancer → doc
- orc_armored → masked_orc

---

## Item & Loot System

### 15 Item Types

| Type | Name | Sprite | Effect | Value | Rarity | Duration |
|------|------|--------|--------|-------|--------|----------|
| WeaponSword | Iron Sword | weapon_regular_sword | BoostDamage | 1 | Common | — |
| WeaponDagger | Sharp Dagger | weapon_knife | BoostDamage | 1 | Common | — |
| WeaponKatana | Katana | weapon_katana | BoostDamage | 3 | Rare | — |
| WeaponHammer | War Hammer | weapon_big_hammer | BoostDamage | 2 | Uncommon | — |
| WeaponBomb | Bomb | bomb_f0 | BoostDamage | 4 | Uncommon | — |
| FlaskRed | Health Potion | flask_red | HealHP | 2 | Common | — |
| FlaskBlue | Speed Potion | flask_blue | BoostSpeed | 1.5× | Common | 5000ms |
| FlaskGreen | Shield Potion | flask_green | Shield | 1 | Uncommon | 8000ms |
| FlaskYellow | Rage Potion | flask_yellow | BoostDamage | 2× | Uncommon | 6000ms |
| FlaskBigRed | Greater Health | flask_big_red | HealHP | 3 | Rare | — |
| FlaskBigBlue | Greater Speed | flask_big_blue | BoostSpeed | 2.0× | Rare | 10000ms |
| Coin | Gold Coin | coin_0 | AddCoins | 1 | Common | — |
| Chest | Chest | chest_closed | AddCoins | 10 | Common | — |
| GoldenChest | Golden Chest | chest_golden_closed | AddCoins | 30 | Rare | — |

### Item Effects

| Effect | Behavior |
|--------|----------|
| HealHP | Increase playerHP by value (clamped to max) |
| BoostSpeed | Multiply playerSpeed by value for duration, then revert |
| BoostDamage | Multiply playerDamage by value for duration, then revert |
| Shield | Set hasShield=true for duration (blocks one hit via GameState) |
| MultiShot | Fire 3 projectiles instead of 1 for duration |
| AddCoins | Add value coins, score += coins × 5 |

### Pickup Behavior
- **Auto-collect** (walk over): Coins, all Flask types
- **Manual collect** (press E): Chests, Weapons
- Pickup detection: expanded player bounds (+4px each side)

### Drop Table (weighted random)

| Item | Weight | Probability |
|------|--------|-------------|
| Coin | 40 | 40.0% |
| FlaskRed | 18 | 18.0% |
| FlaskBlue | 12 | 12.0% |
| FlaskGreen | 8 | 8.0% |
| FlaskYellow | 8 | 8.0% |
| WeaponSword | 5 | 5.0% |
| WeaponDagger | 4 | 4.0% |
| WeaponHammer | 3 | 3.0% |
| WeaponKatana | 1 | 1.0% |
| FlaskBigRed | 1 | 1.0% |

### Chest Loot
- Contains 2–3 random items from pool: FlaskBigRed, FlaskBigBlue, WeaponKatana, FlaskGreen, WeaponHammer, WeaponSword
- 25% chance for Golden Chest (worth 30 coins vs 10)

---

## Boss System

### 5 Bosses

| Level | Boss | Sprite | HP | Phases | Phase 2 Tint | Scale |
|-------|------|--------|-----|--------|-------------|-------|
| 1 | THE DEMON LORD | big_demon | 80 | 2 | 0xff4400 | 2.0× |
| 2 | THE DARK KNIGHT | masked_orc | 130 | 2 | 0x0055ff | 2.2× |
| 3 | THE NECROMANCER | necromancer | 170 | 3 | 0x8800ff | 1.8× |
| 4 | ELEMENTAL FUSION | big_demon | 220 | 3 | 0x00ffaa | 2.5× |
| 5 | THE WATCHER | big_demon | 320 | 3 | 0xcc33ff | 2.2× |

### Boss Room Entry
- Detected per-frame: check if player's tile position is inside boss room bounds
- On first entry:
  1. Spawn BossEntity at `(room.cx, room.cy - 2)` in tiles
  2. Show boss HP bar
  3. Show boss name text (fades after 3s)
  4. Camera shake (300ms, intensity 0.010)
  5. Create stairs sprite (invisible until boss dies)
  6. Set up boss-specific collisions

### Boss Phase Changes
- Phase text appears: "PHASE N!" — fades in over 300ms, holds 600ms, fades out

### Boss Death Sequence
1. **Slow-motion effect**: time scale drops to 0.25× for 600ms, then eases back to 1.0× over 800ms
2. Camera shake: 400ms, intensity 0.015
3. Hide boss HP bar
4. Score bonus: 50 + (levelNum × 20) XP
5. Coin explosion: 12 coins scattered in ±40px radius
6. Reveal stairs sprite
7. "BOSS DEFEATED!" text (centered, gold, with stroke)
8. Auto-save game state
9. If level 5: transition to VictoryScene after 2.5s delay
10. Otherwise: wait for player to walk on stairs

### Boss HP Bar
- Position: top center of internal view (60, 12) — 200×7 pixels
- Background: dark red (0x220000, 85% alpha) with border (0x660000)
- Fill: red (0xff3333), changes to orange (0xff8800) below 40%
- Hidden until boss spawns

---

## Level Progression

### Flow
1. Player starts in Start room
2. Explore dungeon, fight enemies, collect loot
3. Enter Boss room → boss spawns, room "locks down"
4. Defeat boss → stairs appear
5. Walk on stairs → next level (or VictoryScene at level 5)

### Stairs Detection
- Polled every 300ms (timer event, not per-frame)
- Trigger distance: 1.5 tiles from stairs position
- On enter: persist HP to GameState, auto-save, fade to black → start next LevelScene

### Level Intro
- On level start: level name (7px, white, stroke) + subtitle (4px, gray)
- Fades in over 500ms, holds 1500ms, fades out
- Camera fades in from black (500ms)

---

## Camera

- Follows player with lerp 0.10 (both axes)
- Bounds: full world size (mapWidth × TILE, mapHeight × TILE)
- Background color: from level data (dark purple-blacks)

---

## Systems

### Lighting System
- Fog-of-war style darkness overlay using a RenderTexture with MULTIPLY blend
- Overlay alpha = level fog density (0.55 → 0.85)
- Light source: player light radius 55px
- Light source: torch light radius 42px (slight flicker)
- RenderTexture size: 320×180, fixed to camera

### MiniMap
- Top-right overlay, scale = 1/10 (1 minimap px per 10 tiles)
- Rooms always visible (no fog-of-war)
- Colors by room type: Normal `0x334455`, Start `0x2255aa`, Boss `0xaa2222`, Treasure `0xaaaa22`, Secret `0x225522`
- Corridors drawn as 1px dots in `0x445566` (floors not inside rooms)
- Stairs shown as a 2×2 white square
- Player shown as a 3×3 yellow dot
- Updates at 5 Hz (every 200ms)

### Loot System
- Enemy drop chance: **40%** per kill
- Chest loot: always 2–3 items; golden chests add one extra `FlaskBigRed`
- Spawns Item entities at world position
- Coins bounce outward with a short tween (280ms), then become static

### Score System
- Floating “+N” text (Press Start 2P, 5px) rises 18px over 900ms, then fades
- Colors: XP default `#ffdd44`, coin `#ffcc00`, heal `#33ff66`
- Coins add +5 score each

---

## HUD Elements (at 320×180 internal resolution)

### Hearts (bottom-left)
- 1 heart = 2 HP
- Max hearts = ceil(maxHP / 2)
- Each heart: full (≥2 HP), half (1 HP), or empty (0 HP)
- Sprites: `ui_heart_full`, `ui_heart_half`, `ui_heart_empty`
- Position: starting at (10, 164), 14px apart horizontally

### Level Text (top-left)
- "LEVEL N" — 5px, gold (#ffcc00)
- Position: (6, 6)

### Coin Counter (top-left, below level)
- "COINS: N" — 5px, gold (#ffdd44)
- Position: (6, 14)

### Score (top-right)
- "SCORE: N" — 4px, gold (#eecc55)
- Position: (314, 6), right-aligned

### Dash Cooldown Bar (bottom-left, below hearts)
- Label: "DASH" (4px, dark cyan)
- Bar: 30×3 px
- Ready: full cyan (0x00ffff, 85% alpha)
- Cooldown: gray background + cyan fill proportional to remaining time

### Shield Indicator (bottom-left)
- Active: pulsing blue circle (radius 5, at 90, 172)
- Cooldown: dim blue bar filling up (30px wide)

### Weapon Name (bottom-right)
- Current weapon: "SWORD" / "DAGGER" / "KATANA" / "HAMMER" / "BOMB"
- 4px, gold (#ffcc44)
- Position: (314, 162), right-aligned

### Pickup Hint (bottom-center)
- "[E] Pick up" — 5px, light green (#aaffaa)
- Shown only when near an interactive item
- Position: (160, 155), centered

### Boss HP Bar (top-center)
- Only visible during boss fight
- See Boss System section above

---

## Collision Matrix

| A | B | Type | Result |
|---|---|------|--------|
| Player | Walls | Collider | Block movement |
| Enemies | Walls | Collider | Block movement |
| Enemies | Enemies | Collider | Gentle separation |
| Player Projectiles | Walls | Collider | Destroy projectile |
| Enemy Projectiles | Walls | Collider | Destroy projectile |
| Player Projectiles | Enemies | Overlap | Damage enemy, knockback, destroy projectile |
| Player Projectiles | Boss | Overlap | Damage boss, update HP bar, destroy projectile |
| Enemy Projectiles | Player | Overlap | Hurt player (respects i-frames) |
| Enemies | Player | Overlap | Melee damage (respects i-frames) |
| Player | Items | Manual check | Auto-collect or E-key pickup |
