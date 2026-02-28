# Plan: Weapon Behaviors, Animations, and Style Pass

**Spec Tasks:** TBD (no explicit spec entry yet)
**Beads ID:** `mistral-raid-hi7`
**Status:** DRAFT
**Created:** 2026-02-28
**Dependencies:** None

---

## Objective

Give each of the five weapons (Sword, Dagger, Katana, Hammer, Bomb) a distinct feel by defining clear combat behaviors, shot tuning, animations, and HUD styling, while reusing the current asset set and staying consistent with the existing projectile combat loop.

---

## Scope

**In scope:**
- Weapon-specific attack stats (damage, fire-rate, projectile count, spread, speed).
- Weapon-specific visuals (hold offsets, scale, recoil/swing animation, muzzle flash color/size).
- Bomb explosion behavior with AoE damage and VFX.
- HUD and Inventory updates to display weapon identity and stats clearly.
- Audio variations per weapon.

**Out of scope:**
- New weapon items beyond the current five.
- New enemy or boss mechanics.
- New art assets beyond the existing 0x72 frames (unless explicitly added later).

---

## Weapon Spec (Draft)

| Weapon | Role | Damage Mult | Fire Rate Mult | Projectile | Special | Visual Notes |
|--------|------|-------------|----------------|------------|---------|--------------|
| Sword | Balanced baseline | 1.0 | 1.0 | 1x straight | None | Small slash recoil, cool-blue flash |
| Dagger | Fast, low damage | 0.7 | 1.4 | 1x straight (tight) | Optional 10% crit or +1 spread on multishot | Short flick, tighter hold offset |
| Katana | High burst | 1.6 | 0.9 | 1x straight | Optional 1 pierce on first hit | Longer swing, red flash |
| Hammer | Heavy control | 2.2 | 0.6 | 1x straight (slower) | Bonus knockback + small shockwave | Big swing, orange flash, extra shake |
| Bomb | AoE burst | 2.8 | 0.5 | Thrown slow | Explodes in radius after fuse or on hit | Fuse animation, green flash |

Numbers are starting points for tuning, not final.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `client/src/config/types.ts` | MODIFY | Add `WeaponConfig` (or similar) and stat types for behavior/animation/hud styling. |
| `client/src/config/weapons.ts` | CREATE | Central map of weapon behavior and visual settings keyed by `ItemType`. |
| `client/src/config/items.ts` | MODIFY | Link weapon items to weapon configs (or re-export lookups). |
| `client/src/core/GameState.ts` | MODIFY | Add helpers to get effective weapon stats (damage, fire rate). |
| `client/src/entities/Player.ts` | MODIFY | Apply per-weapon hold offsets, scale, rotation offsets, and attack animation hook. |
| `client/src/scenes/LevelScene.ts` | MODIFY | Use weapon stats in firing logic; add bomb AoE, shockwave, and hit helpers. |
| `client/src/scenes/BootScene.ts` | MODIFY | Register bomb fuse animation from `bomb_f0..f2`. |
| `client/src/scenes/InventoryScene.ts` | MODIFY | Show weapon stat summary in description panel. |
| `client/src/systems/AudioManager.ts` | MODIFY | Add weapon-specific shot and explosion sounds. |
| `client/src/config/constants.ts` | MODIFY | Add default weapon tuning constants (explosion radius, knockback). |

---

## Implementation Steps

### Step 1: Define Weapon Config + Helpers

**Files:**
- `client/src/config/types.ts`
- `client/src/config/weapons.ts`
- `client/src/config/items.ts`
- `client/src/core/GameState.ts`

**What:** Introduce a dedicated weapon config map that drives behavior, animation, and UI styling. Keep it keyed by `ItemType` to avoid new ID systems.

**Key details:**
- `WeaponConfig` should include `damageMult`, `fireRateMult`, `projectileCount`, `spread`, `projectileSpeed`, `knockback`, `muzzleFlashColor`, `muzzleFlashSize`, `shakeIntensity`, `holdOffset`, `rotationOffset`, `scale`, and optional `explosion` settings.
- Export a `getWeaponConfig(type)` helper and `getEffectiveWeaponDamage` / `getEffectiveFireRate` functions.
- Keep `ITEM_CONFIGS` for loot/inventory identity; use weapon config for combat behavior.

**Acceptance criteria:**
- [ ] Weapon configs exist in a single source of truth.
- [ ] All five weapons have full stat coverage in config.
- [ ] `GameState` exposes helpers for effective damage and fire rate.

---

