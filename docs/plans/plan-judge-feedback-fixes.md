# Plan: Judge Feedback Fixes

**Status:** COMPLETED
**Created:** 2026-03-08
**Completed:** 2026-03-08
**Score Impact:** 80 → target 90+ (address all 3 weaknesses + 2 fast-fix suggestions)
**Dependencies:** None

---

## Objective

Address all weaknesses and fast-fix suggestions from the hackathon evaluation:

1. **No test files** — add unit tests for telemetry tracking and core game systems
2. **4-second latency timeout** — reduce perceived and actual latency in STT→LLM→TTS pipeline
3. **Game balance hard to tune** — document all balance parameters with rationale

---

## Scope

**In scope:**
- Unit tests for telemetry processing (server + client)
- Unit tests for game balance systems (crit, difficulty scaling)
- Latency parameter tuning (env vars + code defaults)
- Balance parameter documentation
- "Boss is thinking" client-side indicator to mask perceived latency

**Out of scope:**
- E2E / integration tests (separate plan exists: `plan-tests-e2e.md`)
- Actual game rebalancing (only documenting current values + adding tunability)
- Rewriting the STT/TTS pipeline architecture

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/__tests__/telemetryProcessor.test.ts` | CREATE | Unit tests for ingest, buildSummary, computeWindowStats |
| `server/src/services/__tests__/mistralService.test.ts` | CREATE | Unit tests for model cascade, timeout, fallback behavior |
| `server/src/services/__tests__/sessionManager.test.ts` | CREATE | Unit tests for cooldown logic, turn state transitions |
| `client/src/systems/__tests__/CritSystem.test.ts` | CREATE | Unit tests for crit calculation, hit counter, cap |
| `client/src/systems/__tests__/DifficultyManager.test.ts` | CREATE | Unit tests for difficulty preset application |
| `client/src/systems/__tests__/TelemetryTracker.test.ts` | CREATE | Unit tests for zone classification, accuracy, compile() |
| `docs/reference/balance-guide.md` | CREATE | All balance parameters, ranges, tuning rationale |
| `server/src/services/sessionManager.ts` | MODIFY | Reduce BOSS_REPLY_COOLDOWN_MS default 4000→2000 |
| `client/src/scenes/ArenaScene.ts` | MODIFY | Add "boss thinking" visual indicator |
| `server/.env.example` | MODIFY | Document latency-tuning env vars |

---

## Implementation Steps

### Step 1: Server-Side Telemetry Tests

**File:** `server/src/services/__tests__/telemetryProcessor.test.ts`

**What:** Unit tests for the core telemetry aggregation logic — the most testable, highest-impact target.

**Key details:**
- Test `ingest()` with mock RawTelemetry samples across time windows
- Test `buildSummary()` accuracy calculation: hits/shots ratio
- Test `computeWindowStats()` corner percentage with known zone positions
- Test window pruning: samples outside 10s/120s windows should be discarded
- Test edge cases: zero shots fired, all corners, no dashes

**Test cases:**
```
1. Accuracy: 5 hits / 10 shots → avgAccuracy = 0.5
2. Corner %: 3/10 samples in corner zones → cornerPercentageLast10s = 0.3
3. Dash count: delta between consecutive samples
4. Zone dominance: majority samples in mid_center → dominantZone = "mid_center"
5. Window pruning: 15s-old sample excluded from 10s window
6. Empty input: no samples → safe defaults (0 accuracy, no dominant zone)
```

**Acceptance criteria:**
- [x] 6+ test cases covering core aggregation
- [x] Tests run with `vitest` or `jest` (match existing tooling)
- [x] All tests pass

---

### Step 2: Session Manager & Cascade Tests

**File:** `server/src/services/__tests__/sessionManager.test.ts`

**What:** Test cooldown logic and turn state machine.

**Test cases:**
```
1. canStartBossReply() returns false when turnState = 'THINKING'
2. canStartBossReply() returns false when turnState = 'AI_SPEAKING'
3. canStartBossReply() returns false within cooldown window
4. canStartBossReply() returns true after cooldown expires
5. handleBargeIn() resets state to LISTENING
```

**File:** `server/src/services/__tests__/mistralService.test.ts`

**What:** Test model cascade selection and fallback behavior.

**Test cases:**
```
1. fastMode=true uses VOICE_CASCADE (ministral-8b first)
2. fastMode=false uses MODEL_CASCADE (mistral-small first)
3. All models fail → returns FALLBACK_RESPONSE
4. LLM_TIMEOUT_MS env override is respected
```

**Acceptance criteria:**
- [x] Turn state transitions tested
- [x] Cascade selection logic tested
- [x] Fallback behavior verified

---

### Step 3: Client-Side Game System Tests

**File:** `client/src/systems/__tests__/CritSystem.test.ts`

**What:** Test critical hit calculation — pure math, no Phaser dependency.

**Test cases:**
```
1. calculateDamage() with critChance=0 never crits (seeded random or mock)
2. calculateDamage() with critChance=1.0 always crits
3. updateHitCounter() at 10 hits adds +0.02 to critChance
4. critChance capped at CRIT_CAP (0.4) regardless of hits
5. Hit counter resets properly between phases
```

**File:** `client/src/systems/__tests__/DifficultyManager.test.ts`

**What:** Test difficulty preset multiplier application.

**Test cases:**
```
1. Easy preset: enemyHpMult=0.7, playerDamageMult=1.2
2. Hard preset: bossHpMult=1.4, bossAiThrottleMs=0
3. Medium is identity (all multipliers 1.0 or 0)
4. Multipliers applied correctly to base enemy/boss stats
```

**File:** `client/src/systems/__tests__/TelemetryTracker.test.ts`

**What:** Test zone grid classification and compile() output structure.

**Test cases:**
```
1. Position (100, 100) → zone "top_left" (X<426.7, Y<240)
2. Position (640, 360) → zone "mid_center"
3. Position (1200, 650) → zone "bot_right"
4. compile() returns all required fields (accuracy, heatmap, dodgeBias, etc.)
5. startPhase() resets all counters
```

**Acceptance criteria:**
- [x] CritSystem fully tested without Phaser dependency
- [x] DifficultyManager presets verified
- [x] TelemetryTracker zone logic tested
- [x] All tests pass independently (no game runtime needed)

---

### Step 4: Reduce Latency Defaults

**File:** `server/src/services/sessionManager.ts`

**What:** Reduce `BOSS_REPLY_COOLDOWN_MS` from 4000→2000. This is the single biggest perceived latency fix — it's a wait gate, not a processing constraint.

**Change:**
```typescript
// Before
const BOSS_REPLY_COOLDOWN_MS = Number(process.env.BOSS_REPLY_COOLDOWN_MS ?? 4000);
// After
const BOSS_REPLY_COOLDOWN_MS = Number(process.env.BOSS_REPLY_COOLDOWN_MS ?? 2000);
```

**File:** `server/.env.example` (or create)

**What:** Document all latency-tuning env vars so judges see intentional configurability:

```env
# Latency tuning (all values in ms)
BOSS_REPLY_COOLDOWN_MS=2000      # Min gap between boss replies (default: 2000)
TTS_TIMEOUT_MS=2500              # Max wait for first TTS audio chunk
LLM_TIMEOUT_MS=                  # Override cascade timeouts (optional)
STT_TARGET_DELAY_MS=160          # Voxtral streaming delay target
```

**Acceptance criteria:**
- [x] Default cooldown reduced to 2000ms
- [x] Env vars documented

---

### Step 5: "Boss is Thinking" Indicator

**File:** `client/src/scenes/ArenaScene.ts` (relevant arena scene)

**What:** When the client receives `aiState: 'thinking'` via WebSocket, show a subtle visual indicator (e.g., "..." speech bubble or pulsing icon above boss sprite). This masks the STT→LLM→TTS latency so it feels intentional rather than laggy.

**Key details:**
- Listen for `ai_state` WebSocket messages with `state: 'thinking'`
- Show indicator anchored above boss sprite
- Hide when `state: 'speaking'` or `state: 'listening'`
- Keep it minimal — a pulsing ellipsis or thought bubble
- Do NOT add sound effects or complex animations

**Acceptance criteria:**
- [x] Indicator visible during THINKING state
- [x] Indicator hidden when state transitions away
- [x] Does not interfere with combat gameplay

---

### Step 6: Balance Parameter Documentation

**File:** `docs/reference/balance-guide.md`

**What:** Comprehensive reference of all tunable game balance parameters, organized by system. This directly addresses both the "game balance hard to tune" weakness and the "document game balance parameters" fast-fix suggestion.

**Structure:**
```markdown
# Game Balance Guide

