# Game Balance Guide

This guide documents the game’s current balance knobs, where they live, and what to adjust first when tuning.

## Characters (`client/src/config/characters.ts`)

| Character | HP | Speed | Damage | Fire Rate (ms) | Role | Source |
|---|---:|---:|---:|---:|---|---|
| Knight | 6 | 110 | 1.0 | 280 | Baseline all-rounder, used as balance anchor | `client/src/config/characters.ts:4` |
| Rogue | 4 | 145 | 0.8 | 200 | High mobility + high cadence, low survivability | `client/src/config/characters.ts:13` |
| Mage | 3 | 100 | 2.0 | 420 | Burst damage, low HP and slower cadence | `client/src/config/characters.ts:22` |
| Paladin | 8 | 88 | 1.5 | 360 | Tank profile with slower movement | `client/src/config/characters.ts:31` |

### Character rationale

- HP spread (3→8) creates clear risk tiers while preserving a “safe” default (`Knight`).
- Speed spread (88→145) ensures movement skill has visible impact on difficulty.
- Damage and fire rate are intentionally inverse for class identity (burst vs cadence).

## Enemies (`client/src/config/enemies.ts`)

| Enemy | HP | Speed | Damage | XP | Behavior | Scale | Unlock Level(s) |
|---|---:|---:|---:|---:|---|---:|---|
| Goblin | 4 | 58 | 1 | 5 | `MeleeChase` | 1.0 | 1, 2 |
| Imp | 3 | 75 | 1 | 6 | `RangedShoot` | 1.0 | 1, 2 |
| Chort | 6 | 68 | 2 | 9 | `MeleeChase` | 1.0 | 2, 3 |
| BigZombie | 14 | 38 | 3 | 16 | `MeleeChase` | 1.0 | 2, 3, 4 |
| IceZombie | 8 | 30 | 2 | 13 | `Exploder` | 1.0 | 3 |
| Skelet | 6 | 62 | 2 | 11 | `SplitOnDeath` | 1.0 | 3, 4 |
| MaskedOrc | 16 | 52 | 4 | 22 | `Shielded` | 1.0 | 4, 5 |
| BigDemon | 22 | 48 | 5 | 32 | `RangedShoot` | 1.2 | 4, 5 |
| Necromancer | 20 | 42 | 3 | 28 | `Summoner` | 1.0 | 5 |
| OrcArmored | 28 | 44 | 5 | 38 | `Shielded` | 1.1 | 5 |

- Sources: `client/src/config/enemies.ts:3`, `client/src/config/enemies.ts:136`
- Progression rationale: enemy HP scales from 3–4 at entry tiers to 20–28 late-game, while damage scales from 1 to 5 for increased punish windows.

## Bosses (`client/src/config/bosses.ts`)

| Boss | HP | Phases | Speed | Damage | Attack Cooldown (ms) | Notes |
|---|---:|---:|---:|---:|---:|---|
| THE DEMON LORD | 80 | 2 | 45 | 2 | 1800 | Intro boss, forgiving cadence |
| THE DARK KNIGHT | 130 | 2 | 38 | 3 | 1500 | Heavier pressure, modest speed |
| THE NECROMANCER | 170 | 3 | 35 | 3 | 2000 | Longer fights, mechanic-driven |
| ELEMENTAL FUSION | 220 | 3 | 42 | 4 | 1200 | Aggressive mid/late pacing |
| THE WATCHER | 320 | 3 | 48 | 5 | 1000 | Endgame pressure + high uptime |

- Source: `client/src/config/bosses.ts:3`
- Scaling rationale: HP steps 80 → 320 across 5 tiers to lengthen boss phases while preserving a noticeable damage escalation.

## Weapons (`client/src/config/weapons.ts`)

Relative DPS index is `damageMult × fireRateMult` (Sword baseline = 1.00).

| Weapon | Damage Mult | Fire Rate Mult | Relative DPS | Projectile Speed | Design Tradeoff | Source |
|---|---:|---:|---:|---:|---|---|
| Sword | 1.0 | 1.0 | 1.00 | 260 | Baseline reference | `client/src/config/weapons.ts:4` |
| Dagger | 0.7 | 1.4 | 0.98 | 380 | Fast precision; low per-hit impact | `client/src/config/weapons.ts:22` |
| Katana | 1.6 | 0.9 | 1.44 | 300 | High DPS + pierce; moderate cadence | `client/src/config/weapons.ts:41` |
| Hammer | 2.2 | 0.6 | 1.32 | 210 | Heavy burst, high knockback, slower cycle | `client/src/config/weapons.ts:60` |
| Bomb | 2.8 | 0.5 | 1.40 | 180 | Slow cadence with AoE payoff | `client/src/config/weapons.ts:78` |

### DPS normalization notes

- Sword is the “feel” baseline for balance sanity checks.
- Dagger stays near parity DPS but shifts power into movement and accuracy skill.
- Hammer/Bomb trade cadence for impact to support crowd-control play patterns.

