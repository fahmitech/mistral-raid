# Plan: Comprehensive Test Suite (Dungeon Crawler + Optional AI Prototype)

**Spec Tasks:** Dungeon crawler validation (LevelScene, core systems). Optional: arena AI prototype validation.
**Beads ID:** _(create with `bd create --title="Test suite" --type=task --priority=1`)_
**Status:** DRAFT
**Created:** 2026-02-28
**Dependencies:** Docs locked; all core gameplay systems implemented

---

## Objective

Deliver a complete test suite that validates the dungeon crawler experience end to end and prevents regressions. The suite must cover core gameplay flow, progression, inventory, boss fights, save/load, UI, and critical system invariants. AI prototype tests are included as optional if that stack is wired into gameplay.

---

## Scope

**In scope**
- Unit tests for core gameplay logic and data invariants
- Integration tests for server AI services (optional, only if AI stack is wired)
- E2E tests for dungeon crawler flow (Boot -> Menu -> PlayerSelect -> LevelScene -> Victory/GameOver)
- Smoke test runnable against a deployed build
- Visual parity checks for pixel scale, HUD placement, and dungeon readability

**Out of scope**
- Phaser engine internals
- Load or performance stress tests
- Mobile browser matrix

---

## Test Taxonomy

| Layer | Tool | Target | CI? |
|------|------|--------|-----|
| Unit | Vitest | Core logic, factories, state, config | Yes |
| Integration (server, optional) | Node test scripts | Mistral, ElevenLabs, validator, fallback | Yes (with keys) |
| E2E (dungeon) | Playwright | Full gameplay flow | Yes |
| Smoke (deployed) | Playwright | Basic live verification | Manual |
| Visual parity | Checklist + screenshots | Look/feel match | Manual |

---

## Files to Create or Modify

| File | Action | Notes |
|------|--------|-------|
| `tests/unit/mazeGenerator.test.ts` | Create | Room count, connectivity, bounds
| `tests/unit/levelConfig.test.ts` | Create | Level scaling, counts, bounds
| `tests/unit/enemyFactory.test.ts` | Create | Enemy stats, fallback sprites
| `tests/unit/bossFactory.test.ts` | Create | Boss stats and names
| `tests/unit/itemFactory.test.ts` | Create | Drop table weights, item effects
| `tests/unit/gameState.test.ts` | Create | HP, coins, score, buffs, damage
| `tests/unit/saveSystem.test.ts` | Create | Save/load keys, serialization
| `tests/unit/lootSystem.test.ts` | Create | Chest loot size, coin logic
| `tests/unit/scoreSystem.test.ts` | Create | Score increments and bonuses
| `tests/e2e/smoke.spec.ts` | Create | 8 to 10 smoke checks
| `tests/e2e/progression.spec.ts` | Create | Level 1 -> 5 progression
| `tests/e2e/combat.spec.ts` | Create | Damage, invincibility, shield, dash
| `tests/e2e/inventory.spec.ts` | Create | Weapons, potions, inventory UI
| `tests/e2e/save-load.spec.ts` | Create | Save, exit, continue flow
| `tests/e2e/ui-hud.spec.ts` | Create | Hearts, coins, boss HP, minimap
| `tests/helpers/gameBridge.ts` | Create | Playwright <-> Phaser API
| `playwright.config.ts` | Create | e2e + smoke projects
| `vitest.config.ts` | Create | unit test config
| `package.json` (root) | Modify | test scripts

---

## Test Harness: Playwright <-> Phaser Bridge

Playwright cannot read Phaser objects directly, so expose a dev-only bridge:

```ts
// client/src/main.ts (DEV only)
if (import.meta.env.DEV) {
  window.__MISTRAL_RAID__ = {
    getScene: () => game.scene.getScenes(true)[0]?.scene.key,
    getPlayerHP: () => scene.player.hp,
    setPlayerHP: (hp) => scene.player.hp = hp,
    getBossHP: () => scene.boss?.hp ?? null,
    setBossHP: (hp) => scene.boss && (scene.boss.hp = hp),
    getLevel: () => scene.currentLevel,
    setLevel: (lvl) => scene.debugSetLevel(lvl),
    teleportPlayer: (x, y) => scene.player.setPosition(x, y),
    giveItem: (id) => scene.inventory.addItem(id),
    getInventory: () => scene.inventory.items,
    openInventory: () => scene.scene.launch('InventoryScene'),
    openPause: () => scene.scene.launch('PauseScene'),
    isPaused: () => scene.scene.isActive('PauseScene'),
    revealBossRoom: () => scene.debugRevealBossRoom(),
    killBoss: () => scene.debugKillBoss(),
    forceStairs: () => scene.debugRevealStairs(),
  };
}
```

The debug helpers (`debugSetLevel`, `debugRevealBossRoom`, `debugKillBoss`, `debugRevealStairs`) can be no-op in production and only exist in dev builds.

---

## Implementation Steps

### Step 1: Test Tooling Setup

**Goal:** configure Vitest + Playwright.

**Acceptance criteria**
1. `npm run test:unit` executes and reports results
2. `npm run test:e2e` launches Playwright against localhost
3. `npm run test:smoke` uses `DEPLOY_URL`

