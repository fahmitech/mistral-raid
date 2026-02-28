# TASK: Full Dynamic Audio System Integration (ElevenLabs Generated Assets)

## Context

Project: Mistral Raid  
Engine: Phaser 3  
Audio Assets: Generated via ElevenLabs Text-to-Sound API  
Files located in: client/public/audio/

The following audio files already exist:

- dungeon_ambient.mp3
- combat_music.mp3
- boss_music.mp3
- sword_attack.mp3
- player_hit.mp3
- boss_roar.mp3
- game_over.mp3
- victory_music.mp3
- footstep.mp3
- dash.mp3
- shield_activate.mp3
- menu_theme.mp3
- credits_theme.mp3

Goal:
Implement a professional-grade global audio system across the entire game.

---

# PART 1 — AudioManager Architecture

Create:

client/src/systems/AudioManager.ts

Requirements:

- Singleton pattern
- Centralized audio control
- Separate channels:
  - music
  - sfx
  - ambient
- Volume controls
- Crossfade system (500ms fade)
- Prevent overlapping SFX spam

Public API:

init(scene)
unlockAudio()
playMusic(key)
stopMusic()
crossFade(newTrack)
playSFX(key)
setMasterVolume(value)
setMusicVolume(value)
setSFXVolume(value)

---

# PART 2 — Auto Unlock Audio

Because browsers block autoplay:

On first user click OR key press:
- Call audioManager.unlockAudio()
- Start menu_theme

Display overlay:
"Click to Enter the Dungeon"

Remove overlay after unlock.

---

# PART 3 — Music States

Implement global music states:

1. MENU → menu_theme
2. DUNGEON_IDLE → dungeon_ambient (loop)
3. COMBAT → combat_music (crossfade)
4. BOSS → boss_music (crossfade + boss_roar once)
5. GAME_OVER → game_over
6. VICTORY → victory_music
7. CREDITS → credits_theme

Rules:

- If enemies present → COMBAT
- If boss active → BOSS
- If no enemies for 5 seconds → DUNGEON_IDLE
- If player HP < 30% → slightly increase music volume + low filter effect

---

# PART 4 — Movement-Based Sound

In Player update loop:

If velocity > 0:
- Every 200ms play footstep
- Randomize pitch slightly (0.95–1.05)

On Dash:
- play dash.mp3

On Shield:
- play shield_activate.mp3

On Sword Attack:
- play sword_attack.mp3

On Player Hit:
- play player_hit.mp3

On Enemy Death:
- play short hit confirmation sound

---

# PART 5 — Credits Scene

When entering CreditsScene:
- Stop current music
- Crossfade to credits_theme
- Lower master volume slightly
- Add subtle ambient reverb

---

# PART 6 — Preload Strategy

In BootScene preload:

this.load.audio('dungeon_ambient', 'audio/dungeon_ambient.mp3')
this.load.audio('combat_music', 'audio/combat_music.mp3')
this.load.audio('boss_music', 'audio/boss_music.mp3')
this.load.audio('menu_theme', 'audio/menu_theme.mp3')
this.load.audio('credits_theme', 'audio/credits_theme.mp3')
this.load.audio('game_over', 'audio/game_over.mp3')
this.load.audio('victory_music', 'audio/victory_music.mp3')
this.load.audio('footstep', 'audio/footstep.mp3')
this.load.audio('dash', 'audio/dash.mp3')
this.load.audio('shield_activate', 'audio/shield_activate.mp3')
this.load.audio('sword_attack', 'audio/sword_attack.mp3')
this.load.audio('player_hit', 'audio/player_hit.mp3')
this.load.audio('boss_roar', 'audio/boss_roar.mp3')

---

# PART 7 — Performance Rules

- All music looped
- Only one music track active at a time
- SFX pooled
- Do NOT generate audio during gameplay
- No API calls during game runtime

---

# PART 8 — Hackathon WOW Feature

Add debug overlay (F4):

Show:

- Current music state
- Active track
- SFX triggered per second
- Master volume level

---

# Expected Result

- Music plays on menu after click
- Music transitions smoothly
- Combat feels reactive
- Boss fight feels cinematic
- Credits has its own theme
- No crashes
- Clean architecture
- Production ready

Deliver modular clean TypeScript implementation.
No placeholder logic.
Fully integrated with LevelScene and MenuScene.