# Plan: Player Visibility, Boss Crash & Projectile Visual Fixes

## Context

Three related bugs were found after the initial combat plan was implemented:

1. **Player disappears** — sprite becomes invisible while physics/input still works (clock mismatch)
2. **Boss crash** — `TypeError: Cannot read properties of undefined (reading 'setVelocity')` in
   `BossEntity.updateAI` — physics body is undefined when boss first tries to move
3. **Wrong projectile visual** — player fires yellow circles regardless of equipped weapon; a sword
   should not launch a yellow orb

These fixes touch `LevelScene.ts`, `BossEntity.ts`, `BossFactory.ts`, and `GameState.ts` only.

---

## Bug 1 — Player Disappears (Clock Mismatch)

### Root Cause

`player.invincibleUntil` is a single number set and read by **two different time sources**:

| Call site | Time used | Clock type |
|-----------|-----------|------------|
| `damagePlayer()` (LevelScene.ts:1123) | `this.time.now` | Scene time — pauses with scene; 0.25× after boss death |
| `tryShield()` (LevelScene.ts:700) | `this.time.now` | Scene time |
| `tryDash()` (LevelScene.ts:658) | `time` from `update()` | Global clock — never pauses or slows |
| `updateBlink()` (LevelScene.ts:196) | `time` from `update()` | Global clock |

When these diverge (boss death slow-mo, or menu pause/resume):
1. Invincibility set with scene time, checked with global time → blink never shows, player appears
   to take damage with no feedback.
2. After dashing in slow-mo, `invincibleUntil = globalTime + 180 ≈ 15180`. Every future call to
   `damagePlayer(sceneTime ≈ 500)` checks `isInvincible(500)` → `500 < 15180` → TRUE forever →
   player is permanently invincible from damage.
3. `tryDash()` calls `setAlpha(0.5)` then a `delayedCall(DASH_INVINCIBLE_MS, setAlpha(1))`. The
   `setAlpha(0.5)` is immediately overridden by `updateBlink` on the same frame (dead code). The
   `delayedCall` uses scene time (fires 4× late after boss death). Alpha management is split across
   two uncoordinated systems, causing invisible-player edge cases on menu resume.

### Fixes

**Fix 1a — Add `lastUpdateTime` field, normalize all clocks to global time**

File: [LevelScene.ts](client/src/scenes/LevelScene.ts)

Add a single `private lastUpdateTime = 0` field (with the other private fields ~line 50). Update it
at the top of `update()`:

```typescript
update(time: number): void {
    this.lastUpdateTime = time;  // ← add
    this.handleInput(time);
    ...
}
```

Replace `this.time.now` with `this.lastUpdateTime` in event callbacks that lack `time`:
- `tryShield()` line 700: `const time = this.lastUpdateTime;`
- All `damagePlayer()` call sites in `setupCollisions()` callbacks (lines 360-371): pass
  `this.lastUpdateTime` as second argument.

Change `damagePlayer` signature from `(amount: number)` to `(amount: number, time: number)` and
remove `const time = this.time.now` inside it.

**Fix 1b — Remove dead alpha code from `tryDash()`**

File: [LevelScene.ts](client/src/scenes/LevelScene.ts) lines 678-679

```typescript
// REMOVE both lines:
this.player.setAlpha(0.5);
this.time.delayedCall(DASH_INVINCIBLE_MS, () => this.player.setAlpha(1));
```

`updateBlink()` already owns all alpha management on the player sprite every frame. These lines are
dead code and the `delayedCall` creates a competing alpha setter on scene time.

**Fix 1c — Defensive reset on scene resume**

File: [LevelScene.ts](client/src/scenes/LevelScene.ts) resume handler (line ~111)

```typescript
this.events.on('resume', () => {
    this.options = SaveSystem.loadOptions();
    AudioManager.get().setOptions(this.options);
    if (this.player) {
        this.player.setAlpha(1);
        this.player.invincibleUntil = 0;
    }
});
```

Clears any stale invincibility state when returning from Inventory or Pause scenes. The minor
game-feel cost (invincibility frames lost on menu close) is acceptable; players expect a clean
state on return.

---

