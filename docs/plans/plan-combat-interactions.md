# Plan: Fix & Enhance Combat Interactions

## Context

Player projectiles are **frozen at the muzzle** — they never reach enemies or bosses. Additionally, bosses have no AI and no contact damage. This plan addresses all combat interaction issues with surgical, safe changes.

---

## Critical Fix: Projectile Velocity Reset (Root Cause)

**Problem**: In `shootProjectile()` and `spawnEnemyProjectile()`, velocity is set on the projectile **before** `group.add(proj)`. Phaser's `Arcade.Group.add()` internally calls `world.enable()`, which **resets the physics body and zeroes out velocity**. Projectiles sit stationary at the muzzle forever.

**Files**:
- `client/src/scenes/LevelScene.ts` lines 609-614 (`shootProjectile`)
- `client/src/scenes/LevelScene.ts` lines 629-633 (`spawnEnemyProjectile`)

**Fix**: Swap order — call `group.add(proj)` **before** `proj.setVelocity(...)`:

```typescript
// shootProjectile — BEFORE (broken):
const proj = this.physics.add.image(muzzleX, muzzleY, 'player_bullet');
proj.setDepth(10);
proj.setData('damage', damage);
proj.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);
this.playerProjectiles.add(proj);  // ← resets velocity to 0

// shootProjectile — AFTER (fixed):
const proj = this.physics.add.image(muzzleX, muzzleY, 'player_bullet');
proj.setDepth(10);
proj.setData('damage', damage);
this.playerProjectiles.add(proj);  // ← add first (resets body)
proj.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);  // ← then set velocity
```

Same reorder for `spawnEnemyProjectile()`:
```typescript
// BEFORE (broken):
const proj = this.physics.add.image(x, y, 'enemy_bullet');
proj.setTint(color);
proj.setData('damage', damage);
proj.setVelocity(vx * ENEMY_PROJECTILE_SPEED, vy * ENEMY_PROJECTILE_SPEED);
this.enemyProjectiles.add(proj);

// AFTER (fixed):
const proj = this.physics.add.image(x, y, 'enemy_bullet');
proj.setTint(color);
proj.setData('damage', damage);
this.enemyProjectiles.add(proj);
proj.setVelocity(vx * ENEMY_PROJECTILE_SPEED, vy * ENEMY_PROJECTILE_SPEED);
```

**Risk**: Zero. Only changes execution order; no new logic.

---

## Fix 1: Remove Double Scoring on Enemy Kill

**Problem**: `handleEnemyHit()` (LevelScene.ts:860-861) adds `enemy.xp` to score, then `enemy.die()` (Enemy.ts:107) adds `enemy.xp * 10` again.

**Files**:
- `client/src/entities/Enemy.ts` lines 106-108

**Fix**: Remove `GameState.addScore(this.xp * 10)` from `die()`. Also remove the now-unused `import { GameState }` at line 12.

```typescript
// BEFORE:
die(): void {
  GameState.addScore(this.xp * 10);
}

// AFTER:
die(): void {
  // Score awarded by LevelScene.handleEnemyHit()
}
```

**Risk**: None. Floating text and scene-level scoring remain unchanged.

---

## Fix 2: Add Boss Contact Damage

**Problem**: `setupCollisions()` has `player vs enemies` overlap (line 366) but no `player vs bossGroup` overlap.

**File**: `client/src/scenes/LevelScene.ts` line 371 (end of `setupCollisions`)

**Fix**: Add overlap after the existing enemy contact damage block:

```typescript
this.physics.add.overlap(this.player, this.bossGroup, (_p, bossObj) => {
  const boss = bossObj as BossEntity;
  if (!boss.active) return;
  this.damagePlayer(2 + boss.phase);  // Phase 1=3dmg, Phase 2=4dmg, Phase 3=5dmg
});
```

**Risk**: Low. Identical pattern to enemy contact damage handler. `damagePlayer()` handles invincibility frames, shields, death.

---

## Fix 3: Boss AI System

### 3a. Extend BossConfig interface

**File**: `client/src/config/types.ts` lines 62-71

**Change**: Add 4 fields to `BossConfig`:

```typescript
export interface BossConfig {
  // ...existing fields...
  speed: number;            // movement speed
  damage: number;           // projectile/attack damage
  projectileColor: number;  // color for ranged attacks
  attackCooldownMs: number; // base cooldown between attacks
}
```

### 3b. Add combat stats to boss configs

**File**: `client/src/config/bosses.ts`

