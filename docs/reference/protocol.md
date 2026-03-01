# WebSocket & HTTP Protocol Specification

> Defines the exact message formats, sequences, and error handling for client-server communication.

**Current status:** `WebSocketClient.ts` and all WebSocket server code were **deleted** when the AI boss fight system was removed. The server currently runs as a pure HTTP audio server (no WebSocket). This document defines the protocol to **rebuild** for the demo.

**What exists today:**
- HTTP server on `:8787` with audio routes (`/api/audio/*`) — see [ai-integration.md](ai-integration.md)
- No WebSocket, no Mistral routes, no ANALYZE/BOSS_RESPONSE messages

**What needs to be built:** The full WebSocket + Mistral pipeline described below.

---

## HTTP Endpoints (Current — ✅ Implemented)

### GET /health
**Response:** `{ "status": "ok", "generatedDir": "..." }`

### POST /api/audio/generate
**Body:** `{ "category": string }`
**Response:** `{ "url": string, "fromCache": boolean }`
**Purpose:** Generate or retrieve cached ElevenLabs SFX/music

### POST /api/audio/telemetry
**Body:** `{ hp, maxHp, bossHp, bossMaxHp, enemyCount, recentDamageTaken }`
**Response:** `{ "musicMood": string, "addLayer": boolean, "volumeMultiplier": number }`
**Purpose:** Adaptive music mood from combat state

### GET /api/audio/categories
**Response:** `{ "categories": [{ name, type, cached }] }`

### GET /api/audio/stats
**Response:** cache statistics

---

## HTTP Endpoints (To Build — ⬜ Rebuild Target)

### POST /api/boss/analyze
**Body:** `{ player_said: string, telemetry: TelemetryPayload }`
**Response:** `BossResponse` (or sends via WebSocket if WS connected)

---

## WebSocket Protocol (⬜ Rebuild Target)

### Connection

- **URL:** `ws://localhost:3001` (dev) or `wss://<deploy-domain>` (production)
- **Library:** Any WebSocket implementation (original uses `ws` on server, native `WebSocket` on client)

### Reconnection Logic

Client must implement automatic reconnection:
- **Max retries:** 3
- **Retry delay:** 1000ms between attempts
- **Manual close:** No auto-reconnect (user intentionally disconnected)
- **Connection status:** Emit to UI listeners on connect/disconnect

---

## Message Types

### Client → Server

#### ANALYZE

Sent when Phase 1 ends and phase transition begins.

```json
{
  "type": "ANALYZE",
  "payload": {
    "player_id": "player-1",
    "phase_duration_seconds": 42.3,
    "player_hp_at_transition": 87,
    "phase_forced_by_timeout": false,
    "movement_heatmap": {
      "top_left": 12,
      "top_center": 8,
      "top_right": 5,
      "mid_left": 10,
      "mid_center": 35,
      "mid_right": 8,
      "bot_left": 6,
      "bot_center": 9,
      "bot_right": 7
    },
    "dodge_bias": {
      "left": 25,
      "right": 30,
      "up": 20,
      "down": 25
    },
    "damage_taken_from": {
      "melee": 45,
      "projectile": 30,
      "hazard": 10
    },
    "shots_fired": 145,
    "shots_hit": 82,
    "orbs_destroyed": 3,
    "average_distance_from_boss": 156.4,
    "movement_distance": 3245.2,
    "average_speed": 76.8,
    "accuracy": 0.565,
    "dash_frequency": 1.2,
    "corner_time_pct": 28.5,
    "reaction_time_avg_ms": 485
  }
}
```

### Server → Client

#### BOSS_RESPONSE

Sent after Mistral API generates the boss response (or fallback is used).

```json
{
  "type": "BOSS_RESPONSE",
  "payload": {
    "analysis": "Player spent 62% of time in bottom-left corner with 28% corner time. Dodge bias strongly favors leftward movement. Accuracy is moderate at 56%.",
    "taunt": "Still hiding in that corner? I've placed something special there for you.",
    "mechanics": [
      {
        "type": "hazard_zone",
        "location": "bot_left",
        "shape": "circle",
        "radius": 140,
        "damage_per_tick": 12,
        "duration_seconds": 8,
        "warning_time": 1.0
      },
      {
        "type": "projectile_spawner",
        "pattern": "aimed",
        "speed": 7,
        "projectile_count": 4,
        "fire_rate": 1.5,
        "projectile_size": 8,
        "homing": false,
        "duration_seconds": 10
      }
    ]
  }
}
```