## Bug 2 — Boss Crash: `setVelocity` on Undefined Body

### Root Cause

`BossFactory.spawnBoss()` (BossFactory.ts:15-19):

```typescript
const boss = new BossEntity(scene, x, y, config);
scene.add.existing(boss);
scene.physics.add.existing(boss);   // ← creates ArcadeBody
boss.setCollideWorldBounds(true);
group.add(boss);                    // ← Arcade Group add() calls world.enable() again,
                                    //   which in some Phaser builds resets/removes the body
```

`Phaser.Physics.Arcade.Group.add()` calls `addChildCallback`, which calls `world.enableBody()`.
Depending on the Phaser build, this can reset the existing body to `null`/`undefined`, leaving the
boss with no physics body. On the next frame, `updateAI()` calls `this.setVelocity()`, which
internally accesses `this.body`, crashing with:

```
TypeError: Cannot read properties of undefined (reading 'setVelocity')
at BossEntity.updateAI (BossEntity.ts:49:12)
```

This is the **same double-enable bug** identified in the combat plan for projectile velocity. The
pattern `physics.add.existing(obj)` followed by `group.add(obj)` resets the physics body.

### Fixes

**Fix 2a — Correct initialization order in BossFactory**

File: [BossFactory.ts](client/src/core/BossFactory.ts)

