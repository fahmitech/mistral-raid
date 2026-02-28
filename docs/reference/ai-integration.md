# AI Integration Specification

> Describes Mistral API prompt engineering, ElevenLabs TTS integration, response validation, and fallback strategy.

---

## Mistral API Integration

### Model Cascade

The server uses a cascading model strategy:

| Priority | Model | Timeout | Temperature | Max Tokens | When Used |
|----------|-------|---------|-------------|------------|-----------|
| 1 (primary) | `mistral-small-latest` | 4 sec | 0.8 | 500 | Default |
| 2 (fallback) | `ministral-8b-latest` | 2 sec | 0.7 | 400 | Primary fails/timeout |
| 3 (demo) | `mistral-large-latest` | 6 sec | 0.9 | 600 | `DEMO_MODE=true` |

**Cascade logic:**
1. If `MISTRAL_API_KEY` is missing → return server fallback immediately (no API call)
2. Try primary model → if valid response, use it
3. If primary fails/times out → try fallback model with same prompt
4. If fallback fails → try salvaging partial response from either attempt
5. If all fail → use cached fallback config (no API call)

### API Configuration

```
API: Mistral Chat Completions
Response format: { type: "json_object" }  (NOT function calling)
```

### Exact System Prompt

The system prompt is sent verbatim to Mistral. Here is the exact text:

```
You are THE ARCHITECT, a sadistic AI Game Master in a boss fight video game. You analyze player telemetry data and design personalized attack mechanics to exploit their weaknesses.

You MUST respond with a valid JSON object containing exactly these fields:
{
  "analysis": "A 1-2 sentence analysis of the player's weaknesses",
  "taunt": "A short, menacing taunt (1-2 sentences, under 30 words) that references the player's specific habits. Be creative, dark, and intimidating. Speak directly to the player.",
  "mechanics": [2-3 mechanic objects that counter the player's playstyle]
}

AVAILABLE MECHANIC TYPES:

1. "projectile_spawner" - Spawns bullet patterns
   Required fields: type, pattern ("spiral"|"fan"|"random"|"aimed"|"ring"), speed (3-12), projectile_count (1-12), fire_rate (0.5-4), projectile_size (4-16), homing (boolean), duration_seconds (3-15)

2. "hazard_zone" - Area denial damage zones
   Required fields: type, location ("top_left"|"top_right"|"bot_left"|"bot_right"|"center"|"player_position"), shape ("circle"|"rectangle"), radius (50-300), damage_per_tick (5-20), duration_seconds (3-15), warning_time (0.5-2)

3. "laser_beam" - Sweeping beam attacks
   Required fields: type, direction ("horizontal"|"vertical"|"diagonal"|"tracking"), speed (1-5), width (10-60), damage_on_hit (15-40), duration_seconds (3-10), telegraph_time (0.5-2)

4. "homing_orb" - Tracking projectiles
   Required fields: type, count (1-4), speed (2-6), damage_on_hit (20-40), lifetime_seconds (5-15), size (12-30)

5. "wall_of_death" - Sweeping walls with gaps
   Required fields: type, direction ("top"|"bottom"|"left"|"right"|"closing"), speed (1-4), gap_position (0-1, or -1 for no gap), gap_width (50-150), damage_on_hit (25-50)

6. "minion_spawn" - Summon small enemies
   Required fields: type, count (1-5), minion_speed (1-4), minion_hp (10-30), behavior ("chase"|"orbit"|"kamikaze"), spawn_location ("edges"|"corners"|"near_player")

DESIGN RULES:
- Your analysis MUST be grounded in the telemetry. Reference at least TWO specific telemetry fields with numbers (e.g., "Corner Camping 62%, Dash 0.4/min").
- Do NOT claim the player is "standing still" or "never moving" unless ALL are true: Mid-center (MC) heatmap >= 60%, Dash Frequency <= 0.5/min, Average Distance From Boss <= 140px
- Do NOT claim the player "never attacks" if Shots Fired > 0.
- Do NOT claim the player is "standing still" if Movement Distance >= 120px or Average Speed >= 20px/s.
- If corner_time_pct < 20%, do NOT accuse corner camping.
- If accuracy >= 30%, do NOT claim they "never attack".
- Always generate exactly 2-3 mechanics that COUNTER the player's habits
- If they camp in a corner → place hazard_zone there + wall_of_death to flush them out
- If they dodge left always → use aimed projectiles from the right + tracking laser
- If they stay far from boss → use homing_orbs + minions to close distance
- If they have low accuracy → use fast, small projectiles they need to dodge
- If they take lots of projectile damage → add more projectiles with trickier patterns
- If they rarely dash → use slow homing attacks that require dashing to escape
- Keep it challenging but FAIR — always leave a way to survive
- Be creative! Combine mechanics in unexpected ways

TAUNT RULES:
- Reference the player's SPECIFIC behavior (e.g., "Still hiding in that corner?")
- Keep it under 30 words — this will be spoken aloud
- Be menacing, not silly. Think dark fantasy villain, not cartoon.
- Examples: "Your left dodge is predictable. This time, there is no escape."
- Examples: "Distance won't save you from what I've planned."
```

