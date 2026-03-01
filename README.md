# Mistral Raid — The Watcher in the Depths

> **Hackathon:** Mistral Worldwide Hackathon | Feb 28 – Mar 1, 2026

A dungeon crawler with AI-generated audio, built toward a demo where the boss fights back — with words.

## Current State

**Working:** Full dungeon crawler — 5 levels, 4 characters, 5 weapons, 10 enemy types, 5 bosses, AI-generated SFX + music via ElevenLabs, adaptive music system.

**In progress (demo target):** Mistral AI boss brain, Voxstral STT/TTS voice debate, arena boss fight with mechanic system.

See [`docs/progress/tracker.md`](docs/progress/tracker.md) for what's done vs what needs to be built.

## Quick Start

```bash
# Install dependencies
npm install

# Run client (Vite dev server)
npm run dev          # → http://localhost:5173

# Run audio server (ElevenLabs SFX/music generation)
cd server
ELEVENLABS_API_KEY=xxx npm start   # → http://localhost:8787
```

## Project Structure

```
client/src/
  scenes/     — All 10 game scenes + AudioDebugOverlay
  entities/   — Player, BossEntity, Enemy, Item
  systems/    — AudioManager, LightingSystem, LootSystem, MiniMap, SaveSystem, ScoreSystem
  core/       — GameState, MazeGenerator, LevelConfig, BossFactory, EnemyFactory
  config/     — characters, weapons, enemies, bosses, items, constants, types

server/src/
  index.ts          — Express audio server on :8787
  routes/audio.ts   — /api/audio/* routes (generate, telemetry, categories, stats)
  services/         — ElevenLabs audio + music generation

docs/
  reference/        — Specs for every system
  progress/         — Tracker (current state vs demo target)
  plans/            — Implementation plans
```

## Docs

- [`docs/progress/tracker.md`](docs/progress/tracker.md) — What's built vs what's needed
- [`docs/reference/ai-integration.md`](docs/reference/ai-integration.md) — Audio system + Mistral rebuild spec
- [`docs/reference/scenes.md`](docs/reference/scenes.md) — All scenes
- [`docs/reference/dungeon-crawler.md`](docs/reference/dungeon-crawler.md) — LevelScene full spec
- [`docs/reference/characters.md`](docs/reference/characters.md) — Characters, GameState, save system
- [`docs/reference/mechanics.md`](docs/reference/mechanics.md) — 6 AI mechanic types (rebuild target)
- [`docs/reference/protocol.md`](docs/reference/protocol.md) — WebSocket protocol (rebuild target)
