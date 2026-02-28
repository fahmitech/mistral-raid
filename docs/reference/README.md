# Mistral Raid — Documentation

> **Purpose:** Implementation-agnostic specifications for building Mistral Raid's functionality.
> These docs describe **what** the system does, not **how** it's coded.
> Use any framework, language, or architecture — the e2e tests are the acceptance criteria.

**Snapshot date:** Feb 28, 2026

---

## Document Index

### Core Game
| Doc | Description |
|-----|-------------|
| [scenes.md](scenes.md) | All 10 scenes: flow, transitions, layout, behavior |
| [dungeon-crawler.md](dungeon-crawler.md) | LevelScene: procedural dungeons, combat, enemies, items, bosses |
| [characters.md](characters.md) | 4 character classes, stats, inventory, save/load system |
| [game-behavior.md](game-behavior.md) | Arena stub + unused AI stack (current code reality) |

### AI & Network
| Doc | Description |
|-----|-------------|
| [protocol.md](protocol.md) | WebSocket & HTTP API protocol — exact message formats and sequences |
| [ai-integration.md](ai-integration.md) | Mistral exact prompts, ElevenLabs TTS, validation, fallback |
| [telemetry.md](telemetry.md) | Telemetry collection system — what's tracked, how, and when |

### Mechanics & UI
| Doc | Description |
|-----|-------------|
| [mechanics.md](mechanics.md) | All 6 AI mechanic types — behavior, parameters, visuals, damage |
| [ui-layout.md](ui-layout.md) | HUD, DevConsole, overlays, taunt text — layout and visual spec |

### Reference
| Doc | Description |
|-----|-------------|
| [config-reference.md](config-reference.md) | All constants: stats, levels, enemies, items, clamping, audio |
| [types.md](types.md) | All data contracts (TypeScript interfaces as reference) |

## Acceptance Criteria

The [E2E Test Plan](../plans/plan-tests-e2e.md) serves as the primary acceptance criteria.
An implementation is correct when all e2e tests pass.

## Quick Start for Implementation

1. Read [scenes.md](scenes.md) for the full scene graph and game flow
2. Read [dungeon-crawler.md](dungeon-crawler.md) for core gameplay mechanics
3. Read [characters.md](characters.md) for character/state/save system
4. Read [types.md](types.md) for all data contracts
5. Read [protocol.md](protocol.md) + [ai-integration.md](ai-integration.md) for server
6. Read [config-reference.md](config-reference.md) for all tunable values
7. Implement server (Mistral + ElevenLabs + WebSocket)
8. Implement client (game engine + dungeon + mechanics + UI)
9. Run the e2e test suite to verify correctness

## Tech Stack (Original)

A typical implementation uses these technologies, but you may choose differently:

```
Frontend:  Phaser 3.80+ | TypeScript | Vite | port 5173
Backend:   Node.js 20+ | Express | ws | port 8787
AI:        Mistral API (mistral-small-latest)
Voice:     ElevenLabs API (eleven_flash_v2_5)
Deploy:    Single service (backend serves static frontend)
```

## Non-Negotiable Constraints

If you implement the AI arena prototype (or wire the AI stack into gameplay), these constraints must be preserved:

1. **No eval()** — AI JSON maps to pre-built mechanic classes, never executed as code
2. **Value clamping** — All AI-generated numeric values are clamped to safe ranges
3. **Fallback always works** — Game must function without any API connectivity
4. **DevConsole is critical** — Debug overlay must show the full AI pipeline
5. **WebSocket protocol** — Client-server messages must match the [protocol spec](protocol.md)