| Boss | speed | damage | projectileColor | attackCooldownMs |
|------|-------|--------|-----------------|------------------|
| BigDemon (L1) | 45 | 2 | 0xff4400 | 1800 |
| DarkKnight (L2) | 38 | 3 | 0x4466ff | 1500 |
| Necromancer (L3) | 35 | 3 | 0x8800ff | 2000 |
| ElementalFusion (L4) | 42 | 4 | 0x00ffaa | 1200 |
| TheWatcher (L5) | 48 | 5 | 0xcc33ff | 1000 |

### 3c. Add boss AI constants

**File**: `client/src/config/constants.ts` (append)

```typescript
export const BOSS_AGGRO_RANGE = 160;
export const BOSS_MELEE_RANGE = 30;
export const BOSS_CHARGE_SPEED_MULT = 2.5;
export const BOSS_CHARGE_DURATION_MS = 600;
export const BOSS_SUMMON_COOLDOWN_MS = 6000;
export const BOSS_BURST_COUNT = 5;
```

### 3d. Add `updateAI()` to BossEntity

**File**: `client/src/entities/BossEntity.ts`

Add `BossActions` interface (same shape as `EnemyActions` in Enemy.ts) and `updateAI()` method with phase-dependent behavior:

- **Phase 1**: Chase player within aggro range + single aimed projectile on cooldown
- **Phase 2**: Faster movement (25% per phase) + fan burst (5 projectiles, 90° spread) OR charge attack (60/40 random split). Cooldown scales: `attackCooldownMs / phase`
- **Phase 3** (3-phase bosses): Above + summon 2 Goblins every 6s

Private helpers: `fireAimedShot()`, `fireBurst()`, `startCharge()`

New instance state: `lastAttackAt`, `lastSummonAt`, `charging`, `chargeUntil`

Key design: boss projectiles reuse `spawnEnemyProjectile` via the actions interface, so they automatically get wall collision + player hit detection from existing overlap handlers. **No new collision wiring needed.**

### 3e. Wire boss AI in LevelScene update loop

**File**: `client/src/scenes/LevelScene.ts` lines 213-215

```typescript
// BEFORE:
if (this.boss) {
  this.updateBossBar();
}

// AFTER:
if (this.boss) {
  this.boss.updateAI(this.player, time, {
    shootProjectile: (x, y, vx, vy, dmg, color) => this.spawnEnemyProjectile(x, y, vx, vy, dmg, color),
    spawnEnemy: (type, x, y) => this.spawnSummonedEnemy(type, x, y),
    shake: (d, i) => this.shakeCamera(d, i),
  });
  this.updateBossBar();
}
```

Actions interface identical to what enemies receive at lines 204-208 — complete reuse.

---

## Implementation Order

1. **Critical Fix** — LevelScene.ts: reorder `group.add()` before `setVelocity()` — 0 risk, 2 locations
2. **Fix 1** — Enemy.ts: remove double scoring — 0 risk
3. **Fix 2** — LevelScene.ts: add boss contact overlap — low risk
4. **Fix 3a** — types.ts: extend BossConfig — additive
5. **Fix 3b** — bosses.ts: add combat values — satisfies interface
6. **Fix 3c** — constants.ts: add boss constants — additive
7. **Fix 3d** — BossEntity.ts: add updateAI — new method, existing untouched
8. **Fix 3e** — LevelScene.ts: wire boss AI in update — small change

## Files Modified (6 total)

1. `client/src/scenes/LevelScene.ts` — projectile velocity fix + boss contact damage + wire boss AI
2. `client/src/entities/Enemy.ts` — remove double scoring
3. `client/src/config/types.ts` — extend BossConfig interface
4. `client/src/config/constants.ts` — add boss AI constants
5. `client/src/config/bosses.ts` — add combat stats
6. `client/src/entities/BossEntity.ts` — add updateAI + phase behaviors

## Unchanged (verified working)

- `handleEnemyHit()` / `handleBossHit()` — collision handlers correct
- `setupCollisions()` overlap registrations — correct (projectiles just weren't moving)
- `Player.ts`, `GameState.ts`, `EnemyFactory.ts`, `BossFactory.ts` — no changes needed

## Verification

1. `npm run build` — TypeScript compiles clean
2. Shoot an enemy → projectile flies to target, enemy takes damage, dies
3. Kill an enemy → score increments once (not doubled)
4. Walk into boss → player takes contact damage
5. Boss Phase 1 → chases + fires single aimed shots
6. Boss Phase 2 → burst attacks + charge attacks
7. Boss Phase 3 (3-phase bosses) → minion spawns
8. Enemy ranged attacks → also fixed (same velocity bug)

---

*Created: 2026-02-28*
