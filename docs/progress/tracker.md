# Mistral Raid — Task Progress Tracker

Last updated: 2026-02-28

---

## Phase A: Foundation (Tasks 1–5)

| Task | Description | Status | Plan | Notes |
|------|-------------|--------|------|-------|
| 1 | Project Scaffolding (monorepo, Vite, Express) | ✅ | — | |
| 2 | Shared Type Definitions (`shared/types.ts`) | ✅ | — | |
| 3 | Player Controller | ✅ | — | |
| 4 | Arena Scene Setup | ✅ | — | Depends on 1, 3 |
| 5 | Boss Entity Phase 1 (hard-coded attacks) | ✅ | — | Depends on 1, 4 |

## Phase B: Core Systems (Tasks 6–10)

| Task | Description | Status | Plan | Notes |
|------|-------------|--------|------|-------|
| 6 | Telemetry Tracker | ✅ | — | Depends on 3, 4 |
| 7 | WebSocket Client + Server | ✅ | — | Depends on 1, 2 |
| 8 | Mistral API Integration | ✅ | — | Depends on 2, 7 |
| 9 | ElevenLabs TTS Integration | ✅ | — | Depends on 7 |
| 10 | Mechanic Interpreter Engine | ✅ | — | Depends on 4, 2 |

## Phase C: Mechanic Lego Bricks (Tasks 11–16)

| Task | Description | Status | Plan | Notes |
|------|-------------|--------|------|-------|
| 11 | ProjectileSpawner | ✅ | — | Depends on 5, 10 |
| 12 | HazardZoneSpawner | ✅ | — | Depends on 4, 10 |
| 13 | LaserBeam | ✅ | — | Depends on 4, 10 |
| 14 | HomingOrb | ✅ | — | Depends on 4, 10 |
| 15 | WallOfDeath | ✅ | — | Depends on 4, 10 |
| 16 | MinionSpawner | ✅ | — | Depends on 4, 10 |

## Phase D: Integration (Tasks 17–20)

| Task | Description | Status | Plan | Notes |
|------|-------------|--------|------|-------|
| 17 | Phase Transition System | ✅ | — | Depends on 5, 6, 7, 10 — bugfix: guard updates during scene shutdown to avoid hit crash |
| 18 | Audio Manager | ✅ | — | Depends on 1 — bugfix: guard AudioContext failures and defer creation until user gesture |
| 19 | HUD and UI | ✅ | — | Depends on 4, 5 |
| 20 | Fallback Attack Configs | ✅ | — | Depends on 2 |

## Phase E: Polish & Demo (Tasks 21–25)

| Task | Description | Status | Plan | Notes |
|------|-------------|--------|------|-------|
| 21 | Particle Effects & Screen Shake | ✅ | — | Depends on 4 |
| 22 | Victory & Game Over Scenes | ✅ | — | Depends on 4 |
| 23 | Game Config & Constants | ✅ | — | Standalone |
| 24 | Boot Scene & Main Entry | ✅ | — | Depends on 4, 22 |
| 25 | Deployment | ✅ | — | Depends on all |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ❌ | Blocked |
| ⏭️ | Skipped (see notes) |

---

## Blockers

_(none yet)_

---

## Completed Plan Files

| Plan | Covers | Status |
|------|--------|--------|
| _(none yet)_ | | |

---

## Demo Checklist (Pre-Pitch — from specs.md §14)

- [ ] Game loads at public URL without errors
- [ ] Audio plays (AudioContext unlocks on first click)
- [ ] Phase 1 boss attacks work correctly
- [ ] Telemetry is being collected (check DevConsole with `D`)
- [ ] Phase transition animation plays
- [ ] Mistral API returns valid JSON (check server logs)
- [ ] ElevenLabs audio plays boss taunt
- [ ] Phase 2 mechanics spawn correctly
- [ ] All 6 mechanic types work
- [ ] Win state triggers correctly
- [ ] Game Over state triggers correctly
- [ ] Retry works (full reset, new telemetry, new generation)
- [ ] DevConsole shows complete pipeline
- [ ] Fallback works when API is slow/down
- [ ] Record 60-second backup demo video
- [ ] Set `DEMO_MODE=true` for pitch (uses mistral-large)
