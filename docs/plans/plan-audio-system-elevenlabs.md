# 🎮 MISTRAL RAID — Global Audio System
## Dungeon Mode — Full Immersive Sound Architecture
### ElevenLabs Integration (API key stored in .env as ELEVENLABS_API_KEY)

---

# 🎯 OBJECTIVE

You are a Senior Game Audio Engineer + Full Stack TypeScript Architect.

Design and implement a complete AAA-quality dynamic audio system for **Mistral Raid**.

The system must:

- Generate immersive dungeon-style audio
- React dynamically to gameplay events
- Use ElevenLabs API for sound generation
- Scale for future AI-driven adaptive music
- Be production-ready for hackathon demo
- Be modular, memory-safe, and scalable

Do NOT explain theory.  
Generate full working code.

---

# 🏗 PROJECT STRUCTURE

Create the following architecture:


server/
└── src/services/elevenlabsAudioService.ts
└── scripts/generateDungeonAudio.ts

client/
└── src/systems/AudioManager.ts
└── src/systems/AudioDebugOverlay.ts
└── src/types/AudioTypes.ts

assets/
└── audio/
├── ambient/
├── combat/
├── movement/
├── enemies/
├── boss/
├── ui/
├── interaction/
├── music/
└── credits/


---

# 🔐 ELEVENLABS INTEGRATION

The API key is stored in:


process.env.ELEVENLABS_API_KEY


Implement:

- Sound generation service
- Batch generation script
- Automatic MP3 saving
- Error handling
- Fallback sound if API fails
- No narration, no voice
- Pure SFX / ambient / music

---

# 🎵 MUSIC SYSTEM (CRITICAL)

## 🎼 Menu Music
- Dark ambient dungeon loop
- Low intensity
- Ancient mysterious mood
- Balanced volume
- Loopable

---

## 🎼 In-Game Dungeon Music

Base Layer:
- Wind
- Dripping water
- Low dungeon rumble

Combat Layer:
- Subtle percussion

High Tension Layer:
- Fast percussion
- Low string tremolo

Critical HP Layer:
- Heartbeat synced

Rules:
- HP < 30% → increase intensity
- HP critical → add heartbeat
- Boss room → suspense build
- Boss fight → cinematic layered system
- Boss HP scaling → dynamic intensity scaling
- Smooth crossfades required

---

## 🎼 Credits Music
- Emotional orchestral theme
- Soft choir pad
- Heroic resolution
- Balanced mix
- Fade in / fade out

---

# 🔊 SOUND CATEGORIES

Implement ALL categories:

## A. Pre-Game / Menu
- UI hover
- Confirm select
- Open/close whoosh

## B. Dungeon Ambient
Dynamic intensity system

## C. Movement
- Footstep stone (200ms cooldown)
- Dash overrides movement
- Shield shimmer

## D. Combat
Weapon differentiated:
- Sword
- Dagger
- Katana
- Hammer
- Bomb

Player hit
Player death

## E. Enemy Sounds
- Goblin
- Orc
- Skeleton
- Elemental
- Zombie

Kill reward:
- Coin drop
- XP tone

## F. Boss System
Before boss:
- Suspense layer

Boss intro:
- Cinematic hit

During fight:
- Layered combat music
- Dynamic intensity

Boss death:
- Slow motion
- Echo explosion
- Victory swell

## G. Interaction
- Chest open
- Potion drink
- Item pickup
- Door open
- Stairs descent

## H. UI / Inventory
- Inventory open
- Weapon swap
- Potion select
- Pause whoosh

## I. Game Over
- Descending piano
- Echo fade

## J. Victory
- Orchestral hit
- Choir pad
- Harmonic resolution

---

# ⚙️ AUDIO MANAGER REQUIREMENTS

Implement in `AudioManager.ts`:

- Web Audio API
- Master Gain Node
- Music Gain Node
- SFX Gain Node
- Independent volume sliders
- Music ON/OFF toggle
- SFX ON/OFF toggle
- Persistent settings (localStorage)
- Volume ducking during boss speech
- Cooldown control per SFX
- Prevent overlapping spam
- Spatial panning
- Layer blending
- Smooth crossfades
- Preload system
- Memory cleanup

---

# 🎮 PLAYER-DEPENDENT AUTOMATIC AUDIO

Implement automatic triggers based on:

- Movement state
- Dash action
- Shield activation
- Weapon type
- Enemy proximity
- Player HP
- Boss HP
- Damage taken

Music intensity scales dynamically.

---

# 🧠 FUTURE AI ADAPTIVE MODE (ARCHITECTURE READY)

Prepare system for telemetry:


{
hp,
bossHp,
enemyCount,
recentDamageTaken
}


Backend returns:


{
musicMood,
addLayer,
volumeMultiplier
}


AudioManager adapts accordingly.

---

# 🎛 OPTIONS MENU

Implement:

- Master volume slider
- Music volume slider
- SFX volume slider
- Music ON/OFF
- SFX ON/OFF
- Persistent via localStorage

If OFF:
- Stop music immediately
- Block new SFX triggers

---

# 🧪 HACKATHON DEBUG MODE

Press F2:

Display overlay showing:
- Active music layers
- Active SFX
- Intensity level
- Player HP
- Boss HP
- Volume levels
- Current state

Overlay must look clean and impressive.

---

# 🎼 ELEVENLABS PROMPT STRATEGY

Use detailed prompts such as:

"Loopable dark dungeon ambient background with subtle wind and dripping water, immersive, cinematic, no melody, 30 seconds"

"Short 0.3 second metallic sword slash in a dark stone dungeon, high impact, clean transient"

"Epic cinematic boss intro deep percussion hit with heavy reverb tail"

"Emotional orchestral end credits music with soft choir pad and heroic resolution, cinematic, 60 seconds"

All sounds:
- Clean
- Balanced
- No clipping
- Game ready

---

# 🚀 PRODUCTION GOALS

- No audio delay
- No glitches
- No memory leaks
- Modular structure
- Type-safe TypeScript
- Clean comments
- Scalable for Arena AI mode

---

# 🎯 FINAL DELIVERABLES

Claude must generate:

1. elevenlabsAudioService.ts
2. generateDungeonAudio.ts
3. Full AudioManager.ts
4. AudioDebugOverlay.ts
5. Audio types
6. Example integration in game loop
7. Boss cinematic system
8. Credits music system
9. Dynamic adaptive layering logic
10. Clean modular structure

Make it AAA quality.  
Make it hackathon impressive.  
Make it production ready.  
Do not explain theory.  
Generate complete working code.