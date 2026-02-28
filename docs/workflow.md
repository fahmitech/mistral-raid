# Mistral Raid — Agentic Workflow Guide

## Philosophy

Every significant change follows a **Ready? → Claim → Plan → Approve → Implement → Complete** cycle.

- **Beads (`bd`)** is the authoritative task state — it tracks what's done, what's blocked, and what's ready to start based on the dependency graph.
- **`docs/plans/`** holds the implementation plan before any code is written.
- Both must be updated together — never mark a beads task complete without updating tracker.md and vice versa.

### First-Time Setup

```bash
# 1. Install beads (once, system-wide)
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# 2. Initialize all 25 tasks with dependency graph
#    Mirror the IDs/titles in docs/progress/beads-ids.md
#    (optional: write a small helper script in your implementation repo)

# 3. Verify
bd ready   # should show Task 1, Task 2, Task 23 (no blockers)
```

---

## Prompt Classification Decision Tree

```
User prompt received
       │
       ▼
       ├─── ALWAYS FIRST: bd ready  (see what's unblocked)
       │
       ▼
Is it a question? ──────────────────────────► Q&A Workflow
(what/how/why/explain)                        Answer from docs, no code changes
       │ No
       ▼
Is it asking to PLAN / THINK THROUGH? ──────► Planning Workflow
(plan, design, think about, approach)         Output: docs/plans/plan-<slug>.md
       │ No
       ▼
Is it "implement this plan"? ───────────────► Plan Implementation Workflow
(follow the plan, execute docs/plans/...)     Requires existing approved plan
       │ No
       ▼
Is it a BUG / ERROR? ───────────────────────► Debug Workflow
(fix, broken, error, not working)             Investigate first, then fix
       │ No
       ▼
Is it about TESTS? ─────────────────────────► Test Workflow (see sub-types)
(test, e2e, smoke, integration, verify)       Planning or Implementation sub-type
       │ No
       ▼
Is it a CODING request? ────────────────────► Coding Workflow
(build, create, write, implement, task N)     Plan first if non-trivial
```

---

## Workflow Details

### 1. Q&A Workflow

**Purpose:** Answer questions without making changes.

**Steps:**
1. Search [specs.md](specs.md) for the answer (use section numbers)
2. Check [decisions/](decisions/) for relevant ADRs
3. Cite the source section in the answer
4. If no clear answer exists: flag it as a gap and suggest creating a decision record

**Output:** Text response only. No file changes unless creating a new ADR.

---

### 2. Planning Workflow

**Purpose:** Produce a written, structured plan before any code is written.

**Trigger examples:**
- "Plan how to implement the telemetry tracker"
- "Think through the WebSocket protocol"
- "What's the best approach for the MechanicInterpreter?"

**Steps:**
1. `bd ready` — confirm the target task has no remaining blockers
2. Look up beads ID in [progress/beads-ids.md](progress/beads-ids.md)
3. Read [specs.md](specs.md) — find the relevant task(s) by number
4. Read [progress/tracker.md](progress/tracker.md) — check dependencies
5. Read any existing code in the affected area
6. Write plan to `docs/plans/plan-<slug>.md` (use [plan-template.md](plans/plan-template.md))
   - Include `Beads ID: <id>` in the plan header
7. Present plan summary to user and ask for approval
8. **Do not write any implementation code until approved**

**Plan naming convention:**
- Spec tasks: `plan-task-05-boss-entity.md`
- Features: `plan-phase-transition.md`
- Tests: `plan-tests-e2e.md`

---

### 3. Plan Implementation Workflow

**Purpose:** Execute an approved plan step-by-step.

**Steps:**
1. Read the target plan from `docs/plans/` — find the `Beads ID` in the header
2. `bd show <id>` — verify blockers list is empty
3. `bd update <id> --claim` — atomically claim before writing any code
4. Execute each step in order — do not combine or skip steps
5. After each step: update tracker.md
6. On final step complete: `bd update <id> --status complete`
7. If blocked mid-task: stop, document the blocker in `bd update <id> --note "blocked: <reason>"`, ask user

---

### 4. Coding Workflow

**Purpose:** Handle direct coding requests.

**Decision:**
- **Trivial** (≤1 file, obvious fix, < 30 lines): Code directly
- **Non-trivial** (multiple files, new system, architectural impact): Create plan first

**Steps for non-trivial:**
1. Create plan in `docs/plans/`
2. Get approval
3. Implement
4. Update tracker

**Steps for trivial:**
1. Read the relevant file first
2. Make the change
3. Update tracker if it's a spec task

---

### 5. Debug Workflow

