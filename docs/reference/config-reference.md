# Configuration Reference

> All game constants, tunable values, and clamping ranges in one place.

---

## Display

| Constant | Value | Notes |
|----------|-------|-------|
| Internal Width | 320 px | Game logic resolution |
| Internal Height | 180 px | Game logic resolution |
| Display Width | 1280 px | Rendered resolution (4× zoom) |
| Display Height | 720 px | Rendered resolution (4× zoom) |
| Zoom Factor | 4× | Internal → display scaling |
| Pixel Art Mode | true | Nearest-neighbor scaling, no smoothing |
| Round Pixels | true | Snap to integer pixels |
| Background Color | `#0a0a1a` | Dark purple-black |

---

## Player Stats (LevelScene — Dungeon Crawler)

| Constant | Value | Notes |
|----------|-------|-------|
| Default Max HP | 6 (3 hearts) | Varies by character (3–8) |
| Movement Speed | 110 px/s | Varies by character (88–145) |
| Dash Distance | 44 px | Instant teleport |
| Dash Cooldown | 1500 ms | Time between dashes |
| Dash Invincibility | 180 ms | Brief i-frames during dash |
| Invulnerability Duration | 700 ms | I-frames after taking damage |
| Shoot Cooldown | 280 ms | Varies by character (200–420) |
| Projectile Speed | 160 px/s | Player bullet speed |
| Projectile Damage | 1.0 | Varies by character (0.8–2.0) |
| Projectile Lifetime | 3000 ms | Auto-despawn |
| Projectile Size | 6×6 px | Generated circle texture |
| Player Body Size | 10×12 px | Physics body (offset 3, 4) |
| Shield Duration | 1200 ms | Right-click shield active time |
| Shield Cooldown | 1800 ms | Time between shield uses |
| Color | `#00ffff` | Cyan |

---

## Arena Config (Unused Stack)

These values live in `client/src/config/gameConfig.ts` and are used by the **unused** arena combat classes (`Player`, `Boss`, `HUD`, `TelemetryTracker`).

| Constant | Value | Notes |
|----------|-------|-------|
| Width | 1280 | Arena display width |
| Height | 720 | Arena display height |
| Player HP | 100 | Arena player max HP |
| Player Speed | 300 | px/s |
| Dash Speed | 500 | px/s (also used as dash distance) |
| Dash Duration | 150 ms | |
| Dash Cooldown | 1500 ms | |
| I-frames | 500 ms | |
| Shoot Cooldown | 200 ms | |
| Projectile Speed | 600 px/s | |
| Projectile Damage | 10 | |
| Player Radius | 16 px | |
| Boss HP | 200 | |
| Boss Radius | 40 px | |
| Phase Transition HP | 100 | Emits `boss-phase-transition` |
| Boss Phase 3 HP | 50 | (unused) |
| Boss Attack Interval | 2500 ms | Phase 1 base |
| Boss Attack Interval P1 @60s | 2000 ms | |
| Boss Attack Interval P1 @90s | 1600 ms | |
| Boss Attack Interval P2 | 4000 ms | (unused) |
| Boss Attack Interval P3 | 2000 ms | (unused) |
| Telemetry Interval | 500 ms | |
| WS_URL | `ws://localhost:3001` | Client default |

### Character Stat Variations

| Character | Max HP | Speed | Damage | Fire Rate |
|-----------|--------|-------|--------|-----------|
| Knight | 6 | 110 | 1.0 | 280ms |
| Rogue | 4 | 145 | 0.8 | 200ms |
| Mage | 3 | 100 | 2.0 | 420ms |
| Paladin | 8 | 88 | 1.5 | 360ms |

---

## Boss Stats (Dungeon Crawler)

5 bosses, one per level:

| Level | Boss | HP | Phases | Phase 2 Tint | Scale |
|-------|------|----|--------|-------------|-------|
| 1 | THE DEMON LORD | 80 | 2 | 0xff4400 | 2.0× |
| 2 | THE DARK KNIGHT | 130 | 2 | 0x0055ff | 2.2× |
| 3 | THE NECROMANCER | 170 | 3 | 0x8800ff | 1.8× |
| 4 | ELEMENTAL FUSION | 220 | 3 | 0x00ffaa | 2.5× |
| 5 | THE WATCHER | 320 | 3 | 0xcc33ff | 2.2× |

Boss death XP bonus: `50 + (levelNum × 20)`
Boss death coin explosion: 12 coins in ±40px radius

---

## Dungeon Levels

