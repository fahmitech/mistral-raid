# MISTRAL RAID — Interaction & Feel Guide (Dungeon Mode)
## Behavioral spec aligned with LevelScene

This guide describes how the player and combat systems feel in the current
LevelScene dungeon crawler. It is sprite-based and uses the pixel-art
presentation described in `docs/reference/ui-layout.md`.

Arena AI interactions (DevConsole, analyzing overlay, AI mechanics) are part
of the unused ArenaScene stack; see `docs/reference/game-behavior.md`.

---

## 1. Movement and Navigation

- Movement: WASD or arrow keys
- Speed: class-dependent (see `docs/reference/characters.md`)
- Collision: walls block movement; doors and stairs are passable when unlocked
- Camera: follows player, clamped to dungeon bounds

**Feel goals:**
- Responsive directional input
- Tight movement inside narrow corridors
- Immediate stop when input is released

---

## 2. Primary Attack (Left Click)

- Fires the current weapon toward the cursor
- Rate limit: `SHOOT_CD = 280ms`
- Projectile speed: `PROJ_SPEED = 160`
- Projectile TTL: `PROJ_TTL = 3000ms`
- Enemy hit: applies damage + knockback, destroys projectile

**Feedback:**
- Small muzzle flash and sound
- Projectile trail (subtle)
- Enemy hit flashes + particles

---

## 3. Dash (Space)

- Instant teleport in facing direction
- Distance: 44px
- Cooldown: 1500ms
- Invulnerability: 180ms

**Feedback:**
- Cyan afterimage trail
- Short dash sound

---

## 4. Shield (Right Click)

- Activates a temporary shield that blocks one hit
- Duration: 1200ms
- Cooldown: 1800ms

**Feedback:**
- Shield ring around player
- Shield break VFX on hit

---

## 5. Weapon Swap (Q)

- Cycles weapon slot order: Sword -> Dagger -> Katana -> Hammer -> Bomb
- Only switches if the weapon is in inventory

---

## 6. Potion Use (R)

- Consumes the first available healing item (in order: FlaskRed -> FlaskBigRed -> FlaskGreen)
- FlaskBigRed heals 3 HP; FlaskRed / FlaskGreen heal 1 HP
- Removes item from inventory

---

## 7. Interaction (E)

- Opens chests (loot drops 2-3 items)
- Takes stairs to next level when available

---

## 8. Inventory (I)

- Opens inventory scene
- Allows inspection of items and current loadout

---

## 9. Pause (ESC)

- Opens pause menu
- Options and Exit to Menu

---

## 10. Damage and Invincibility

- On hit, player becomes invincible for `INVIC_DUR = 700ms`
- Player flashes during invincibility
- Hearts represent HP: 1 heart = 2 HP

**Feedback:**
- Red particle burst
- Screen shake (light)
- HP hearts decrement immediately

---

## 11. Enemy Combat Feedback

- Enemies flash on hit
- Kill: coins and XP awarded; double score for enemy death
- Shielded enemies block frontal damage until shield broken

---

## 12. Boss Fights

- Boss rooms trigger a distinct encounter
- On boss death: slow-motion effect, score bonus, level completion
- Stairs appear after boss defeat

---

## 13. Loot and Economy

- Coins: +5 score per coin pickup
- Item drops follow the weighted table in `docs/reference/config-reference.md`
- Chests: always drop 2-3 items

---

## 14. UI Feedback (Dungeon HUD)

- Hearts (top-left): current HP
- Coins counter and score
- Current weapon indicator
- Boss HP bar when in boss room

---

## 15. Audio Feel

- Web Audio oscillator SFX (no external files)
- Each major action has a short cue (shoot, hit, dash, pickup, boss death)

---

*Last updated: 2026-02-28*
