# Mechanic Types — Behavior Specification

> Describes all 6 "Lego Brick" mechanic types that the AI can generate.
> Each mechanic is instantiated from a JSON config and runs independently in the game world.

---

## Architecture: Lego Brick Pattern

The AI generates a JSON array of 2–3 mechanic configs. A factory function (MechanicInterpreter) maps each config's `type` field to a pre-built class via a switch statement:

```
"projectile_spawner"  → ProjectileSpawner class
"hazard_zone"         → HazardZoneSpawner class
"laser_beam"          → LaserBeam class
"homing_orb"          → HomingOrb class
"wall_of_death"       → WallOfDeath class
"minion_spawn"        → MinionSpawner class
```

**Security:** No eval(), no code generation. Only these 6 types are valid.

### Lifecycle
1. **Spawn:** Factory creates instance from config
2. **Stagger:** 400ms delay between each mechanic activation
3. **Active:** Mechanic updates every frame, applies damage, moves objects
4. **Expire:** Mechanic self-destructs after its `duration_seconds` (or when killed)
5. **Cleanup:** All mechanics destroyed on phase end or scene transition

**Current wiring status:** `MechanicInterpreter` and all mechanic classes are **not referenced by any scene** in the shipped build. They are fully implemented but unused.

---

## 1. ProjectileSpawner

**Purpose:** Fires bullets in configurable patterns from the boss position.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"projectile_spawner"` | Mechanic identifier |
| `pattern` | enum | spiral, fan, random, aimed, ring | Bullet pattern |
| `speed` | number | 3–12 | Projectile speed (scaled to px/s by ×60) |
| `projectile_count` | number | 1–12 | Bullets per volley |
| `fire_rate` | number | 0.5–4 | Volleys per second |
| `projectile_size` | number | 4–16 | Bullet radius in pixels |
| `homing` | boolean | — | If true, bullets steer toward player |
| `duration_seconds` | number | 3–15 | Total mechanic lifetime |

### Pattern Behaviors

**spiral:**
- Fires `projectile_count` bullets per volley in a rotating spiral
- Internal spiral angle advances by `+0.35` radians each volley

**fan:**
- Fires `projectile_count` bullets in a 90° cone centered on the player direction
- Even angular spacing (uses `spread / count` step)

**random:**
- Fires `projectile_count` bullets at random angles
- No pattern — pure chaos

**aimed:**
- Fires in a tight 25° cone aimed at the player
- If `projectile_count === 1`, fires a single bullet directly at player

**ring:**
- Fires `projectile_count` bullets simultaneously in a perfect 360° circle
- Equal angular spacing
- All bullets move outward from boss center

### Homing Behavior
When `homing: true`:
- Every frame, velocity is **repointed** directly toward the player's current position
- No interpolation/acceleration curve; bullets snap their heading each update

### Damage & Lifetime
- Each bullet has `damage = 10` and `owner = "boss"`
- Lifetime is `max(1500ms, duration_seconds * 1000)`
- Collision handling is **external** (scene must destroy on hit)

### Visuals
- Small circles or sprites (yellow/orange color `0xffcc00`)
- Size matches `projectile_size` config

---

## 2. HazardZoneSpawner

**Purpose:** Creates area-denial damage zones on the arena floor.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"hazard_zone"` | Mechanic identifier |
| `location` | enum | top_left, top_right, bot_left, bot_right, center, player_position | Zone center |
| `shape` | enum | circle, rectangle | Zone shape |
| `radius` | number | 50–300 | Zone radius (or half-width for rectangle) |
| `damage_per_tick` | number | 5–20 | Damage every 500ms while player overlaps |
| `duration_seconds` | number | 3–15 | Active zone lifetime (warning time is separate) |
| `warning_time` | number | 0.5–2 | Seconds of telegraph before zone activates |

### Location Positions (at 1280x720 display resolution)

| Location | X | Y | Notes |
|----------|---|---|-------|
| `top_left` | 160 | 180 | ~160px from left, ~180px from top |
| `top_right` | 1120 | 180 | |
| `bot_left` | 160 | 540 | |
| `bot_right` | 1120 | 540 | |
| `center` | 640 | 360 | Screen center |
| `player_position` | player.x | player.y | Snapshot at spawn time |