## Combat Constants (`client/src/config/constants.ts`)

| Constant | Value | Suggested Safe Range | Why It Matters | Source |
|---|---:|---|---|---|
| `INTERNAL_WIDTH` | 320 | 320 (fixed) | Internal gameplay resolution | `client/src/config/constants.ts:1` |
| `INTERNAL_HEIGHT` | 180 | 180 (fixed) | Internal gameplay resolution | `client/src/config/constants.ts:2` |
| `DISPLAY_WIDTH` | 1280 | 1280 (fixed) | Scaled render output | `client/src/config/constants.ts:3` |
| `DISPLAY_HEIGHT` | 720 | 720 (fixed) | Scaled render output | `client/src/config/constants.ts:4` |
| `ZOOM` | 4 | 4 (fixed) | Pixel-perfect upscale factor | `client/src/config/constants.ts:5` |
| `TILE_SIZE` | 16 | 16 (fixed) | Core spatial grid unit | `client/src/config/constants.ts:7` |
| `PLAYER_BODY_WIDTH` | 10 | 8–12 | Hitbox width fairness | `client/src/config/constants.ts:9` |
| `PLAYER_BODY_HEIGHT` | 12 | 10–14 | Hitbox height fairness | `client/src/config/constants.ts:10` |
| `PLAYER_BODY_OFFSET_X` | 3 | 2–4 | Sprite/hitbox alignment | `client/src/config/constants.ts:11` |
| `PLAYER_BODY_OFFSET_Y` | 4 | 3–5 | Sprite/hitbox alignment | `client/src/config/constants.ts:12` |
| `DASH_DISTANCE` | 44 | 36–56 | Core escape distance | `client/src/config/constants.ts:14` |
| `DASH_COOLDOWN_MS` | 1500 | 1200–2200 | Dash availability pressure | `client/src/config/constants.ts:15` |
| `DASH_INVINCIBLE_MS` | 180 | 120–260 | Dodge forgiveness window | `client/src/config/constants.ts:16` |
| `DASH_MAX_CHARGES` | 7 | 4–8 | Sustained mobility budget | `client/src/config/constants.ts:17` |
| `INVINCIBLE_MS` | 700 | 450–900 | Post-hit recovery protection | `client/src/config/constants.ts:19` |
| `PROJECTILE_SPEED` | 160 | 140–220 | Baseline ranged feel | `client/src/config/constants.ts:21` |
| `PROJECTILE_LIFETIME_MS` | 3000 | 1800–3600 | Projectile persistence density | `client/src/config/constants.ts:22` |
| `PROJECTILE_SIZE` | 6 | 4–8 | Hit registration readability | `client/src/config/constants.ts:23` |
| `SHIELD_DURATION_MS` | 1200 | 800–1500 | Defensive uptime | `client/src/config/constants.ts:25` |
| `SHIELD_COOLDOWN_MS` | 1800 | 1400–2600 | Defensive pacing | `client/src/config/constants.ts:26` |
| `ENEMY_AGGRO_RANGE` | 110 | 90–150 | Encounter activation distance | `client/src/config/constants.ts:28` |
| `ENEMY_RANGED_RANGE` | 85 | 70–120 | Ranged threat envelope | `client/src/config/constants.ts:29` |
| `ENEMY_RANGED_COOLDOWN_MS` | 1600 | 1100–2400 | Ranged attack pressure | `client/src/config/constants.ts:30` |
| `ENEMY_TELEPORT_COOLDOWN_MS` | 2800 | 2200–4200 | Teleporter burst frequency | `client/src/config/constants.ts:31` |
| `ENEMY_SUMMON_COOLDOWN_MS` | 4500 | 3200–6500 | Summoner spawn cadence | `client/src/config/constants.ts:32` |
| `ENEMY_EXPLODE_RANGE` | 18 | 14–24 | Exploder punishment radius | `client/src/config/constants.ts:33` |
| `ENEMY_PATROL_SPEED` | 18 | 14–26 | Ambient threat movement | `client/src/config/constants.ts:34` |
| `ENEMY_PROJECTILE_SPEED` | 85 | 70–120 | Enemy shot dodgeability | `client/src/config/constants.ts:36` |
| `ENEMY_PROJECTILE_LIFETIME_MS` | 2800 | 1800–3200 | Enemy projectile map clutter | `client/src/config/constants.ts:37` |
| `ROOM_WIDTH_MIN` | 5 | 4–7 | Room size floor | `client/src/config/constants.ts:39` |
| `ROOM_WIDTH_MAX` | 12 | 10–16 | Room size ceiling | `client/src/config/constants.ts:40` |
| `ROOM_HEIGHT_MIN` | 4 | 3–6 | Room size floor | `client/src/config/constants.ts:41` |
| `ROOM_HEIGHT_MAX` | 9 | 8–12 | Room size ceiling | `client/src/config/constants.ts:42` |
| `ROOM_PADDING` | 2 | 1–4 | Room overlap prevention | `client/src/config/constants.ts:43` |
| `ROOM_ATTEMPT_MULT` | 40 | 30–70 | Generation retry budget | `client/src/config/constants.ts:44` |
| `EXTRA_CORRIDOR_PERCENT` | 0.25 | 0.1–0.5 | Loop density in maps | `client/src/config/constants.ts:45` |
| `TREASURE_ROOM_CHANCE` | 0.12 | 0.05–0.2 | Reward frequency | `client/src/config/constants.ts:46` |
| `SECRET_ROOM_CHANCE` | 0.08 | 0.03–0.15 | Discovery pacing | `client/src/config/constants.ts:47` |
| `ITEM_SPAWN_CHANCE` | 0.4 | 0.2–0.6 | Consumable economy | `client/src/config/constants.ts:48` |
| `TORCH_RADIUS` | 42 | 32–56 | Ambient visibility | `client/src/config/constants.ts:50` |
| `PLAYER_LIGHT_RADIUS` | 55 | 45–70 | Player readability under fog | `client/src/config/constants.ts:51` |
| `STAIRS_OFFSET_X` | 2 | 1–3 | Exit placement consistency | `client/src/config/constants.ts:53` |
| `BOSS_AGGRO_RANGE` | 160 | 130–220 | Boss engagement distance | `client/src/config/constants.ts:55` |
| `BOSS_MELEE_RANGE` | 30 | 24–40 | Boss contact threat radius | `client/src/config/constants.ts:56` |
| `BOSS_CHARGE_SPEED_MULT` | 2.5 | 1.8–3.2 | Burst threat intensity | `client/src/config/constants.ts:57` |
| `BOSS_CHARGE_DURATION_MS` | 600 | 350–900 | Charge exposure window | `client/src/config/constants.ts:58` |
| `BOSS_SUMMON_COOLDOWN_MS` | 6000 | 4500–9000 | Boss add-spawn cadence | `client/src/config/constants.ts:59` |
| `BOSS_BURST_COUNT` | 5 | 3–8 | Multi-shot pressure volume | `client/src/config/constants.ts:60` |

