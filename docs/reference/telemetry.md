# Telemetry Collection Specification

> Describes what data the **TelemetryTracker** records and how it computes each field.
>
> **Status:** `TelemetryTracker` exists in `client/src/systems/TelemetryTracker.ts` but is **not referenced** by any scene in the shipped build.

---

## Overview

- **Sampling rate:** `CONFIG.TELEMETRY_INTERVAL` (500ms)
- **Scope:** Intended for the arena boss fight (uses `CONFIG.WIDTH/HEIGHT` = 1280×720)
- **Output:** `TelemetryPayload` (see `types.md`)

---

## Data Collection Details

### 1. Movement Heatmap (9-Zone Grid)
- Samples player position every 500ms
- Grid boundaries are **computed** from `CONFIG.WIDTH/HEIGHT` (thirds)
- Zone labels: `top_left`, `top_center`, `top_right`, `mid_left`, `mid_center`, `mid_right`, `bot_left`, `bot_center`, `bot_right`

At 1280×720, the implicit boundaries are:
- X: <426.7, 426.7–853.3, ≥853.3
- Y: <240, 240–480, ≥480

### 2. Dodge Bias (Directional Preference)
- **Not** derived from movement velocity
- Recorded on **dash** only via `recordDash(direction)`
- Uses **dominant axis** of dash vector: if `abs(x) >= abs(y)` → left/right; else → up/down

### 3. Damage Tracking (Source Attribution)
- **No built-in event binding** in TelemetryTracker
- Scenes must call `recordDamage(source, amount)` manually
- `source`: `"melee" | "projectile" | "hazard"`

### 4. Accuracy (Shots Fired vs Hits)
- `recordShotFired()` is bound to `player-shot` event
- `recordShotHit()` must be called manually on boss hit
- Accuracy = `shots_hit / shots_fired` (0 if no shots fired)

### 5. Orbs Destroyed
- `recordOrbDestroyed()` must be called manually
- No automatic binding exists

### 6. Average Distance from Boss
- Each sample adds distance between player and boss
- Average = `distanceSum / distanceSamples`

### 7. Movement Distance & Average Speed
- Per-sample delta distance accumulates into `movement_distance`
- `average_speed = movement_distance / phase_duration_seconds`

### 8. Dash Frequency
- `dash_frequency = dashCount / durationMinutes`

### 9. Corner Time Percentage
- Corner zones: `top_left`, `top_right`, `bot_left`, `bot_right`
- `corner_time_pct = (cornerSamples / totalSamples) * 100`

### 10. Reaction Time
- `recordTelegraph()` is bound to the `boss-telegraph` event
- On subsequent samples, if player speed > 10 px/s, reaction time is recorded
- `reaction_time_avg_ms` is the mean of recorded times

### 11. Transition Flags
- `player_hp_at_transition` set via `setPlayerHpAtTransition(hp)`
- `phase_forced_by_timeout` set via `setPhaseForcedByTimeout(true|false)`

---

## Payload Output

`compile()` returns:

```typescript
{
  player_id,
  phase_duration_seconds,
  player_hp_at_transition,
  phase_forced_by_timeout,
  movement_heatmap,
  dodge_bias,
  damage_taken_from,
  shots_fired,
  shots_hit,
  orbs_destroyed,
  average_distance_from_boss,
  movement_distance,
  average_speed,
  accuracy,
  dash_frequency,
  corner_time_pct,
  reaction_time_avg_ms
}
```
