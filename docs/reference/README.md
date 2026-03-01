# Mistral Raid — Documentation Index

> **Status key used across all docs:** ✅ Built | ⬜ Not yet built | 🗑️ Was built, removed

See [`docs/progress/tracker.md`](../progress/tracker.md) for the definitive **what's done vs what needs building**.

---

## Document Index

### Core Game (✅ All Implemented)
| Doc | Description |
|-----|-------------|
| [scenes.md](scenes.md) | All 11 registered scenes: flow, transitions, layout, behavior |
| [dungeon-crawler.md](dungeon-crawler.md) | LevelScene: procedural dungeons, combat, enemies, items, bosses |
| [characters.md](characters.md) | 4 characters, stats, inventory, save/load system |
| [game-behavior.md](game-behavior.md) | ArenaScene stub + deleted AI stack (files to rebuild) |

### AI & Network (⬜ Needs Building)
| Doc | Description |
|-----|-------------|
| [ai-integration.md](ai-integration.md) | **Start here for the demo.** What's built (ElevenLabs audio) + what to build (Mistral/Voxstral loop) |
| [protocol.md](protocol.md) | Current HTTP routes (audio) + WebSocket protocol to rebuild |
| [telemetry.md](telemetry.md) | TelemetryTracker spec (deleted — rebuild target) |

### Mechanics & UI (⬜ Needs Building)
| Doc | Description |
|-----|-------------|
| [mechanics.md](mechanics.md) | 6 AI mechanic types spec (deleted — rebuild target) |
| [ui-layout.md](ui-layout.md) | Arena HUD, DevConsole, overlays, TauntText (deleted — rebuild target) |

### Reference (✅ Accurate)
| Doc | Description |
|-----|-------------|
| [config-reference.md](config-reference.md) | All constants — active (dungeon) and rebuild targets (arena/AI) clearly labeled |
| [types.md](types.md) | All TypeScript interfaces — active dungeon types + deleted AI types labeled |

---

## Quick Start for Agents

**To understand what exists:** Read [tracker.md](../progress/tracker.md) first.

**To build the Mistral/Voxstral boss fight:**
1. [ai-integration.md](ai-integration.md) — full spec for Mistral + Voxstral + ElevenLabs TTS
2. [protocol.md](protocol.md) — WebSocket protocol + server routes
3. [game-behavior.md](game-behavior.md) — arena Boss class spec (Phase 1 attacks)
4. [mechanics.md](mechanics.md) — 6 mechanic classes to rebuild
5. [ui-layout.md](ui-layout.md) — HUD, DevConsole, AnalyzingOverlay, TauntText
6. [telemetry.md](telemetry.md) — TelemetryTracker fields
7. [types.md](types.md) — TelemetryPayload, BossResponse, WebSocket message types

**To understand the dungeon crawler (already built):**
1. [dungeon-crawler.md](dungeon-crawler.md) — LevelScene mechanics
2. [characters.md](characters.md) — GameState, inventory, save system
3. [scenes.md](scenes.md) — scene graph and transitions

---

## Tech Stack

```
Frontend:  Phaser 3.86 | TypeScript | Vite | port 5173
Backend:   Node.js 20+ | Express | port 8787
Audio:     ElevenLabs API (SFX + music generation) ✅ built
AI:        Mistral API (mistral-small-latest) ⬜ to build
Voice:     Voxstral STT + TTS ⬜ to build
```

## Non-Negotiable Constraints

1. **No eval()** — AI JSON maps to pre-built mechanic classes only
2. **Value clamping** — All AI-generated numerics are clamped server-side
3. **Fallback always works** — Game must function without any API connectivity
4. **DevConsole** — Must show the full AI pipeline (telemetry → model → response)
5. **WebSocket protocol** — Client/server messages must match [protocol.md](protocol.md)