Remove the explicit `scene.physics.add.existing(boss)` call. Let `group.add(boss)` handle physics
enablement (an Arcade Group's `add()` enables physics on the child if needed). Apply
`setCollideWorldBounds` AFTER `group.add()`:

```typescript
static spawnBoss(scene, type, x, y, group): BossEntity {
    const config = BOSS_CONFIGS[type];
    const boss = new BossEntity(scene, x, y, config);
    scene.add.existing(boss);
    group.add(boss);                  // ← enables physics via Arcade Group
    boss.setCollideWorldBounds(true); // ← body now valid, apply settings
    return boss;
}
```

**Fix 2b — Defensive body guard in `BossEntity.updateAI()`**

File: [BossEntity.ts](client/src/entities/BossEntity.ts) line 37

Add at the very top of `updateAI()`, mirroring the same pattern used for the player
(`handleInput()` line 527):

```typescript
updateAI(player: Player, time: number, actions: BossActions): void {
    if (!this.body) return;  // ← guard: body not yet initialized or entity being destroyed
    ...
}
```

This is a belt-and-suspenders safety net. Fix 2a removes the root cause; Fix 2b ensures no crash
even if any future code path leaves the body temporarily invalid.

---

## Bug 3 — Projectile Visual Does Not Match Equipped Weapon

### Root Cause

`createBulletTextures()` (LevelScene.ts:227-234) generates a single `player_bullet` texture:

```typescript
gfx.fillStyle(0xffcc00, 1);  // ← hardcoded yellow, no weapon awareness
gfx.fillCircle(PROJECTILE_SIZE / 2, PROJECTILE_SIZE / 2, PROJECTILE_SIZE / 2);
```

`shootProjectile()` always uses this `'player_bullet'` texture regardless of which weapon is
equipped. A sword-wielding player fires the same yellow orb as a bomb-wielding one.

`setTint()` in Phaser multiplies the texture's RGB channels by the tint color. The current yellow
base (`0xffcc00`) makes all tints appear yellow-shifted; changing the base to white (`0xffffff`)
allows tint to show the true weapon color.

### Fix

**Fix 3a — Change `player_bullet` base texture to white**

File: [LevelScene.ts](client/src/scenes/LevelScene.ts) line 230

```typescript
// BEFORE:
gfx.fillStyle(0xffcc00, 1);

// AFTER:
gfx.fillStyle(0xffffff, 1);
```

**Fix 3b — Add `getWeaponProjectileColor()` to GameState.ts**

File: [GameState.ts](client/src/core/GameState.ts) — append after `getWeaponDamageMultiplier`

```typescript
export const getWeaponProjectileColor = (weapon: ItemType): number => {
    switch (weapon) {
        case ItemType.WeaponSword:   return 0x00ccff; // cyan  — classic sword shine
        case ItemType.WeaponDagger:  return 0xdddddd; // silver — fast, thin
        case ItemType.WeaponKatana:  return 0xff4444; // red   — slashing
        case ItemType.WeaponHammer:  return 0xff8800; // orange — heavy impact
        case ItemType.WeaponBomb:    return 0x44ff88; // green  — explosive
        default:                     return 0xffffff; // white fallback
    }
};
```

**Fix 3c — Apply tint in `shootProjectile()`**

File: [LevelScene.ts](client/src/scenes/LevelScene.ts) inside `shootProjectile()` (line ~609)

After `this.playerProjectiles.add(proj)`, apply weapon color tint:

```typescript
this.playerProjectiles.add(proj);
proj.setTint(getWeaponProjectileColor(state.equippedWeapon));  // ← add this line
proj.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);
```

Note: `getWeaponProjectileColor` must be imported at the top of LevelScene.ts alongside
`getWeaponDamageMultiplier` (already imported at line 29).

---

## Files Modified (4 total)

| File | Changes |
|------|---------|
| [LevelScene.ts](client/src/scenes/LevelScene.ts) | Fix 1a–1c: clock normalization, dead alpha removal, resume reset; Fix 3a/3c: white bullet base, weapon tint |
| [BossFactory.ts](client/src/core/BossFactory.ts) | Fix 2a: remove double physics enable, correct init order |
| [BossEntity.ts](client/src/entities/BossEntity.ts) | Fix 2b: `if (!this.body) return` guard in `updateAI` |
| [GameState.ts](client/src/core/GameState.ts) | Fix 3b: add `getWeaponProjectileColor()` helper |

---

## Implementation Order

1. **GameState.ts** — add `getWeaponProjectileColor()` after `getWeaponDamageMultiplier`
2. **BossFactory.ts** — remove `scene.physics.add.existing(boss)`, move `setCollideWorldBounds`
   after `group.add(boss)`
3. **BossEntity.ts** — add `if (!this.body) return;` at top of `updateAI()`
4. **LevelScene.ts** — add `private lastUpdateTime = 0` field
5. **LevelScene.ts** — add `this.lastUpdateTime = time;` at top of `update()`
6. **LevelScene.ts** — change `damagePlayer` to accept `time` param, update 3 call sites
7. **LevelScene.ts** — change `tryShield()` to use `this.lastUpdateTime`
8. **LevelScene.ts** — remove `setAlpha(0.5)` + `delayedCall` from `tryDash()`
9. **LevelScene.ts** — add resume handler defensive reset
10. **LevelScene.ts** — change `player_bullet` base color to `0xffffff`
11. **LevelScene.ts** — add `getWeaponProjectileColor` import + `proj.setTint(...)` in
    `shootProjectile()`

---

## What is NOT changed

- `updateBlink()` — correct, no changes needed
- `setInvincible()` / `isInvincible()` in `Player.ts` — correct
- Boss death timeScale tween — no changes needed
- Enemy physics initialization in `EnemyFactory` / `spawnSummonedEnemy` — separate issue, same
  double-enable pattern but enemies don't call `setVelocity` in their constructor so no crash
- `LightingSystem`, `AudioManager`, `ScoreSystem` — untouched

---

## Verification

1. `npm run build` — TypeScript compiles clean, no new errors
2. **Bug 1**: Take damage → player blinks for 700ms → stops blinking → alpha = 1
3. **Bug 1**: Kill boss (triggers slow-mo) → take damage → blink appears and expires correctly
4. **Bug 1**: Dash during slow-mo → open inventory → close → player fully visible
5. **Bug 1**: Rapid damage in slow-mo → player correctly takes multiple hits (no permanent immunity)
6. **Bug 2**: Enter boss room → boss spawns, moves, fires → no crash
7. **Bug 2**: Boss charges player → velocity changes work without error
8. **Bug 3**: Equip Sword → fire → **cyan** projectile
9. **Bug 3**: Equip Dagger → fire → **silver** projectile
10. **Bug 3**: Equip Katana → fire → **red** projectile
11. **Bug 3**: Equip Hammer → fire → **orange** projectile
12. **Bug 3**: Equip Bomb → fire → **green** projectile

---

*Created: 2026-02-28 | Updated: 2026-02-28*
