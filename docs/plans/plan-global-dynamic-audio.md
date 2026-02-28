# TASK: Implement Fully Dynamic Global Music & Sound System (Hackathon-Grade)

## Context

Project: Mistral Raid  
Stack:
- Frontend: Phaser
- Backend: Node + Express
- ElevenLabs API key stored in: server/.env
  ELEVENLABS_API_KEY=...

Goal:
Build a professional, production-grade dynamic music and sound system
powered by ElevenLabs, fully integrated in the dungeon crawler.

System must:
- Use ElevenLabs Sound Effects + Music generation
- Cache generated assets
- Adapt music dynamically to gameplay
- Work reliably (credit-safe)
- Impress hackathon jury

---

# PART 1 — Backend ElevenLabs Music Engine

## 1. Create Service

Create:

server/src/services/elevenlabsMusicService.ts

Responsibilities:

- Read ELEVENLABS_API_KEY securely
- Generate:
  - Ambient loop music
  - Combat music
  - Boss music
  - Game over theme
  - Victory theme
- Generate short SFX (under 2s)
- Cache audio files locally
- Never regenerate existing sounds
- Rate limit API usage

Folder:

server/generated-audio/music/
server/generated-audio/sfx/

---

## 2. Credit Safe Mode

Implement:

- Cache by hash of prompt
- Before calling API:
  check if file exists
- Store metadata in JSON file
- Log credit usage
- Fallback to pre-generated default audio if API fails

---

## 3. Music Prompts

Generate high quality cinematic prompts:

Ambient:
"Loopable dark dungeon ambient background, deep low wind, subtle echo, immersive, no melody, 45 seconds"

Combat:
"Fast paced dark fantasy combat music, intense percussion, loopable, 30 seconds"

Boss:
"Epic orchestral boss battle music, dramatic build, dark fantasy, loopable, 40 seconds"

Game Over:
"Dark melancholic piano, slow descending tone, dramatic ending, 15 seconds"

Victory:
"Heroic orchestral victory theme, uplifting resolution, bright ending, 15 seconds"

---

# PART 2 — AudioManager (Client)

Create:

client/src/systems/AudioManager.ts

Responsibilities:

- Unlock audio on first user interaction
- Manage:
  - Master volume
  - Music volume
  - SFX volume
- Layered music system:
  ambient layer
  combat layer
  boss layer
- Crossfade transitions (500ms)
- Prevent overlapping SFX spam

Public API:

init()
unlockAudio()
playMusic(type)
stopMusic()
playSFX(name)
setVolume(type, value)

---

# PART 3 — Dynamic Music System

## Music States

State 1: Menu
State 2: Dungeon Ambient
State 3: Combat
State 4: Boss
State 5: Game Over
State 6: Victory

---

## Dynamic Switching Rules

IF enemyCount > 0 → switch to Combat
IF bossActive → switch to Boss
IF playerHP < 30% → add heartbeat layer
IF no enemies for 5s → return to Ambient

---

## Movement-Based Audio

- Footstep every 200ms while moving
- Different pitch randomly
- Dash sound on space
- Shield activation sound

---

# PART 4 — Auto Start Audio

Because browser blocks autoplay:

Implement:

When user clicks anywhere OR presses key:
- Call audioManager.unlockAudio()
- Start menu music

Display overlay:

"Click to begin your descent"

Remove after first interaction.

---

# PART 5 — Integration Points

Hook into:

LevelScene:
- onEnemySpawn
- onEnemyKill
- onBossStart
- onBossDeath
- onPlayerHit
- onPlayerDeath
- onDash
- onShield

---

# PART 6 — Hackathon Upgrade (WOW MODE)

Add Dev Audio Overlay (F3):

Show:
- Current music state
- Active layers
- Cached assets
- API calls made
- Credit usage

Judges love visibility.

---

# PART 7 — Performance

- Preload music per level
- Use Web Audio API
- Decode once
- Reuse buffers
- Never block main thread

---

# PART 8 — Stability

If ElevenLabs fails:
- Use fallback local mp3
- Log warning
- Continue game

Game must never crash due to audio.

---

Deliver clean modular architecture.
No placeholder code.
Fully wired system.
Production-ready.