## Characters (client/src/config/characters.ts)
| Character | HP | Speed | Damage | FireRate | Role |
Table with all 4 characters + design rationale for each stat choice

## Enemies (client/src/config/enemies.ts)
Table with all 10 enemies + level unlock + behavior type
Explain progression curve: HP scales 4→28, damage 1→5 across 5 levels

## Bosses (client/src/config/bosses.ts)
Table with all 5 bosses + phase count + attack cooldown
Explain HP scaling: 80→320 across 5 levels

## Weapons (client/src/config/weapons.ts)
Table with DPS calculations (damage × fireRate), tradeoff analysis
Explain DPS normalization: sword=baseline, dagger=fast/weak, hammer=slow/strong

## Combat Constants (client/src/config/constants.ts)
Full table of all 20+ constants with acceptable tuning ranges

## Difficulty Scaling (client/src/systems/DifficultyManager.ts)
3-preset table with multiplier explanations

## Critical Hits (client/src/systems/CritSystem.ts)
Threshold/gain/cap explanation + expected crit curves

## Tuning Guide
- How to adjust difficulty: which knobs to turn first
- Common balance issues and which params fix them
- Example: "Boss too hard?" → reduce bossHpMult or increase bossAiThrottleMs
```

**Acceptance criteria:**
- [x] All numeric constants documented with source file + line
- [x] Design rationale for key tradeoffs
- [x] Tuning guide with actionable recommendations

---

## Testing / Verification

1. **Run test suites:**
   - `cd server && npx vitest run` (or jest)
   - `cd client && npx vitest run` (or jest)
   - All tests green, zero Phaser/runtime dependencies in unit tests

2. **Latency check:**
   - Start server with `BOSS_REPLY_COOLDOWN_MS=2000`
   - Voice loop should feel ~2s faster between boss replies

3. **Visual check:**
   - Enter boss fight, press T to talk
   - "Thinking" indicator should appear during AI processing
   - Should disappear when boss starts speaking

4. **Doc review:**
   - `docs/reference/balance-guide.md` covers all files in `client/src/config/`
   - No parameter missing from the guide

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Tests need Phaser mocks for client systems | Medium | Extract pure math functions (zone calc, crit calc) into testable utils; mock only what's needed |
| 2s cooldown causes boss reply spam | Low | Cooldown still enforced; LLM cascade adds natural ~1.5s delay; can revert via env var |
| Thinking indicator feels distracting | Low | Keep it minimal (opacity pulsing text); playtest and adjust |

---

## Priority Order

If time is limited, implement in this order (highest judge-score impact first):

1. **Step 1 + 2 + 3** — Tests (directly addresses "no test files" weakness)
2. **Step 6** — Balance docs (directly addresses "game balance" weakness + fast-fix)
3. **Step 4** — Latency reduction (addresses "4-second latency" weakness)
4. **Step 5** — Thinking indicator (polish, masks remaining latency)

---

## Notes

- Implementation note: the scene file is `client/src/scenes/ArenaScene.ts` (there is no `BossArenaScene.ts` in this repository).

- The evaluator specifically called out "Add unit tests for telemetry tracking" — Step 1 addresses this verbatim
- The evaluator said "document game balance parameters" — Step 6 addresses this verbatim
- Test framework: check `package.json` for existing test config (vitest preferred for Vite projects)
- All test files use `__tests__/` convention to match standard Node/TS patterns
