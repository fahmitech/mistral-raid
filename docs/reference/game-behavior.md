# Game Behavior Specification — ArenaScene (Stub) + Unused AI Stack

> Captures the **current code reality** for the standalone arena file and the unused AI boss-fight stack.
>
> **IMPORTANT:** ArenaScene exists in the codebase but is **not registered** in `main.ts`. The shipped game flow uses LevelScene (dungeon crawler). ArenaScene is a **static mock** without combat, AI, or telemetry.

---

## Current Status (Reality Check)

- `client/src/scenes/ArenaScene.ts` is a **static arena mock**: tile layout, simple player movement, idle boss sprite, and static UI.
- The AI boss fight stack **exists but is unused**.
- Unused: `client/src/entities/Player.ts`, `client/src/entities/Boss.ts`
- Unused: `client/src/systems/TelemetryTracker.ts`, `client/src/network/WebSocketClient.ts`
- Unused: `client/src/systems/MechanicInterpreter.ts` + `client/src/mechanics/*`
- Unused: `client/src/ui/HUD.ts`, `client/src/ui/DevConsole.ts`, `client/src/ui/AnalyzingOverlay.ts`, `client/src/ui/TauntText.ts`

For the dungeon crawler behavior, see `dungeon-crawler.md` and `scenes.md`.

---

## ArenaScene (Stub) — `client/src/scenes/ArenaScene.ts`

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
- **Sprite:** `knight_idle_0` (idle/run animations at 8 FPS)
- **Controls:** Arrow keys only
- **Speed:** 100 px/s (local constant)
- **Behavior:** Flip horizontally on left/right movement
- **Physics bounds:** constrained to playable area

### Boss (Stub)
- **Sprite:** `boss_idle_0..3` (idle animation @ 8 FPS)
- **Position:** (160, 52)
- **Scale:** 2×
- **Behavior:** Idle only (no attacks, no HP)

### UI (Stub)
- **Boss name:** "THE WATCHER" at (160, 6)
- **Boss HP bar:** static red bar (no updates)
- **Player HP bar:** static red bar (no updates)

---

## Unused Arena Combat Stack (Not Wired)

### Player Class — `client/src/entities/Player.ts`
- **Uses** `CONFIG` from `client/src/config/gameConfig.ts`
- **Controls:** WASD movement, Space dash, LMB shooting (hold to fire)
- **Dash:** Distance = `CONFIG.PLAYER_DASH_SPEED` (500 px), duration 150ms, cooldown 1500ms, emits `player-dash` and `player-dash-trail`
- **Shooting:** Cooldown 200ms, projectile speed 600 px/s, damage 10, lifetime 2000ms, emits `player-shot`
- **I-frames:** 500ms after damage
- **Events:** `player-hit`, `player-dead`

### Boss Class — `client/src/entities/Boss.ts`
- **Uses** `CONFIG` from `gameConfig.ts`
- **States:** `IDLE → TELEGRAPH → ATTACK → COOLDOWN`
- **Telegraph durations:** 800ms (default), 1000ms for SLAM
- **Attack order:** `SPRAY → SLAM → SWEEP` (CHASE_SHOT added after 90s)
- **Phase 1 time escalation:** ≥60s → attack interval 2000ms; ≥90s → 1600ms + CHASE_SHOT enabled
- **SPRAY:** 8 bullets, 80° cone toward player, speed 420, damage 10
- **SLAM:** radius 90 circle at player position; damage 20 if inside at hit
- **SWEEP:** 12 bullets across a random y (220–560), speed 520, damage 8
- **CHASE_SHOT:** tracking projectile, speed 320, damage 12, lifetime 3000ms
- **Events:** `boss-hit`, `boss-telegraph`, `boss-phase-transition`, `boss-dead`
- **Phase transition trigger:** emits when HP ≤ `CONFIG.BOSS_PHASE_TRANSITION_HP` (100)

### Telemetry + Networking (Unused)
- **TelemetryTracker:** collects heatmap, dodge bias (from dashes), shots fired/hit, distance, reaction time (see `telemetry.md`)
- **WebSocketClient:** retries connection up to 3 times with 1s delay; emits status callbacks

### Mechanics (Unused)
- `MechanicInterpreter` + 6 mechanic classes are implemented but not instantiated.
- See `mechanics.md` for exact behavior.

### UI Overlays (Unused)
- `HUD`, `DevConsole`, `AnalyzingOverlay`, `TauntText` exist but are not referenced.
- See `ui-layout.md`.