#### AUDIO_READY

Sent after ElevenLabs TTS generates audio. May arrive seconds after BOSS_RESPONSE.

```json
{
  "type": "AUDIO_READY",
  "payload": {
    "audioBase64": "<base64-encoded MP3 data>",
    "format": "mp3"
  }
}
```

#### ERROR

Sent when the AI pipeline fails. Always includes a fallback BossResponse.

```json
{
  "type": "ERROR",
  "payload": {
    "message": "Failed to generate response",
    "fallback": {
      "analysis": "Fallback pattern: central pressure and spiral fire.",
      "taunt": "You cannot escape.",
      "mechanics": [
        { "type": "hazard_zone", "..." : "..." },
        { "type": "projectile_spawner", "..." : "..." }
      ]
    }
  }
}
```

---

## Message Sequence Diagram

### Happy Path

```
Client                          Server
  |                                |
  |  [Phase 1 ends at 50% HP]     |
  |                                |
  |------- ANALYZE --------------->|
  |        (telemetry payload)     |
  |                                |--- Mistral API call (2-4s)
  |                                |--- ElevenLabs API call (1-3s, parallel)
  |                                |
  |<------ BOSS_RESPONSE ----------|
  |        (analysis + mechanics)  |
  |                                |
  |  [Client starts Phase 2]      |
  |  [Spawns mechanics]           |
  |                                |
  |<------ AUDIO_READY ------------|  (may arrive later)
  |        (base64 MP3)           |
  |                                |
  |  [Client plays audio]         |
```

### Fallback Path (API Failure)

```
Client                          Server
  |                                |
  |------- ANALYZE --------------->|
  |                                |--- Mistral API call (fails/timeout)
  |                                |
  |<------ ERROR ------------------|
  |        (message + fallback)    |
  |                                |
  |  [Client uses fallback]       |
  |  [Shows FALLBACK in DevConsole]|
```

### Network Disconnect Path

```
Client                          Server
  |                                |
  |  [WebSocket disconnects]       |
  |  [Phase 1 continues normally]  |
  |                                |
  |  [Phase transition triggers]   |
  |  [send() fails]               |
  |                                |
  |  [Client uses local fallback]  |
  |  [Shows OFFLINE MODE in HUD]  |
  |  [2s overlay instead of 3-6s] |
```

---

## Server-Side Processing Pipeline

When ANALYZE is received:

```
1. Parse message → extract TelemetryPayload
2. Call Mistral API (primary model)
   ├─ Success → validate JSON response
   │   ├─ Valid → clamp values → use as BossResponse
   │   └─ Invalid → try salvage partial
   │       ├─ Partial valid → clamp + use
   │       └─ All invalid → try fallback model
   └─ Failure/timeout → try fallback model
       ├─ Fallback success → validate → clamp → use
       └─ Fallback failure → use cached fallback config
3. Send BOSS_RESPONSE to client
4. Call ElevenLabs API with taunt text (async, non-blocking)
   ├─ Success → send AUDIO_READY
   └─ Failure → skip audio (graceful degradation)
```

---

## Environment Variables

### Server
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MISTRAL_API_KEY` | Yes | — | Mistral API authentication key |
| `ELEVENLABS_API_KEY` | No | — | ElevenLabs TTS key (audio disabled if absent) |
| `ELEVENLABS_VOICE_ID` | No | `pNInz6obpgDQGcFmaJgB` | Voice ID for TTS |
| `PORT` | No | `8787` | HTTP/WebSocket server port |
| `DEMO_MODE` | No | `false` | If "true", uses mistral-large-latest model |

### Client
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WS_URL` | No | `ws://localhost:8787` | WebSocket server URL — use same port as HTTP server |
