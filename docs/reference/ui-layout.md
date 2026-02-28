# UI & Visual Layout Specification

> Describes all HUD elements, overlays, debug console, and visual effects.

**Current wiring status:** The arena UI utilities (`HUD`, `DevConsole`, `AnalyzingOverlay`, `TauntText`, `ParticleManager`) exist in `client/src/ui` and `client/src/systems`, but **no scene instantiates them** in the shipped build. LevelScene uses its own HUD (see `dungeon-crawler.md`).

---

## Display Configuration

```
Internal resolution:  320 × 180 pixels
Display resolution:   1280 × 720 pixels (4× zoom)
Rendering mode:       Pixel art (nearest-neighbor scaling, no anti-aliasing)
Background color:     #0a0a1a (dark purple-black)
```

---

## Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | `#0a0a1a` | 10, 10, 26 | Arena background |
| Player / Cyan | `#00ffff` | 0, 255, 255 | Player entity, dash trail |
| Boss / Magenta | `#ff0066` | 255, 0, 102 | Boss entity, boss HP bar |
| Projectile / Yellow | `#ffcc00` | 255, 204, 0 | Boss projectiles |
| Hazard / Orange | `#ff4400` | 255, 68, 0 | Hazard zones, low HP |
| Laser / Red | `#ff3333` | 255, 51, 51 | Active laser beams |
| HP Green | `#00ff66` | 0, 255, 102 | Player HP bar (healthy) |
| HP Yellow | `#ffff00` | 255, 255, 0 | Player HP bar (30–60%) |
| HP Orange | `#ff4400` | 255, 68, 0 | Player HP bar (<30%) |
| HP Red | `#ff0000` | 255, 0, 0 | Player HP bar (critical) |
| White | `#ffffff` | 255, 255, 255 | Walls, text, wall of death |
| Purple | `#aa00ff` | 170, 0, 255 | Homing orbs |
| Orb Body | `#9d5bff` | 157, 91, 255 | Homing orb fill |
| Orb Glow | `#5b2cff` | 91, 44, 255 | Homing orb glow |
| Taunt Pink | `#ff2266` | 255, 34, 102 | Boss taunt text |
| Grid | `#1a1a3a` | 26, 26, 58 | Floor grid lines |
| Dash Trail | `#00ffe1` | 0, 255, 225 | Cyan afterimage |
| Hazard Warn | `#ff5f9c` | 255, 95, 156 | Hazard warning phase (20% alpha) |
| Hazard Active | `#ff2675` | 255, 38, 117 | Hazard active phase (35% alpha) |
| Minion | `#00ffff` | 0, 255, 255 | Minion triangles |

---

## HUD (Head-Up Display — Unused)

`HUD` is defined for the arena boss fight but is **not instantiated** by any scene. If wired, all positions are relative to 1280×720 display.

### Boss HP Bar (Top)

```
┌──────────────────────────────────────────────────┐
│ THE ARCHITECT          [████████████░░░]  HP 150/200  │
│                        ← boss HP bar →               │
└──────────────────────────────────────────────────┘
```

- **Name label:** "THE ARCHITECT" — centered at `(WIDTH/2, 16)`
- **HP bar:** Horizontal bar, top-center; dark gray background, magenta fill `#ff0066`, width proportional to current/max HP
- **HP text:** "HP 150/200" — positioned at `(WIDTH-60, 16)`
- Updates every frame

### Player HP Bar (Bottom-Left)

```
┌──────────────────────────────────────────────────┐
│                                                      │
│ [████████░░░]  HP 72/100                             │
│ ← player HP bar →                                   │
└──────────────────────────────────────────────────┘
```

- **HP bar:** Bottom-left at `(60, HEIGHT-40)` with 200×16 bg, 196×12 fill
- Fill color by HP percentage: `>60%` green `#00ff66`, `30–60%` yellow `#ffff00`, `<30%` orange `#ff4400`
- **HP text:** "HP 72/100" next to bar

### Phase Indicator (Bottom-Center)

- Text: "PHASE 1" or "PHASE 2" or "PHASE 3"
- Position: `(WIDTH/2, HEIGHT-40)`
- Color: white