### Behavior Phases

**Warning phase (0 → warning_time):**
- Semi-transparent zone appears at target location
- Pulsing alpha animation (fades in and out)
- Color: magenta `0xff5f9c` at 20% alpha
- No damage during warning

**Active phase (warning_time → duration_seconds):**
- Zone becomes more opaque
- Color: darker magenta `0xff2675` at 35% alpha
- Damage applied every 500ms if player's hitbox overlaps the zone

### Damage
- Tick-based: `damage_per_tick` every 500ms
- Uses a **circular** physics hitbox even if `shape = "rectangle"` (rectangle is visual only)
- Damage check also uses distance-to-center ≤ radius

### Events
- Emits `hazard-zone-spawn` with `{ x, y, radius, shape, width, height, duration }`

### Visuals
- Circle: filled circle with slight glow
- Rectangle: width = `radius × 2`, height = `radius × 1.2`
- Pulsing animation during warning phase

---

## 3. LaserBeam

**Purpose:** Sweeping beam attacks that traverse the arena.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"laser_beam"` | Mechanic identifier |
| `direction` | enum | horizontal, vertical, diagonal, tracking | Sweep direction |
| `speed` | number | 1–5 | Sweep speed |
| `width` | number | 10–60 | Beam width in pixels |
| `damage_on_hit` | number | 15–40 | Damage per hit |
| `duration_seconds` | number | 3–10 | Total beam lifetime |
| `telegraph_time` | number | 0.5–2 | Warning line display before beam fires |

### Direction Behaviors

**horizontal:**
- Beam is a vertical line moving left↔right (randomized start direction)
- Position is initialized at `boss.x`
- Speed = `config.speed × 180` px/s

**vertical:**
- Beam is a horizontal line moving up↔down (randomized start direction)
- Position is initialized at `boss.y`
- Speed = `config.speed × 140` px/s

**diagonal:**
- Fixed 45° line (±π/4) through boss position
- Does **not** rotate over time (static diagonal beam)

**tracking:**
- Beam rotates toward the player each frame
- Turn rate = `config.speed × 0.8` radians/sec
- Angle updates are clamped per-frame (smooth tracking)

### Telegraph Phase
- Thin **white** pulsing line shows beam path
- Duration: `telegraph_time` seconds
- No damage during telegraph
- Gives player time to move out of path

### Active Phase
- Magenta beam with glow (`0xff2266` core, `0xff3a7a` glow)
- Damage checks every 500ms per player
- Hit detection uses point-to-line distance ≤ width/2

### Visuals
- Telegraph: thin white line, pulsing alpha
- Active beam: thick magenta line with glow

---

## 4. HomingOrb

**Purpose:** Tracking projectiles that pursue the player.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"homing_orb"` | Mechanic identifier |
| `count` | number | 1–4 | Number of orbs spawned |
| `speed` | number | 2–6 | Movement speed |
| `damage_on_hit` | number | 20–40 | Damage on player collision |
| `lifetime_seconds` | number | 5–15 | Orb duration before self-destruct |
| `size` | number | 12–30 | Orb radius in pixels |

### Movement
- Orbs spawn near boss position
- Each frame, velocity **lerps** toward player direction
- Lerp factor = `clamp(speed / 6, 0.1, 0.5)`
- Speed is scaled to px/s by `config.speed × 60`

### Interaction
- Orbs are created with `owner = "boss"` and `damage_on_hit`
- Collision handling is **external** (scene must destroy and track `orbs_destroyed`)
- On lifetime expiry: orb self-destructs with explosion VFX

### Visuals
- Purple glowing circle (`0x9d5bff` body, `0x5b2cff` glow)
- Size matches `size` config
- Explosion particle effect on destruction

---

## 5. WallOfDeath