### Step 2: Weapon-Driven Firing Logic

**File:** `client/src/scenes/LevelScene.ts`

**What:** Replace fixed projectile behavior with weapon-config-driven logic, while preserving the existing projectile pipeline and overlap handling.

**Key details:**
- Compute cooldown using `effectiveFireRate` per weapon.
- Use `projectileCount` + `spread` to spawn multiple shots.
- Apply per-weapon `projectileSpeed` and optional `projectileKey` (defaults to `player_bullet`).
- Add a shared `applyEnemyDamage()` helper for projectile and AoE damage to avoid logic duplication.

**Acceptance criteria:**
- [ ] Fire rate changes when weapon changes.
- [ ] Damage uses weapon multiplier and player base damage.
- [ ] Multi-shot potion still works (angles composed with weapon spread).

---

### Step 3: Weapon Animation + Hold Styling

**Files:**
- `client/src/entities/Player.ts`
- `client/src/scenes/BootScene.ts`

**What:** Make the weapon sprite respond to the weapon config for positioning and attack animation.

**Key details:**
- Store `weaponHoldOffset`, `rotationOffset`, and `scale` per weapon.
- Add `playWeaponAttack()` on `Player` that performs a quick swing/recoil tween based on weapon config.
- Convert `weaponSprite` to a `Phaser.GameObjects.Sprite` to allow playing the bomb fuse animation (`bomb_f0..f2`).

**Acceptance criteria:**
- [ ] Sword offset no longer appears floating (addresses visual bug report).
- [ ] Each weapon has a distinct swing or recoil feel on fire.
- [ ] Bomb shows a simple looping fuse animation when equipped or thrown.

---

### Step 4: Bomb AoE + Hammer Shockwave

**File:** `client/src/scenes/LevelScene.ts`

**What:** Implement special behavior for bomb and hammer while keeping other weapons as straight-shot variants.

**Key details:**
- Bombs: spawn a slow projectile with a short fuse; explode on wall hit or fuse timeout. Explosion applies AoE damage to enemies and bosses, plays a ring VFX, and shakes camera.
- Hammer: add extra knockback on hit and a small radial shockwave VFX (no extra damage).
- Use `applyEnemyDamage()` to keep scoring/loot logic consistent with normal hits.

**Acceptance criteria:**
- [ ] Bombs visibly explode and damage multiple enemies in radius.
- [ ] Hammer pushes enemies noticeably farther than other weapons.

---

### Step 5: HUD + Inventory Readability

**Files:**
- `client/src/scenes/LevelScene.ts`
- `client/src/scenes/InventoryScene.ts`

**What:** Make the equipped weapon identity and stats easier to read and more visually distinct.

**Key details:**
- Add weapon icon near the HUD label or tint label by weapon color.
- Expand inventory description to show a concise stat line (damage, rate, special).

**Acceptance criteria:**
- [ ] Weapon label is more legible and visually associated with the equipped weapon.
- [ ] Inventory hover shows meaningful weapon stats.

---

### Step 6: Weapon Audio Variants

**File:** `client/src/systems/AudioManager.ts`

**What:** Provide distinct audio feedback per weapon without adding external assets.

**Key details:**
- Add `weaponShoot(type)` and `weaponExplode()` helpers that vary oscillator type, pitch, and duration.
- Call from `shootProjectile` and bomb explosion.

**Acceptance criteria:**
- [ ] Each weapon has a recognizable audio profile.
- [ ] Bomb explosion is distinct from normal shots.

---

## Testing / Verification

1. Manual: equip each weapon and verify fire rate, damage feel, and visuals match the weapon spec.
2. Manual: detonate bomb near multiple enemies and confirm AoE damage and loot/score behavior.
3. Manual: compare hammer knockback vs. sword knockback.
4. UI check: weapon HUD label and inventory stats update correctly on swap.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Weapon tuning feels unbalanced | Medium | Keep all values in config for quick iteration, add a small balance table in docs. |
| Bomb AoE bypasses normal score/loot logic | Medium | Centralize damage in `applyEnemyDamage()` and reuse from projectiles and explosions. |
| Animation tweaks cause weapon jitter | Low | Clamp offsets and avoid per-frame tweens; only animate on fire. |

---

## Notes

- Use existing 0x72 assets (`weapon_*`, `bomb_f0..f2`) to avoid new art dependencies.
- This plan intentionally keeps melee as projectile-based for now to reduce system churn. If true melee is desired, create a follow-up plan that replaces projectile hits with timed hitboxes.