---

### Step 2: Unit Tests for Core Logic

**Targets:** MazeGenerator, LevelConfig, EnemyFactory, BossFactory, ItemFactory, GameState, SaveSystem, LootSystem, ScoreSystem.

**Example assertions**
1. MazeGenerator produces N rooms within bounds
2. Rooms do not overlap and corridors connect all rooms
3. LevelConfig has 5 levels with increasing size and enemy counts
4. EnemyFactory returns 10 enemy types with valid stats
5. BossFactory returns 5 bosses with correct HP values
6. ItemFactory drop table weights sum to 100 percent
7. GameState damage respects shield and invincibility
8. SaveSystem uses `mistralraid_save` and `mistralraid_options`
9. LootSystem chests always return 2 to 3 items
10. ScoreSystem: coins add +5 score; boss defeat adds bonus = 50 + (levelNum * 20)

**Acceptance criteria**
1. All unit tests pass
2. No reliance on Phaser runtime for pure logic tests

---

### Step 3: E2E Smoke (Dungeon)

**File:** `tests/e2e/smoke.spec.ts`

**Checks (8 to 10)**
1. BootScene loads and transitions to MenuScene
2. Menu -> PlayerSelect -> LevelScene transition works
3. HUD hearts visible and count matches starting HP
4. Coins and score visible and non-overlapping
5. Player can move, dash, and fire a projectile
6. Inventory opens and closes
7. Pause opens and closes
8. One enemy hit reduces enemy HP
9. Boss room is discoverable (or force-revealed via debug helper)
10. No console errors

**Acceptance criteria**
1. All checks pass on localhost
2. All checks pass on deployed build via `DEPLOY_URL`

---

### Step 4: E2E Combat and Systems

**File:** `tests/e2e/combat.spec.ts`

**Checks**
1. Player invincibility lasts `INVIC_DUR = 700ms`
2. Dash teleports ~44px, grants 180ms invincibility, and respects cooldown
3. Shield blocks one hit and shatters
4. Enemy knockback occurs on hit
5. Boss HP decreases when hit

**Acceptance criteria**
1. Combat behaviors match `docs/reference/dungeon-crawler.md`

---

### Step 5: E2E Inventory and Items

**File:** `tests/e2e/inventory.spec.ts`

**Checks**
1. Weapon swap cycles only owned weapons
2. Potion use consumes correct item in order (FlaskRed -> FlaskBigRed -> FlaskGreen) and heals expected HP
3. Chest loot adds 2 to 3 items
4. Inventory UI lists items and updates after use

**Acceptance criteria**
1. Inventory actions match `docs/reference/characters.md`

---

### Step 6: E2E Progression

**File:** `tests/e2e/progression.spec.ts`

**Checks**
1. Stairs appear only after boss defeat
2. Level increments on stairs use
3. Enemy scaling increases by level (HP and speed multipliers)
4. Boss death triggers slow-motion and score bonus (50 + levelNum * 20)
5. Level 5 boss defeat transitions to VictoryScene

**Acceptance criteria**
1. Full Level 1 -> 5 path can complete without errors

---

### Step 7: E2E Save and Load

**File:** `tests/e2e/save-load.spec.ts`

**Checks**
1. Save occurs on boss defeat
2. Save occurs on stairs transition
3. Menu "Continue" enabled when save exists
4. Continue restores level, stats, inventory
5. Delete save clears Continue option

**Acceptance criteria**
1. Save/load works across full page refresh

---

### Step 8: E2E UI and HUD

**File:** `tests/e2e/ui-hud.spec.ts`

**Checks**
1. Hearts render correctly for current HP
2. Boss HP bar shows only in boss room
3. Minimap renders rooms + corridors, player dot, and stairs marker; updates at 5 Hz
4. Lighting/fog present and follows player

**Acceptance criteria**
1. HUD matches `docs/reference/dungeon-crawler.md` (HUD Elements section)

---

### Step 9: Optional AI Prototype Tests

Only implement these if the arena AI stack is wired into gameplay.

**Targets**
1. Server integration: promptBuilder, mistralService, responseValidator, fallbackCache
2. WebSocket round-trip: ANALYZE -> BOSS_RESPONSE
3. AI fallback: server returns cached fallback when API fails
4. Arena mechanics: 6 mechanic types spawn and function

**Acceptance criteria**
1. All AI tests pass with valid API keys
2. Fallback activates when keys are missing or invalid

---

## CI Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "test:unit":  "vitest run",
    "test:e2e":   "playwright test --project=e2e",
    "test:smoke": "playwright test --project=smoke",
    "test:all":   "npm run test:unit && npm run test:e2e"
  }
}
```

---

## Visual Parity Verification (Manual)

Use the checklist in `docs/specs.md` and capture screenshots at:
1. Level 1 start room
2. First corridor with enemies
3. Boss room with HUD visible
4. Victory or Game Over screen

---

## Test Run Order

1. Unit: `npm run test:unit`
2. E2E local: `npm run test:e2e`
3. Smoke (deployed): `DEPLOY_URL=... npm run test:smoke`

---

*Last updated: 2026-02-28*