### Dash Cooldown Indicator (Bottom-Left)

- Small cyan circle at `(260, HEIGHT-40)`, radius 10
- **Ready:** Alpha 0.8, scale 1.4
- **On cooldown:** Alpha 0.2, scale 0.8
- Visual feedback for dash availability

### Offline Indicator

- Text: `[OFFLINE MODE]` at `(20, 16)`
- Hidden by default; no code currently toggles it

---

## DevConsole (Debug Overlay — Unused)

**Toggle:** `D` key (if instantiated)
**Purpose:** Minimal telemetry + response logger (not full pipeline)

### Layout

```
┌─ DevConsole ──────────────────────────────┐
│ TELEMETRY COLLECTED:                       │
│   Duration: 42.3s                          │
│   Heatmap TL:12 TC:8 TR:5                  │
│   Heatmap ML:10 MC:35 MR:9                 │
│   Heatmap BL:6 BC:4 BR:7                   │
│   Dodge L:25 R:30 U:20 D:25               │
│   Shots Fired:145 Hit:82                   │
│   Orbs Destroyed:3                         │
│   HP at Transition:87                      │
│   Forced by Timeout:false                  │
│   Move Dist:3245.2px Avg Speed:76.8px/s    │
│                                            │
│ AI MODEL: mistral-small-latest             │
│ GENERATING ATTACK CONFIG...                │
│                                            │
│ RESPONSE:                                  │
│ { ... }                                    │
└────────────────────────────────────────────┘
```

### Content Sections

1. **TELEMETRY COLLECTED** — Duration, heatmap counts, dodge bias, shots fired/hit, orbs destroyed, HP at transition, timeout flag, movement distance, average speed
2. **AI MODEL** — Whatever string is passed into `showModel()`
3. **RESPONSE** — Raw `BossResponse` JSON via `JSON.stringify`

### Behavior
- Panel rectangle at `(1120, 360)` sized `320×720`, color `0x0b0b14` at 70% alpha
- Text at `(960, 40)`, max 28 lines, width 300px, `Courier New` 12px
- Hidden by default; toggled with `D`
- No built-in persistence or clearing logic (depends on scene using it)

---

## AnalyzingOverlay (Unused)

**When:** Only shown if a scene calls `show()`

### Layout

```
┌──────────────────────────────────────────┐
│                                          │
│         ⚠️ ANALYZING PLAYER HABITS...     │
│                                          │
│   ─────────────── (scanning line) ──     │
│                                          │
│   movement_heatmap: processing...        │
│   dodge_patterns: calculating...         │
│   accuracy_data: 0x4F2A...               │
│   (random noise text updates)            │
│                                          │
└──────────────────────────────────────────┘
```

### Elements
- **Dark overlay:** Dims the game screen (semi-transparent black)
- **Title:** "⚠️ ANALYZING PLAYER HABITS..." (centered, 28px)
- **Scanning line:** 4px horizontal line sweeps vertically from y=120 to y=(HEIGHT-120)
- **Noise text:** Random telemetry-looking text that updates every 300ms; purely cosmetic

### Timing
- `show()` starts scan tween and random text updates every 300ms
- `hide()` stops tween and hides the container

---

## TauntText (Unused)

**When:** Only shown if a scene calls `show(message)`

### Layout
- **Position:** Center of screen
- **Color:** Magenta/pink `#ff2266`
- **Font size:** 26px (display resolution)
- **Max width:** 900px (word-wrapped)

### Typewriter Effect
- Characters appear one at a time
- Delay: 35ms per character
- Creates a "boss speaking" feel

### Auto-fade
- After full text displayed, waits `durationMs` (default 4000)
- Fades out over 500ms

---

## Visual Effects (ParticleManager — Unused)

`ParticleManager` is defined but not instantiated by any scene. It uses a code-drawn `particle-dot` texture (8×8 white circle) and provides:

- `burst(x, y, color, count=8, scale=1)` — generic particle burst
- `dash(x, y)` — cyan burst (0x00ffff)
- `shoot(x, y)` — yellow burst (0xffff00)
- `playerHit(x, y)` — red burst + camera shake (200ms, 0.004)
- `bossHit(x, y)` — magenta burst + white flash
- `explosion(x, y, color=0xff4400)` — big burst + camera shake (300ms, 0.006)
- `bossDeath(x, y)` — large burst + camera shake (1000ms, 0.012)
- `dashTrail(x, y)` — small cyan burst
- `startShieldOrbit(target, radius=90)` — orbiting particles around a target
- `startProjectileTrails([{ group, color }], intervalMs=80)` — trails for active projectiles
- `spawnHazardEdgeEffect({ x, y, radius, shape, width, height, duration })` — periodic edge sparks

### Screen Shake
- Triggered on: heavy damage, boss phase transitions, wall of death impact
- Small displacement (2–4 pixels) for ~200ms
- Camera shake, not object displacement

---

## Arena Visual Elements

### Floor
- Checkerboard pattern (alternating light/dark tiles)
- 16px tiles at internal resolution

### Walls
- Top wall: stone face texture with decorative elements
- Side walls: column sprites at edges
- Bottom wall: stone base

### Decorations (No Collision)
- **Banners:** Red and blue, animated sway (2-frame)
- **Fountains:** 3-frame water animation, positioned on top wall
- **Skulls:** Floor decoration
- **Crates:** Corner decoration

---

## Asset Mapping (Current Pack)

All available art lives in `assets/0x72/frames/` as individual PNGs (no atlas, no audio).
Frame naming uses `_anim_f0..f3` suffixes for animated sets.

### Player Class Mapping

| Class | Recommended Sprite Set | Notes |
|-------|-------------------------|-------|
| Knight | `knight_*` | Full idle/run/hit frames exist |
| Rogue | `elf_*` | No `rogue_*` set exists; `elf_*` is the closest light/fast silhouette |
| Mage | `wizzard_*` | Spelled `wizzard` in filenames |
| Paladin | `dwarf_*` | No `paladin_*` animation set; `dwarf_*` is the closest heavy silhouette. Only `npc_paladin.png` exists as a static portrait |

### Enemy Mapping (10 Types)

| Enemy Type | Sprite Prefix | Notes |
|------------|---------------|-------|
| Goblin | `goblin_*` | Idle/run frames present |
| Imp | `imp_*` | Idle/run frames present |
| Chort | `chort_*` | Idle/run frames present |
| BigZombie | `big_zombie_*` | Idle/run frames present |
| IceZombie | `ice_zombie_*` | 4-frame anim set |
| MaskedOrc | `masked_orc_*` | Idle/run frames present |
| BigDemon | `big_demon_*` | Idle/run frames present |
| Skelet | `skelet_*` | Idle/run frames present |
| Necromancer | `necromancer_*` | 4-frame anim set + `monster_necromancer.png` |
| OrcArmored | `monster_orc_armored.png` | Static sprite only (no animation set) |

### Boss Mapping (5 Bosses)

| Boss | Suggested Sprite | Notes |
|------|------------------|-------|
| Demon Lord | `monster_demon.png` or `big_demon_*` | Both are available; pick one |
| Dark Knight | `monster_dark_knight.png` | Available |
| Necromancer | `monster_necromancer.png` or `necromancer_*` | Both are available; pick one |
| Elemental Fusion | `monster_elemental_*` | Multiple elemental variants exist; pick one |
| The Watcher | _No direct match_ | Choose an existing sprite (e.g., `monster_demonolog.png`, `angel_*`) or add a custom asset |

### UI Elements

| UI Element | Sprite | Notes |
|------------|--------|-------|
| Buttons | `button_blue_up/down.png`, `button_red_up/down.png` | Two color variants for menus |

### Environment Tiles (Common Prefixes)

| Category | Prefixes / Examples |
|----------|---------------------|
| Floors | `floor_*`, `Floor_*`, `floor_gargoyle_*`, `floor_mud_*` |
| Walls | `wall_*`, `Wall_*`, `wall_fountain_*`, `wall_outer_*`, `wall_inner_*` |
| Edges | `Edge_*` |
| Pits | `Pit_*` |
| Doors | `doors_*` |
| Props | `torch_*`, `chest_*`, `column_wall.png`, `skull_*` |