| Level | Name | Subtitle | Map (tiles) | Rooms | Enemies | Boss | Enemy HP× | Enemy Speed× | Fog |
|-------|------|----------|-------------|-------|---------|------|-----------|-------------|-----|
| 1 | THE DUNGEON ENTRANCE | Something stirs in the darkness… | 40×40 | 8 | 10 | BigDemon | 1.0 | 1.0 | 0.55 |
| 2 | THE DARK CORRIDORS | Iron boots echo in the black halls. | 60×60 | 14 | 20 | DarkKnight | 1.3 | 1.1 | 0.62 |
| 3 | THE CRYPT | The dead do not rest here. | 80×80 | 20 | 32 | Necromancer | 1.6 | 1.2 | 0.70 |
| 4 | THE ELEMENTAL FORGE | Heat. Cold. Thunder. Void. | 100×100 | 28 | 48 | ElementalFusion | 2.0 | 1.4 | 0.75 |
| 5 | THE ABYSS | It has been watching you the whole time. | 120×120 | 38 | 65 | TheWatcher | 2.5 | 1.6 | 0.85 |

### Level BG Colors

| Level | BG Color | Ambient Color |
|-------|----------|--------------|
| 1 | 0x0a0a1a | 0x000000 |
| 2 | 0x0c0a18 | 0x000000 |
| 3 | 0x080c18 | 0x000000 |
| 4 | 0x0a1208 | 0x000000 |
| 5 | 0x020008 | 0x000000 |

### Maze Generation Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Tile Size | 16 px | Internal resolution tile size |
| Room Width | 5–12 tiles | Random per room |
| Room Height | 4–9 tiles | Random per room |
| Room Overlap Padding | 2 tiles | Min gap between rooms |
| Max Room Placement Attempts | roomCount × 40 | |
| Extra Corridors | 25% of room count | Loop variety |
| Treasure Room Chance | 12% | Middle rooms |
| Secret Room Chance | 8% | Middle rooms |
| Item Spawn Chance | 40% | In Normal/Secret rooms |
| Torch Count Per Room | 1–2 | Wide rooms (>7 tiles) get 2 |
| Stairs Offset | +2 tiles right of boss room center |

---

## Telemetry

| Constant | Value | Notes |
|----------|-------|-------|
| Sample Interval | 500 ms | Position/state sampling rate |
| Phase 1 Timeout | 120 s | Force transition if exceeded |
| Dodge Velocity Threshold | 50 px/s | Min velocity to count as dodging |

### Heatmap Zone Boundaries (Display Resolution)

| Zone | X Range | Y Range |
|------|---------|---------|
| Top row | — | Y < 240 |
| Mid row | — | 240 ≤ Y < 480 |
| Bot row | — | Y ≥ 480 |
| Left col | X < 426 | — |
| Mid col | 426 ≤ X < 854 | — |
| Right col | X ≥ 854 | — |

---

## Network

| Constant | Value | Notes |
|----------|-------|-------|
| WebSocket URL (dev) | `ws://localhost:3001` | Client default in gameConfig.ts (override via VITE_WS_URL) |
| Server Port | 8787 | Server default in index.ts (override via PORT env) |

> **Port mismatch in this snapshot:** Client defaults to `3001`, server defaults to `8787`. Set `VITE_WS_URL=ws://localhost:8787` or `PORT=3001` to connect.
| API Timeout | 8000 ms | Max wait for AI response |
| WS Max Retries | 3 | Auto-reconnection attempts |
| WS Retry Delay | 1000 ms | Between reconnection attempts |

---

## AI API Configuration

### Mistral

| Setting | Primary | Fallback | Demo |
|---------|---------|----------|------|
| Model | `mistral-small-latest` | `ministral-8b-latest` | `mistral-large-latest` |
| Timeout | 4000 ms | 2000 ms | 6000 ms |
| Temperature | 0.8 | 0.7 | 0.9 |
| Max Tokens | 500 | 400 | 600 |
| Response Format | `json_object` | `json_object` | `json_object` |

### ElevenLabs

| Setting | Value |
|---------|-------|
| Model | `eleven_flash_v2_5` |
| Voice ID | `pNInz6obpgDQGcFmaJgB` |
| Output Format | `mp3_44100_128` |
| Timeout | 5000 ms |
| Stability | 0.3 |
| Similarity Boost | 0.8 |
| Style | 0.5 |
| Speed | 0.9 |

---

## Value Clamping Ranges

All AI-generated numeric values are clamped server-side before transmission.

### ProjectileSpawner

| Field | Min | Max |
|-------|-----|-----|
| speed | 3 | 12 |
| projectile_count | 1 | 12 |
| fire_rate | 0.5 | 4 |
| projectile_size | 4 | 16 |
| duration_seconds | 3 | 15 |

