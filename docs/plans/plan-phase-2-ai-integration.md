# Plan: Phase 2 — AI Integration (Arena Prototype Wiring)

**Spec Tasks:** AI integration wiring, telemetry, WebSocket, mechanics bridge
**Beads ID:** _(create with `bd create --title="Phase 2: AI integration wiring" --type=feature --priority=1`)_
**Status:** DRAFT
**Created:** 2026-02-28
**Dependencies:** Phase 1 dungeon crawler complete; server AI stack available; docs/reference locked

---

## Objective

Wire the existing AI stack into gameplay so the arena prototype becomes playable end to end. The goal is a complete flow: collect telemetry, send to server, receive BossResponse and audio, render taunt, and spawn mechanics during Phase 2.

---

## Sources of Truth

- `docs/reference/ai-integration.md`
- `docs/reference/protocol.md`
- `docs/reference/telemetry.md`
- `docs/reference/mechanics.md`
- `docs/reference/ui-layout.md`
- `docs/reference/types.md`
- `docs/reference/game-behavior.md`

---

## Scope

**In scope**
- ArenaScene wiring and scene registration
- Telemetry tracking and analyze trigger
- WebSocket client integration and message handling
- DevConsole, AnalyzingOverlay, TauntText usage
- MechanicInterpreter activation for 6 mechanic types
- Fallback handling when AI fails

**Out of scope**
- Dungeon crawler gameplay changes
- New content or asset creation
- Multiplayer or co-op

---

## Implementation Steps

### Step 1: Register ArenaScene and AI UI

**Goal:** Ensure ArenaScene is reachable and UI utilities can be instantiated.

**Tasks**
1. Add `ArenaScene` to `client/src/main.ts` scene list
2. Verify ArenaScene boot flow (Boot -> Menu -> Arena or a direct entry flag)
3. Instantiate `HUD`, `DevConsole`, `AnalyzingOverlay`, and `TauntText` inside ArenaScene
4. Confirm `D` toggles DevConsole

**Acceptance criteria**
1. ArenaScene loads and renders the arena
2. DevConsole toggles on key press
3. AnalyzingOverlay can be shown and hidden

---

### Step 2: Telemetry Capture

**Goal:** Capture gameplay telemetry during Phase 1.

**Tasks**
1. Instantiate `TelemetryTracker`
2. Start tracking during Phase 1 only
3. Stop tracking at transition
4. Ensure payload matches `TelemetryPayload` in `docs/reference/types.md`

**Acceptance criteria**
1. Telemetry data is populated and valid
2. Heatmap percentages sum correctly

---

### Step 3: WebSocket Wiring

**Goal:** Send telemetry and receive AI response.

**Tasks**
1. Connect WebSocket client to server using `protocol.md`
2. Send `ANALYZE` with telemetry at phase transition
3. Handle `BOSS_RESPONSE`, `AUDIO_READY`, and `ERROR`

**Acceptance criteria**
1. Server receives telemetry and responds
2. Client processes each message type without errors

---

### Step 4: Phase Transition Flow

**Goal:** Implement the full transition sequence.

**Tasks**
1. On boss HP <= threshold, pause attacks and show AnalyzingOverlay
2. Send telemetry and await response (timeout handled)
3. Display taunt text and play audio when available
4. Resume combat and activate AI mechanics

**Acceptance criteria**
1. Phase transition is visible and timed correctly
2. No hangs or stuck overlays on failures

---

### Step 5: Mechanic Interpreter Activation

**Goal:** Spawn AI mechanics from BossResponse.

**Tasks**
1. Pass BossResponse mechanics to `MechanicInterpreter`
2. Validate all 6 mechanic types spawn correctly
3. Ensure mechanics terminate after duration

**Acceptance criteria**
1. Each mechanic type is observable and behaves as expected
2. Mechanics can run concurrently with boss attacks

---

### Step 6: Fallback Handling

**Goal:** Ensure gameplay continues without API access.

**Tasks**
1. On `ERROR` message, use the server fallback payload
2. If the server is unreachable, optionally use client fallback list (if wired)
3. Log fallback in DevConsole

**Acceptance criteria**
1. Game continues after simulated API failure
2. DevConsole clearly shows fallback path

---

## Test Plan

- Use `docs/plans/plan-tests-e2e.md` optional AI prototype section
- Add a dedicated smoke route to ensure transition always completes within timeout

---

## Exit Criteria

1. ArenaScene is fully playable with AI phase transition
2. All AI messages and mechanics are visible in DevConsole
3. Fallback works with missing API keys
4. No critical errors in browser console

---

*Last updated: 2026-02-28*