## Difficulty Scaling (`client/src/systems/DifficultyManager.ts`)

| Preset | Enemy HP | Player Damage | Boss Damage | Boss HP | Boss AI Throttle | Enemy Speed | Source |
|---|---:|---:|---:|---:|---:|---:|---|
| Easy | 0.7 | 1.2 | 0.8 | 1.0 | 180 ms | 0.9 | `client/src/systems/DifficultyManager.ts:22` |
| Medium | 1.0 | 1.0 | 1.0 | 1.0 | 0 ms | 1.0 | `client/src/systems/DifficultyManager.ts:30` |
| Hard | 1.3 | 0.9 | 1.2 | 1.4 | 0 ms | 1.15 | `client/src/systems/DifficultyManager.ts:38` |

### Difficulty rationale

- Easy reduces incoming pressure and increases player throughput.
- Medium is identity baseline for balancing content updates.
- Hard compounds survivability and pacing pressure primarily through HP/damage multipliers.

## Critical Hits (`client/src/systems/CritSystem.ts`)

| Parameter | Value | Source |
|---|---:|---|
| `CRIT_CAP` | 0.4 | `client/src/systems/CritSystem.ts:4` |
| `HIT_COUNTER_CRIT_THRESHOLD` | 10 | `client/src/systems/CritSystem.ts:5` |
| `HIT_COUNTER_CRIT_GAIN` | 0.02 | `client/src/systems/CritSystem.ts:6` |

### Crit curve expectations

- Starting from 5% crit chance, each 10-hit streak grants +2% until 40% cap.
- 5% → 15% requires 50 hits; 5% → 40% requires 180 hits.
- This rewards sustained uptime without allowing runaway RNG spikes.

## Tuning Guide

### Start with these knobs first

1. Difficulty preset multipliers (`enemyHpMult`, `playerDamageMult`, `bossHpMult`)
2. Boss cadence (`attackCooldownMs`, `bossAiThrottleMs`)
3. Defensive affordances (`DASH_COOLDOWN_MS`, `DASH_INVINCIBLE_MS`, `SHIELD_COOLDOWN_MS`)

### Common issues and fastest fixes

- **Boss too hard:** lower `bossHpMult` or increase `bossAiThrottleMs` on target preset.
- **Boss too passive:** lower `attackCooldownMs` for current boss and/or increase `bossDamageMult`.
- **Player dies too quickly:** increase `DASH_INVINCIBLE_MS` or decrease `bossDamageMult`.
- **Encounters feel slow:** reduce enemy HP (`enemyHpMult`) before increasing player damage.
- **Ranged enemies feel unfair:** raise `ENEMY_RANGED_COOLDOWN_MS` or lower `ENEMY_PROJECTILE_SPEED`.

### Process recommendations

- Tune one subsystem at a time (difficulty, then bosses, then micro-constants).
- Validate with telemetry and subjective feel; avoid multi-knob changes in one pass.
- Keep medium preset as control while iterating easy/hard accessibility bands.