**Purpose:** Investigate and fix issues without causing regressions.

**Three cases — pick the right one:**

#### Case A: Bug mid-implementation (task still `in_progress`)
1. Read the error and affected file(s)
2. State root cause before touching code
3. Fix inline — **no new beads task**
4. `bd update <id> --note "bug: <cause> fixed in <file>"`
5. Continue original plan

#### Case B: Bug on a completed task
1. `bd create "Bug: <description>" -p 0`
2. `bd dep add <bug-id> <original-task-id>`
3. `bd update <bug-id> --claim`
4. Read the file, state root cause, make **minimal fix only**
5. `bd update <bug-id> --status complete`
6. Note it in [progress/tracker.md](progress/tracker.md) on the original task row
7. Create ADR if it reveals a design flaw

#### Case C: Regression (later task broke earlier one)
1. `bd create "Regression: <earlier> broken by <later>" -p 0`
2. `bd dep add <bug-id> <earlier-id> && bd dep add <bug-id> <later-id>`
3. Fix in the **later** task's code
4. Do not re-open the earlier task in beads

#### All cases: never
- Guess at root cause without reading the file
- Refactor surrounding code while fixing a bug
- Skip the `--note` on the beads task

---

### 5b. Tweak Workflow

**Purpose:** Adjust working code — not a bug, but feel/value/polish changes.

| Tweak type | Action |
|-----------|--------|
| Value only (speed, count, color) | Edit [gameConfig.ts](../client/src/config/gameConfig.ts) directly. No plan. No new task. |
| Behavior, ≤1 file, <30 lines | Code directly. `bd update <task-id> --note "tweak: <what changed>"` |
| Behavior, multiple files | Mini Coding Workflow: write a plan, get approval, then implement |

After any tweak: re-check the relevant Demo Checklist items in [progress/tracker.md](progress/tracker.md).

---

### 6. Test Workflows

#### E2E Test Planning
1. Create `docs/plans/plan-tests-e2e.md`
2. Cover the Demo Checklist from specs.md §14 (all 15 checkboxes)
3. Map each checkbox to a test scenario with: given/when/then
4. Identify tooling (Playwright recommended for browser game)

#### E2E Test Implementation
1. Requires approved `plan-tests-e2e.md`
2. Implement tests, run them, fix failures
3. Document test run results in `docs/progress/`

#### Smoke Test
Quick deployment verification — see `docs/plans/plan-tests-e2e.md` (smoke spec section).

#### Integration Tests
Test each external API independently with real or mock credentials:
- Mistral API response shape validation
- ElevenLabs audio output (or graceful null)
- WebSocket message protocol
- Fallback behavior on API failure

---

## Beads Quick Reference

```bash
bd ready                         # list tasks with no blockers (start here every session)
bd show <id>                     # full task details: status, blockers, history
bd update <id> --claim           # mark in_progress + assign to you (do before coding)
bd update <id> --status complete # mark done
bd update <id> --note "msg"      # add a note (use for blockers, decisions)
bd dep add <child> <parent>      # add a dependency (child is blocked by parent)
```

IDs for all 25 spec tasks live in [progress/beads-ids.md](progress/beads-ids.md).
If the beads database is wiped, recreate the tasks using that table (or a helper script in your implementation repo).

---

## Document Conventions

### Plan File Structure
See [plans/plan-template.md](plans/plan-template.md)

### Progress Tracker
[progress/tracker.md](progress/tracker.md) — updated after every completed task.

Status symbols:
- ⬜ Not started
- 🔄 In progress
- ✅ Complete
- ❌ Blocked (add blocker note)
- ⏭️ Skipped (add reason)

### Architecture Decision Records (ADRs)
`docs/decisions/adr-<NNN>-<slug>.md`

Use for: technology choices, tradeoffs, why something was NOT done.
Template: Title | Status | Context | Decision | Consequences

---

## Spec Task Reference (Quick)

| Phase | Tasks | Description |
|-------|-------|-------------|
| A: Foundation | 1–5 | Scaffolding, types, player, arena, boss Phase 1 |
| B: Core Systems | 6–10 | Telemetry, WebSocket, Mistral API, ElevenLabs, MechanicInterpreter |
| C: Lego Bricks | 11–16 | 6 mechanic classes (ProjectileSpawner → MinionSpawner) |
| D: Integration | 17–20 | Phase transition, AudioManager, HUD/UI, fallback configs |
| E: Polish | 21–25 | Particles, Victory/GameOver scenes, config, BootScene, Deploy |

Dependencies flow A → B → C → D → E. Tasks within a phase can often be parallelized.