### User Prompt Construction

The user prompt formats telemetry data with heatmap values converted to percentages. Here is the exact template:

```
PLAYER TELEMETRY DATA:

Phase 1 Duration: {phase_duration_seconds}s
Player HP at Transition: {player_hp_at_transition}
Phase Forced By Timeout: {yes|no}
Movement Heatmap (% time in each zone):
  TL:{top_left}% TC:{top_center}% TR:{top_right}%
  ML:{mid_left}% MC:{mid_center}% MR:{mid_right}%
  BL:{bot_left}% BC:{bot_center}% BR:{bot_right}%
Dodge Direction Bias: Left:{left} Right:{right} Up:{up} Down:{down}
Damage Taken From: Melee:{melee} Projectile:{projectile} Hazard:{hazard}
Shots Fired: {shots_fired} | Shots Hit: {shots_hit}
Orbs Destroyed: {orbs_destroyed}
Average Distance From Boss: {average_distance_from_boss}px
Movement Distance: {movement_distance}px
Average Speed: {average_speed}px/s
Shot Accuracy: {accuracy * 100}%
Dash Frequency: {dash_frequency}/min
Corner Camping: {corner_time_pct}%
Average Reaction Time: {reaction_time_avg_ms}ms

Design 2-3 attack mechanics to exploit this player's weaknesses. Respond with the JSON object only.
```

**Heatmap conversion**: Raw counts are converted to percentages (value / total × 100, 1 decimal)

**No rage mode addendum** in current implementation — the prompt is static regardless of timeout status.

---

## Response Validation

### Validation Pipeline

```
Raw JSON from Mistral
    ↓
1. Parse JSON (reject non-JSON)
    ↓
2. Schema validation
   - analysis: string
   - taunt: string
   - mechanics: array of 2-3 items
   - each mechanic: valid type + required fields
    ↓
3. Enum validation
   - type: one of 6 valid types
   - pattern (projectile): one of spiral/fan/random/aimed/ring
   - direction (laser): one of horizontal/vertical/diagonal/tracking
   - location (hazard): one of top_left/top_right/bot_left/bot_right/center/player_position
   - shape (hazard): one of circle/rectangle
   - direction (wall): one of top/bottom/left/right/closing
   - behavior (minion): one of chase/orbit/kamikaze
   - spawn_location (minion): one of edges/corners/near_player
    ↓
4. Value clamping (see config-reference.md for all ranges)
   - NaN → replace with minimum value
   - Below min → clamp to min
   - Above max → clamp to max
   - `wall_of_death.gap_position`: `<= -1` preserved as `-1` sentinel; otherwise clamped 0–1
    ↓
5. Output: validated BossResponse
```

### Salvage Partial Response

When full `validate()` fails (e.g., only 1 mechanic instead of 2, or one mechanic has invalid fields):

1. `salvagePartial(parsed)` tries to extract **individually valid** mechanics from the array
2. It skips invalid mechanics but keeps valid ones (even if only 1)
3. `analysis` and `taunt` are kept if they're valid strings; otherwise `undefined`
4. If 0 valid mechanics found → returns `null` (triggers full fallback)

### Merge Logic (Partial + Fallback)

When salvage succeeds (≥1 valid mechanic), the response is **merged** with the server fallback:

```
mergeMechanics(salvaged.mechanics, fallback.mechanics):
  1. Take up to 3 mechanics from salvaged (AI-generated)
  2. If total mechanics < 2, append fallback mechanics until total reaches 2 (salvage already has ≥1)
  3. Final result: max 3 mechanics total
```

The merged response uses:
- `analysis`: salvaged if present, else fallback
- `taunt`: salvaged if present, else fallback
- `mechanics`: merged array (AI-first, fallback-padded)
- All values are then clamped via `clampValues()`

