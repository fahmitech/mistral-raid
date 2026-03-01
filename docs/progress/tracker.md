# Mistral Raid — Task Progress Tracker

Last updated: 2026-03-01

> **Goal:** See [demo-scripts.md](../demo-scripts.md) for the target demo.
> This tracker reflects **current codebase reality**, not the original plan.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and working |
| ⚠️ | Partially implemented |
| ⬜ | Not yet built |
| 🗑️ | Was built, then removed |

---

## Dungeon Crawler — DONE ✅

The full dungeon crawler is implemented and playable.

| Feature | Status | Notes |
|---------|--------|-------|
| Project scaffolding (Vite + Express monorepo) | ✅ | |
| Procedural dungeon generation (MazeGenerator) | ✅ | BSP/random room placement |
| 5 dungeon levels (config-driven) | ✅ | THE DUNGEON ENTRANCE → THE ABYSS |
| 4 playable characters | ✅ | Knight, Rogue, Mage, Paladin |
| 5 weapons with distinct behavior | ✅ | Sword, Dagger, Katana, Hammer, Bomb |
| 10 enemy types with AI | ✅ | MeleeChase, Ranged, Shielded, Exploder, etc. |
| 5 bosses (one per level) | ✅ | BossEntity with phase tint + multi-phase |
| Player entity (dungeon crawler) | ✅ | WASD, dash, shoot, weapon cycle |
| Inventory system | ✅ | Weapons + items, rarity, equip |
| Save / load system | ✅ | localStorage, auto-save on boss kill / stairs |
| Loot system (chests, drops, coins) | ✅ | Weighted drop table |
| Lighting / fog-of-war system | ✅ | LightingSystem, darkness tiles |
| Minimap | ✅ | MiniMap system |
| Score system | ✅ | ScoreSystem |
| All 10 scenes + AudioDebugOverlay | ✅ | Boot, Menu, PlayerSelect, Level, Pause, Inventory, Options, Credits, GameOver, Victory |

---

## Audio — DONE ✅

| Feature | Status | Notes |
|---------|--------|-------|
| ElevenLabs audio server | ✅ | Express server on :8787, generates SFX + music from text prompts |
| 40+ SFX categories (server-side library) | ✅ | menu, movement, combat, boss, interactions, UI, global presence |
| 7 music tracks (server-side) | ✅ | menu, dungeon ambient, combat, boss, game-over, victory, credits |
| Static MP3s preloaded in BootScene | ✅ | client/public/audio/ — fallback for when server is down |
| AudioManager singleton (Web Audio API) | ✅ | Master/music/sfx gain graph, LRU buffer cache |
| Fallback oscillator tones | ✅ | Per-SFX synthetic tones when server not available |
| Adaptive music telemetry loop | ✅ | Client → POST /api/audio/telemetry → mood/volumeMultiplier → AudioManager |
| Per-weapon SFX | ✅ | Sword, Dagger, Katana, Hammer, Bomb each have distinct sounds |
| Spatialized SFX (distance + pan) | ✅ | playSFXAt() with distance attenuation |
| Heartbeat at low HP | ✅ | startHeartbeat() triggers at <30% HP |
| Persistent volume settings (localStorage) | ✅ | master, music, sfx volumes saved |
| AudioDebugOverlay scene | ✅ | Debug view of audio state |
| Options: Sound on/off, Music on/off | ✅ | Hooked into AudioManager via setOptions() |

---

## Demo Target — NOT YET BUILT ⬜

These are the features required by [demo-scripts.md](../demo-scripts.md) that **do not exist in the codebase**.

### Voxstral STT (Speech-to-Text)

| Feature | Status | Notes |
|---------|--------|-------|
| Microphone input capture (browser) | ⬜ | |
| Voxstral STT streaming transcription | ⬜ | Continuous mic → text |
| Speech transcript → server pipeline | ⬜ | |

### Mistral AI Boss Brain

| Feature | Status | Notes |
|---------|--------|-------|
| WebSocket server (client ↔ server realtime) | ⬜ | Was built, then removed |
| Mistral API integration (server) | ⬜ | Was built, then removed |
| User prompt construction (speech + telemetry) | ⬜ | |
| THE ARCHITECT system prompt | ⬜ | See ai-integration.md for full spec |
| Response validation + value clamping | ⬜ | |
| Cascade fallback (small → 8b → cached) | ⬜ | |
| Partial salvage + merge logic | ⬜ | |

