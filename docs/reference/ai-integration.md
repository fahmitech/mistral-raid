# AI Integration — Current State & Demo Target

> **Status key:** ✅ Built | ⬜ Not yet built | 🗑️ Was built, removed

See [demo-scripts.md](../demo-scripts.md) for the demo this is building toward.
See [tracker.md](../progress/tracker.md) for full feature status.

---

## What Is Built ✅

### ElevenLabs Audio Generation (Server)

The server at `server/src/` is a pure audio generation server. **No Mistral. No WebSocket.**

```
POST /api/audio/generate   { category: string } → { url, fromCache }
POST /api/audio/telemetry  { hp, maxHp, bossHp, bossMaxHp, enemyCount, recentDamageTaken }
                           → { musicMood, addLayer, volumeMultiplier }
GET  /api/audio/categories → list of all 40+ sound categories
GET  /api/audio/stats      → cache stats
GET  /health               → { status: 'ok' }
```

**Sound library:** 40+ categories including:
- SFX: menu sounds, footsteps, dash, shield, weapon hits (per weapon type), player hit/death, enemy sounds, boss intro/death, chest/potion/item interactions, UI sounds, heartbeat
- Music: menu_ambient, dungeon_ambient_loop, combat_music, boss_music_loop, game_over_theme, victory_theme, credits_music, hero_select_music
- Voice taunts: 4 preset taunt lines (voice generation endpoint disabled — different ElevenLabs API)

Audio is generated via ElevenLabs from text prompts, cached to `server/generated-audio/`, served as MP3 files.

### Adaptive Music Telemetry (Client → Server)

`AudioManager.updateTelemetry(data)` sends combat state to `/api/audio/telemetry`. Server returns a `musicMood` and `volumeMultiplier`. AudioManager applies the multiplier over 1.5s ramp.

**Mood logic (server-side):**

| Condition | Mood | Volume Mult |
|-----------|------|-------------|
| HP ≤ 20% | `critical` | 1.2× |
| HP ≤ 40% OR boss HP ≤ 30% | `intense` | 1.1× |
| enemy count > 5 OR recent damage > 3 OR boss present | `tense` | 1.05× |
| default | `calm` | 1.0× |

### AudioManager (Client)

Singleton at `client/src/systems/AudioManager.ts`.

- **Two-tier playback:** Phaser static MP3s (from `client/public/audio/`) for music; Web Audio API for dynamic SFX + fallback
- **LRU buffer cache:** Max 60 buffers; evicts least-recently-used
- **Cooldown system:** Per-SFX cooldowns prevent spam (e.g., footstep 200ms, sword_slash 100ms)
- **Fallback tones:** Oscillator-based tones per SFX key when server unavailable
- **Spatialized SFX:** `playSFXAt()` attenuates by distance (max 220px) + stereo pan
- **Heartbeat:** Triggers at player HP < 30%, auto-stops on recovery
- **Volume graph:** master → (sfx branch, music branch); each persisted to localStorage
- **Per-weapon SFX:** `playWeaponSFX(ItemType)` maps each weapon to its sound
- **Crossfade:** `crossFade(key)` for smooth music transitions

---

## What Needs To Be Built ⬜ (Demo Target)

### 1. Voxstral STT — Mic → Text

The demo shows the player speaking into a mic with the boss responding to their words.

```
[Browser Mic] → Voxstral STT API → transcript string → Express server
```

**What to build:**
- Browser `getUserMedia()` mic capture
- Voxstral STT streaming (continuous transcription)
- Send transcript to server alongside telemetry

### 2. Mistral API — Boss Brain

The core of the demo. Mistral receives player speech + combat telemetry and returns a taunt + attack mechanics.

**Server route to add:** `POST /api/boss/analyze`

**Input:**
```typescript
{
  player_said: string;           // from Voxstral STT
  telemetry: TelemetryPayload;   // from TelemetryTracker
}
```

**Output (`BossResponse`):**
```typescript
{
  analysis: string;       // 1-2 sentences for DevConsole
  taunt: string;          // <30 words, spoken via Voxstral TTS
  mechanics: MechanicConfig[];  // 2-3 attack mechanics
}
```

**Model cascade:**
| Priority | Model | Timeout | Use When |
|----------|-------|---------|----------|
| 1 | `mistral-small-latest` | 4s | Default |
| 2 | `ministral-8b-latest` | 2s | Primary fails |
| 3 | `mistral-large-latest` | 6s | DEMO_MODE=true |
| fallback | cached config | instant | All fail |