**Purpose:** Sweeping wall barriers that force player movement.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"wall_of_death"` | Mechanic identifier |
| `direction` | enum | top, bottom, left, right, closing | Wall movement direction |
| `speed` | number | 1–4 | Wall movement speed |
| `gap_position` | number | 0–1 or -1 | Gap location (0=left/top, 1=right/bottom, -1=no gap) |
| `gap_width` | number | 50–150 | Width of safe gap in pixels |
| `damage_on_hit` | number | 25–50 | Damage on wall contact |

### Direction Behaviors

**top:** Wall starts at top of arena, sweeps downward
**bottom:** Wall starts at bottom, sweeps upward
**left:** Wall starts at left, sweeps rightward
**right:** Wall starts at right, sweeps leftward
**Speed scaling:** `config.speed × 60` px/s; walls start at ±80px off-screen and stop when fully past the arena

**closing:** Four walls move inward from all sides, then reopen; uses the same `gap_position`/`gap_width` rules for all sides

### Gap Mechanics
- `gap_position` 0–1: fractional position along the wall's length (0 = left/top, 0.5 = center, 1 = right/bottom)
- `gap_position` -1: no gap — wall is solid (must dash through or take damage)
- `gap_width`: pixel width of the safe opening

### Damage
- Contact damage: `damage_on_hit` when player overlaps wall
- Damage checks every 200ms (per-player)
- Player invulnerability frames apply

### Visuals
- Fill color: `0xff2266` (alpha 0.85)
- Outline: `0xff7aa8`
- Wall thickness: 60px

---

## 6. MinionSpawner

**Purpose:** Summons enemy minions with AI behaviors.

### Config Fields

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `type` | string | `"minion_spawn"` | Mechanic identifier |
| `count` | number | 1–5 | Number of minions spawned |
| `minion_speed` | number | 1–4 | Minion movement speed (×120 for px/s) |
| `minion_hp` | number | 10–30 | Minion hit points |
| `behavior` | enum | chase, orbit, kamikaze | Minion AI behavior |
| `spawn_location` | enum | edges, corners, near_player | Where minions appear |

### Spawn Locations

**edges:** Random point on one of the four edges, 40px inset from corners
**corners:** Four fixed corners at (120,120), (W-120,120), (120,H-120), (W-120,H-120)
**near_player:** Random ring around player (radius 60–200), clamped inside arena bounds

### Behavior Modes

**chase:**
- Move directly toward player at `minion_speed × 120` px/s
- Damage on collision with player: 10

**orbit:**
- Circle around boss at fixed radius (160px)
- Angular speed = `minion_speed × 0.8` rad/s
- Acts as a danger zone around boss position
- Damage on collision: 10

**kamikaze:**
- Charge directly at player at `minion_speed × 120` px/s
- Higher damage on collision: 20
- Self-destructs after impact (distance < 24px)

### Minion Properties
- Each minion has `minion_hp` hit points
- HP is stored on the sprite (`__hp`), but **no built-in damage handling** exists in this class
- Collision/damage is expected to be handled by the scene

### Visuals
- Small triangle shapes (green `0x00ff66` fill, `0xafffd1` outline)
- Code-drawn texture (`minion-triangle`)

---

## Value Clamping Ranges Summary

All AI-generated values are clamped to these ranges by the server before sending to client:

| Mechanic | Field | Min | Max |
|----------|-------|-----|-----|
| All | duration_seconds | 3 | 15 |
| projectile_spawner | speed | 3 | 12 |
| projectile_spawner | projectile_count | 1 | 12 |
| projectile_spawner | fire_rate | 0.5 | 4 |
| projectile_spawner | projectile_size | 4 | 16 |
| hazard_zone | radius | 50 | 300 |
| hazard_zone | damage_per_tick | 5 | 20 |
| hazard_zone | warning_time | 0.5 | 2 |
| laser_beam | speed | 1 | 5 |
| laser_beam | width | 10 | 60 |
| laser_beam | damage_on_hit | 15 | 40 |
| laser_beam | telegraph_time | 0.5 | 2 |
| homing_orb | count | 1 | 4 |
| homing_orb | speed | 2 | 6 |
| homing_orb | damage_on_hit | 20 | 40 |
| homing_orb | lifetime_seconds | 5 | 15 |
| homing_orb | size | 12 | 30 |
| wall_of_death | speed | 1 | 4 |
| wall_of_death | gap_width | 50 | 150 |
| wall_of_death | damage_on_hit | 25 | 50 |
| minion_spawn | count | 1 | 5 |
| minion_spawn | minion_speed | 1 | 4 |
| minion_spawn | minion_hp | 10 | 30 |