### Voxstral TTS (Boss Voice)

| Feature | Status | Notes |
|---------|--------|-------|
| ElevenLabs TTS for boss taunt text | ⬜ | Different from SFX/music generation |
| Boss voice audio playback in-game | ⬜ | |
| Audio ducking during boss voice | ⬜ | duckMusic() method exists in AudioManager |

### Arena Boss Fight

| Feature | Status | Notes |
|---------|--------|-------|
| Arena scene (registered + active) | ⬜ | ArenaScene.ts exists but is a static stub, not registered |
| Phase 1 boss fight (hardcoded attacks) | ⬜ | Was built, then removed |
| Telemetry tracker (heatmap, dodge bias, accuracy, etc.) | ⬜ | Was built, then removed |
| Phase transition system | ⬜ | Was built, then removed |
| Mechanic interpreter engine | ⬜ | Was built, then removed |
| ProjectileSpawner mechanic | ⬜ | Was built, then removed |
| HazardZoneSpawner mechanic | ⬜ | Was built, then removed |
| LaserBeam mechanic | ⬜ | Was built, then removed |
| HomingOrb mechanic | ⬜ | Was built, then removed |
| WallOfDeath mechanic | ⬜ | Was built, then removed |
| MinionSpawner mechanic | ⬜ | Was built, then removed |
| TauntText overlay | ⬜ | Was built, then removed |
| AnalyzingOverlay | ⬜ | Was built, then removed |
| DevConsole debug overlay | ⬜ | Was built, then removed |
| Arena HUD (boss HP bar + player HP bar + phase) | ⬜ | Was built, then removed |
| Fallback attack configs | ⬜ | Was built, then removed |
| Win/loss state for arena | ⬜ | |

### AI Dungeon Director

| Feature | Status | Notes |
|---------|--------|-------|
| Dungeon telemetry (HP, kills, damage/min) | ⬜ | |
| Mistral difficulty adjustment (difficultyDelta, enemyBias, lootBias) | ⬜ | |
| F5 Director debug panel | ⬜ | |
| Enemy type bias applied to next room | ⬜ | |

---

## Previously Removed (Reference)

These features were implemented but removed in the "Remove AI Dungeon Director" commit. They need to be rebuilt for the demo.

| System | Files deleted |
|--------|--------------|
| Mistral API client | `server/src/routes/mistral.ts` (or similar) |
| WebSocket server | `server/src/ws.ts` (or similar) |
| WebSocket client | `client/src/network/WebSocketClient.ts` |
| Telemetry tracker | `client/src/systems/TelemetryTracker.ts` |
| Mechanic interpreter | `client/src/systems/MechanicInterpreter.ts` |
| 6 mechanic classes | `client/src/mechanics/*` |
| Arena combat player | `client/src/entities/Player.ts` (old version — replaced by dungeon Player) |
| Arena boss entity | `client/src/entities/Boss.ts` (replaced by BossEntity.ts) |
| Arena HUD | `client/src/ui/HUD.ts` |
| DevConsole | `client/src/ui/DevConsole.ts` |
| AnalyzingOverlay | `client/src/ui/AnalyzingOverlay.ts` |
| TauntText | `client/src/ui/TauntText.ts` |
| Fallback attack configs | `client/src/config/fallbackAttacks.ts` |
| Arena game config | `client/src/config/gameConfig.ts` |

---

## Demo Checklist (Rebuild Target)

From [demo-scripts.md](../demo-scripts.md):

- [ ] Mic input captured in browser
- [ ] Voxstral STT transcribes player speech in real time
- [ ] Mistral receives speech + telemetry → returns taunt + mechanics
- [ ] Voxstral TTS speaks boss taunt out loud
- [ ] ElevenLabs SFX + music play correctly (already works ✅)
- [ ] Arena boss fight active with Phase 1 hardcoded attacks
- [ ] Phase transition animation plays
- [ ] Phase 2 mechanics spawn from Mistral response
- [ ] All 6 mechanic types work
- [ ] TauntText displayed during boss reply
- [ ] AnalyzingOverlay shown during Mistral call
- [ ] DevConsole shows pipeline (telemetry → model → response)
- [ ] AI Dungeon Director adjusts enemies between rooms
- [ ] F5 Director debug panel visible
- [ ] Server logs show full pipeline
- [ ] Fallback works when API is slow/down
- [ ] Win/loss state works for arena fight