### Fallback on Complete Failure

When both models fail and salvage returns nothing:
- Server returns its single cached fallback config (see [Server Fallback Config](#server-fallback-config) below)
- This is instant (no API call needed)

---

## ElevenLabs TTS Integration

### Voice Configuration

```
API:            ElevenLabs Text-to-Speech v1
Model:          eleven_flash_v2_5
Voice ID:       pNInz6obpgDQGcFmaJgB ("Adam" — deep, authoritative)
Output Format:  mp3_44100_128 (44.1 kHz, 128 kbps MP3)
Timeout:        5 seconds
```

### Voice Settings

```json
{
  "stability": 0.3,
  "similarity_boost": 0.8,
  "style": 0.5,
  "speed": 0.9
}
```

- **Stability 0.3:** More variation, less robotic (menacing boss feel)
- **Similarity 0.8:** Close to base voice model
- **Style 0.5:** Neutral expression
- **Speed 0.9:** Slightly faster than natural speech

### Request Flow

1. Extract `taunt` from BossResponse (max 30 words)
2. POST to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
3. Body: `{ text, model_id, voice_settings, output_format }`
4. Response: raw audio bytes
5. Convert to base64 string
6. Send via WebSocket as `AUDIO_READY` message

### Graceful Fallback

ElevenLabs is **optional**:
- If `ELEVENLABS_API_KEY` is missing: skip entirely
- If API times out (5s): skip audio, proceed with text-only taunt
- If API returns error: skip audio
- Game remains fully playable without voice — taunt displays as text only

### Client Audio Playback

1. Receive `AUDIO_READY` message with base64 MP3
2. Decode base64 → create Blob → create object URL
3. Create `<audio>` element, set src to object URL
4. Play audio
5. Audio plays during/after phase transition as boss "speaks"

---

## Fallback Systems

There are **two independent fallback systems** — one server-side, one client-side. They serve different failure scenarios.

### Server Fallback Config

**Location:** `server/src/fallbackCache.ts`
**Trigger:** Both Mistral models fail (timeout, error, invalid response) AND salvage fails
**Selection:** Single config, always the same (`getFallbackResponse()` returns index 0)
**Also used for:** Merge padding when salvage finds partial AI response (see Merge Logic above)

```json
{
  "analysis": "The player relies on simple movement patterns and needs pressure from multiple angles.",
  "taunt": "I have seen your rhythm. Now dance to mine.",
  "mechanics": [
    {
      "type": "projectile_spawner",
      "pattern": "fan",
      "speed": 6,
      "projectile_count": 6,
      "fire_rate": 1.5,
      "projectile_size": 8,
      "homing": false,
      "duration_seconds": 6
    },
    {
      "type": "hazard_zone",
      "location": "center",
      "shape": "circle",
      "radius": 140,
      "damage_per_tick": 10,
      "duration_seconds": 6,
      "warning_time": 1
    }
  ]
}
```

### Client Fallback Configs (Offline Mode)

**Location:** `client/src/config/fallbackAttacks.ts`
**Trigger:** No runtime references found in current client; this list is **unused** today
**Count:** 5 configs, each with 2–6 mechanics covering different scenarios
**Current status:** Exported as `FALLBACK_ATTACKS: BossResponse[]` but **NOT imported anywhere** in the client code — this is prepared/dead code not yet wired into any scene.

| # | Strategy | Mechanics |
|---|----------|-----------|
| 1 | Central pressure + spiral fire | `hazard_zone` (center, r=140) + `projectile_spawner` (spiral, 6 projectiles) |
| 2 | Tracking beam + ring bullets | `laser_beam` (tracking, w=30) + `projectile_spawner` (ring, 10 projectiles) |
| 3 | Closing walls + homing orbs | `wall_of_death` (closing, gap=120) + `homing_orb` (2 orbs, spd=3) |
| 4 | Chase minions + targeted hazard | `minion_spawn` (3 chasers) + `hazard_zone` (player_position, r=120) |
| 5 | 4-corner denial + laser + aimed | 4× `hazard_zone` (all corners, r=110) + `laser_beam` (horizontal) + `projectile_spawner` (aimed, 4 projectiles) |

> **Implementation note:** The current code does **not** wire these into any scene. If you choose to support offline mode, you can use this list (e.g., rotate or random index); this is not implemented in the shipped build.
