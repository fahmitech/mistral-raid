# MISTRAL RAID — The Watcher in the Depths
## Narrative + Product Overview (Aligned with current build)
### Mistral Worldwide Hackathon | Feb 28 - Mar 1, 2026

---

## 0. The Story (Why the game exists)

Mistral Raid is not a story about a hero. It is a story about a place that
watches you.

You descend into a ruined dungeon. It is cold, tiled, and quiet. Enemies
shuffle between rooms, treasure flickers in the dark, and torches breathe
in the corners. At the end of each level, a boss waits. It is not the same
creature every time. Each one tests a different weakness. The deeper you go,
the more it feels like the dungeon remembers your choices.

At the end of the descent, The Watcher waits. It is old, patient, and merciless.
The final fight is a culmination of the crawl: your inventory, your movement
habits, and your resource decisions all matter.

This snapshot focuses on the dungeon crawler experience. A prototype arena
AI stack exists in code but is not wired into the current gameplay loop.

---

## 1. Game Structure (Current Build)

### Primary Mode: Dungeon Crawl
- 5 levels, each with a procedurally generated maze
- 10 enemy types, 5 bosses (one per level)
- Loot, potions, weapons, and coins
- Save/load via localStorage
- End states: Victory or Game Over

### Scene Flow (Active)
- Boot -> Menu -> PlayerSelect -> LevelScene
- Inventory, Options, Pause, Credits are accessible via UI/keys
- Victory and GameOver are triggered by boss defeat or player death

### Arena Prototype (Inactive)
- ArenaScene exists but is not registered in main scene list
- AI telemetry, Mistral prompt pipeline, and DevConsole are wired for Arena
- This stack is present for future wiring but unused today

---

## 2. Architecture Snapshot

### Client (Phaser)
- LevelScene is the core gameplay loop (dungeon crawler)
- MazeGenerator builds room-and-corridor layouts
- EnemyFactory, BossFactory, ItemFactory drive content
- GameState, SaveSystem, AudioManager maintain state and feedback

### Server (Express + ws)
- Mistral + ElevenLabs integrations exist
- Response validation and fallback handling are implemented
- No runtime client usage in the current LevelScene build

---

## 3. Art Direction

The current implementation uses pixel art sprites (not geometric primitives).
A custom asset pack is supplied in `assets/0x72/frames/`. See
`docs/reference/ui-layout.md` for sprite mappings and missing boss assets.

---

## 4. Implementation Anchors

For exact behavior, values, and data contracts, use:
- `docs/reference/scenes.md`
- `docs/reference/dungeon-crawler.md`
- `docs/reference/characters.md`
- `docs/reference/config-reference.md`
- `docs/reference/ai-integration.md`
- `docs/reference/types.md`

---

*Last updated: 2026-02-28*
