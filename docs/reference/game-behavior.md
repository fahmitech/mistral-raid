# Game Behavior — ArenaScene Stub & Deleted AI Stack

> **Status:** ✅ = exists | 🗑️ = was built, then deleted | ⬜ = not yet built

---

## Current Code Reality

The shipped game runs the **dungeon crawler** (LevelScene). The arena boss fight system was built and then removed. `ArenaScene.ts` still exists as a static layout stub but is not registered.

### What Exists

| File | Status | Notes |
|------|--------|-------|
| `client/src/scenes/ArenaScene.ts` | ✅ exists, unregistered | Static layout mock — tile map, idle boss sprite, no combat |
| `client/src/entities/Player.ts` | ✅ active (dungeon crawler) | WASD + dash + shoot, used in LevelScene |
| `client/src/entities/BossEntity.ts` | ✅ active (dungeon crawler) | Multi-phase dungeon boss, used in LevelScene |
| `client/src/entities/Enemy.ts` | ✅ active | |
| `client/src/entities/Item.ts` | ✅ active | |

### What Was Deleted (needs rebuilding for demo)

| File | Status | Purpose |
|------|--------|---------|
| `client/src/entities/Boss.ts` | 🗑️ deleted | Arena combat boss (phase 1 attacks: SPRAY/SLAM/SWEEP/CHASE_SHOT) |
| `client/src/systems/TelemetryTracker.ts` | 🗑️ deleted | Heatmap, dodge bias, accuracy, corner time tracking |
| `client/src/network/WebSocketClient.ts` | 🗑️ deleted | Client WebSocket with 3-retry reconnection |
| `client/src/systems/MechanicInterpreter.ts` | 🗑️ deleted | Factory: maps BossResponse.mechanics → mechanic class instances |
| `client/src/mechanics/*` (6 files) | 🗑️ deleted | ProjectileSpawner, HazardZoneSpawner, LaserBeam, HomingOrb, WallOfDeath, MinionSpawner |
| `client/src/ui/HUD.ts` | 🗑️ deleted | Arena HUD: boss HP bar, player HP bar, phase indicator |
| `client/src/ui/DevConsole.ts` | 🗑️ deleted | Debug overlay showing telemetry + AI response |
| `client/src/ui/AnalyzingOverlay.ts` | 🗑️ deleted | "ANALYZING PLAYER HABITS..." overlay during Mistral call |
| `client/src/ui/TauntText.ts` | 🗑️ deleted | Typewriter taunt display with auto-fade |
| `client/src/config/fallbackAttacks.ts` | 🗑️ deleted | 5 hardcoded BossResponse fallback configs |
| `client/src/config/gameConfig.ts` | 🗑️ deleted | Arena-specific constants (1280×720 resolution, arena player/boss stats) |

---

## ArenaScene (Stub) — `client/src/scenes/ArenaScene.ts`

**Not registered in `main.ts`.** Static layout only — no combat, no AI, no telemetry.

### Arena Layout
- **Internal resolution:** 320×180
- **Tile grid:** 20 cols × 11 rows (16px tiles)
- **Playable bounds:** x=16→304, y=32→160 (288×128)
- **Floor:** checkerboard of `floor_1`/`floor_2` on rows 2–9, cols 1–18
- **Walls:** top trim, main wall face, side columns, bottom wall
- **Decorations:** banners at cols 3,7,12,16 (red/blue)
- **Decorations:** fountains at cols 5,10,14 (animated 3 frames @ 8 FPS)
- **Decorations:** skulls at (2,9), (17,3), (9,8)
- **Decorations:** crates at (2,3) and (17,9)

### Player (Stub)
- Sprite: `knight_idle_0`, arrow keys only, 100 px/s, no combat

### Boss (Stub)
- Sprite: `boss_idle_0..3`, idle animation @ 8 FPS, position (160, 52), 2× scale, no attacks

### UI (Stub)
- Boss name "THE WATCHER" and static HP bars — no live updates

---

## Deleted Combat Stack — Reference Specs

These classes need to be rebuilt for the demo. See each relevant doc for full specs.

### Boss Phase 1 (Deleted `Boss.ts`)

**States:** `IDLE → TELEGRAPH → ATTACK → COOLDOWN`
**Telegraph durations:** 800ms (default), 1000ms for SLAM

**Attack sequence:** `SPRAY → SLAM → SWEEP` (CHASE_SHOT unlocked after 90s)
**Time escalation:**
- ≥60s → attack interval 2000ms
- ≥90s → attack interval 1600ms + CHASE_SHOT enabled

| Attack | Behavior |
|--------|----------|
| SPRAY | 8 bullets, 80° cone toward player, speed 420, damage 10 |
| SLAM | Radius 90 circle at player position, damage 20 on hit |
| SWEEP | 12 bullets across random y (220–560), speed 520, damage 8 |
| CHASE_SHOT | Tracking projectile, speed 320, damage 12, lifetime 3000ms |

**Phase transition:** Fires `boss-phase-transition` when HP ≤ 100 (50% of 200)

### Telemetry Tracker (Deleted)

Sampled every 500ms during Phase 1. See [types.md](types.md) for `TelemetryPayload` fields.

Key fields: 9-zone movement heatmap, dodge direction bias, shots_fired/hit, average_distance_from_boss, corner_time_pct, reaction_time_avg_ms, damage_taken_from (melee/projectile/hazard).

### Mechanic Interpreter + 6 Mechanic Classes (Deleted)

See [mechanics.md](mechanics.md) for full behavior specifications. Factory maps `BossResponse.mechanics[].type` → class instance via switch statement. No eval(), only 6 valid types.

### Arena HUD (Deleted)

Boss HP bar top-center, player HP bar bottom-left, phase indicator bottom-center, dash cooldown indicator. All at 1280×720 display resolution.

### DevConsole (Deleted)

Toggled with `D` key. Shows: collected telemetry, AI model used, raw `BossResponse` JSON.

### AnalyzingOverlay (Deleted)

Shown during Mistral API call. Dark overlay, "ANALYZING PLAYER HABITS..." title, sweeping scan line, random noise text updating every 300ms.

### TauntText (Deleted)

Typewriter effect (35ms/char), magenta `#ff2266`, center-screen, auto-fades after 4000ms.