**System prompt:** THE ARCHITECT persona — see original [ai-integration.md](#the-architect-system-prompt) for the full prompt text. Instructs Mistral to generate taunts referencing specific telemetry data and output attack mechanics.

**Response validation pipeline:**
1. Parse JSON
2. Schema validate (analysis, taunt, mechanics array of 2-3)
3. Enum validate (mechanic type, pattern, direction, etc.)
4. Value clamping (all numeric fields per range in [mechanics.md](mechanics.md))
5. Partial salvage: if some mechanics invalid, keep valid ones + pad with fallback
6. Full fallback: cached `BossResponse` if everything fails

### 3. Voxstral TTS — Text → Boss Voice

After Mistral generates the taunt, it must be spoken aloud.

```
taunt string → Voxstral TTS → audio bytes → base64 → client → <audio> element
```

**Voice config (from original spec):**
```
Model:  eleven_flash_v2_5
Voice:  pNInz6obpgDQGcFmaJgB ("Adam")
Format: mp3_44100_128
Settings: stability 0.3, similarity_boost 0.8, style 0.5, speed 0.9
```

**Client playback:**
1. Receive base64 audio from server
2. Decode → Blob → Object URL
3. Create `<audio>` element, play
4. Call `AudioManager.get().duckMusic(0.3, 3.0)` during playback (`duckMusic` already implemented ✅)

### 4. WebSocket (Client ↔ Server Realtime)

The debate loop is realtime — polling won't work.

**Message protocol:**

```typescript
// Client → Server
{ type: "ANALYZE"; payload: TelemetryPayload }

// Server → Client
{ type: "BOSS_RESPONSE"; payload: BossResponse }
{ type: "AUDIO_READY"; payload: { audioBase64: string; format: string } }
{ type: "ERROR"; payload: { message: string; fallback: BossResponse } }
```

**Client:** `WebSocketClient` with 3-retry reconnection (previously existed, needs rebuild)
**Server:** `ws` library alongside Express on same port or separate

### 5. Telemetry Tracker

Records player behavior during a fight phase. Previously existed as `TelemetryTracker.ts`, needs rebuild.

**Collects:**
- Movement heatmap (9 zones, sampled every 500ms)
- Dodge direction bias (from dash events)
- Shots fired / shots hit
- Orbs destroyed
- Average distance from boss
- Corner time percentage
- Reaction time (time between telegraph and dodge)
- Damage taken by type (melee/projectile/hazard)

### 6. Arena Boss Fight Scene

The dungeon currently has `BossEntity` per level but no arena-style phase fight. The demo's boss fight is a dedicated arena scene with:

- Phase 1: hardcoded boss attacks (SPRAY, SLAM, SWEEP, CHASE_SHOT escalating over 60–90s)
- Phase transition: telemetry sent to Mistral, AnalyzingOverlay shown
- Phase 2: AI-generated mechanics spawned from `BossResponse.mechanics`
- TauntText shown with typewriter effect while boss voice plays
- Phase 3: repeat pattern escalation

### 7. Mechanic "Lego Bricks" (6 Types)

All previously existed, need rebuilding. See [mechanics.md](mechanics.md) for full specs.

| Type | Behavior |
|------|----------|
| `projectile_spawner` | Fires bullets (spiral/fan/random/aimed/ring patterns), optional homing |
| `hazard_zone` | Damage zone with warning phase (circle or rectangle) |
| `laser_beam` | Sweeping beam (horizontal/vertical/diagonal/tracking) |
| `homing_orb` | Velocity-lerp tracking projectiles |
| `wall_of_death` | Sweeping walls with configurable gap |
| `minion_spawn` | Summoned enemies (chase/orbit/kamikaze behaviors) |

### 8. AI Dungeon Director

Outside boss fights, Mistral adjusts dungeon difficulty. Every 20 seconds:

```
Dungeon telemetry → Mistral → { difficultyDelta, enemyBias, lootBias, reason }
```

**difficultyDelta:** Adjust enemy HP/speed multipliers for the next room
**enemyBias:** Bias next room spawn toward "ranged", "melee", "tank", etc.
**F5 panel:** Debug overlay showing last Director decision

---

## The ARCHITECT System Prompt

For reference when rebuilding the Mistral integration:

```
You are THE ARCHITECT, a sadistic AI Game Master in a boss fight video game. You analyze
player telemetry data and design personalized attack mechanics to exploit their weaknesses.

You MUST respond with a valid JSON object containing exactly these fields:
{
  "analysis": "A 1-2 sentence analysis of the player's weaknesses",
  "taunt": "A short, menacing taunt (1-2 sentences, under 30 words) that references the
            player's specific habits. Be creative, dark, and intimidating.",
  "mechanics": [2-3 mechanic objects that counter the player's playstyle]
}

[6 mechanic type definitions with required fields and ranges — see mechanics.md]

DESIGN RULES:
- Analysis MUST reference at least TWO specific telemetry fields with numbers
- Do NOT claim player is "standing still" unless MC heatmap ≥ 60%, dash ≤ 0.5/min, avg dist ≤ 140px
- Do NOT claim player "never attacks" if shots_fired > 0
- If corner_time_pct < 20%, do NOT accuse corner camping
- Always generate 2-3 mechanics that COUNTER the player's habits
- Keep it fair — always leave a way to survive
```

---

## Server Fallback Config

When all Mistral calls fail, return this cached response:

```json
{
  "analysis": "The player relies on simple movement patterns and needs pressure from multiple angles.",
  "taunt": "I have seen your rhythm. Now dance to mine.",
  "mechanics": [
    { "type": "projectile_spawner", "pattern": "fan", "speed": 6,
      "projectile_count": 6, "fire_rate": 1.5, "projectile_size": 8,
      "homing": false, "duration_seconds": 6 },
    { "type": "hazard_zone", "location": "center", "shape": "circle",
      "radius": 140, "damage_per_tick": 10, "duration_seconds": 6, "warning_time": 1 }
  ]
}
```