### HazardZone

| Field | Min | Max |
|-------|-----|-----|
| radius | 50 | 300 |
| damage_per_tick | 5 | 20 |
| duration_seconds | 3 | 15 |
| warning_time | 0.5 | 2 |

### LaserBeam

| Field | Min | Max |
|-------|-----|-----|
| speed | 1 | 5 |
| width | 10 | 60 |
| damage_on_hit | 15 | 40 |
| duration_seconds | 3 | 10 |
| telegraph_time | 0.5 | 2 |

### HomingOrb

| Field | Min | Max |
|-------|-----|-----|
| count | 1 | 4 |
| speed | 2 | 6 |
| damage_on_hit | 20 | 40 |
| lifetime_seconds | 5 | 15 |
| size | 12 | 30 |

### WallOfDeath

| Field | Min | Max |
|-------|-----|-----|
| speed | 1 | 4 |
| gap_width | 50 | 150 |
| damage_on_hit | 25 | 50 |
| gap_position | -1 | 1 |

**Note:** `gap_position = -1` is a sentinel value meaning "no gap" — preserved, not clamped.

### MinionSpawn

| Field | Min | Max |
|-------|-----|-----|
| count | 1 | 5 |
| minion_speed | 1 | 4 |
| minion_hp | 10 | 30 |

---

## Timing Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Mechanic Stagger | 400 ms | Delay between mechanic activations |
| Hazard Tick Rate | 500 ms | Damage tick while in hazard zone |
| Player Projectile Lifetime | 3000 ms | Auto-despawn after 3s |
| Taunt Typewriter Delay | 35 ms | Per-character reveal delay |
| Taunt Display Duration | 4000 ms | Time before fade-out |
| AnalyzingOverlay Noise Update | 300 ms | Random text update interval |
| Offline Overlay Duration | 2000 ms | Shortened overlay for offline fallback |
| Minion Orbit Radius | 160 px | Distance from boss for orbit behavior |
| Homing Lerp Factor | 0.02 | Projectile homing steering per frame |
| Orb Lerp Factor | 0.1–0.5 | Homing orb steering per frame |
| Dash Afterimage Duration | 300 ms | Cyan trail fade time |
| Screen Shake Duration | 200 ms | Camera shake length |
| Screen Shake Intensity | 2–4 px | Camera displacement |

---

## Enemy Base Stats

| Enemy | HP | Speed | Damage | XP | Behavior | Scale | Projectile Color |
|-------|-----|-------|--------|-----|----------|-------|-----------------|
| Goblin | 4 | 58 | 1 | 5 | MeleeChase | 1.0 | 0x00ff00 |
| Imp | 3 | 75 | 1 | 6 | RangedShoot | 1.0 | 0xff6600 |
| Chort | 6 | 68 | 2 | 9 | MeleeChase | 1.0 | 0x00ff00 |
| BigZombie | 14 | 38 | 3 | 16 | MeleeChase | 1.0 | 0x00ff00 |
| IceZombie | 8 | 30 | 2 | 13 | Exploder | 1.0 | 0x44aaff |
| MaskedOrc | 16 | 52 | 4 | 22 | Shielded | 1.0 | 0xff8800 |
| BigDemon | 22 | 48 | 5 | 32 | RangedShoot | 1.2 | 0xff0088 |
| Skelet | 6 | 62 | 2 | 11 | SplitOnDeath | 1.0 | 0xffffff |
| Necromancer | 20 | 42 | 3 | 28 | Summoner | 1.0 | 0xaa00ff |
| OrcArmored | 28 | 44 | 5 | 38 | Shielded | 1.1 | 0xff8800 |

---

## Item Drop Table (Weighted)

| Item | Weight | % Chance |
|------|--------|----------|
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

Chest loot: 2–3 items from [FlaskBigRed, FlaskBigBlue, WeaponKatana, FlaskGreen, WeaponHammer, WeaponSword].
Golden chest chance: 25%.

---

## Audio (Web Audio API — No Files)

| SFX | Waveform | Frequency | Notes |
|-----|----------|-----------|-------|
| player_shoot | square | 880 Hz | |
| player_dash | sawtooth | 420 Hz | |
| player_hit | triangle | 220 Hz | |
| boss_hit | sawtooth | 180 Hz | |
| explosion | square | 120 Hz | |
| ambient | sine | 70 Hz | 0.05 gain, continuous |

Master gain: 0.6
AudioContext unlock: on first `pointerdown` event
Base64 audio playback: for ElevenLabs TTS
