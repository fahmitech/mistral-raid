# Mistral Raid — Boss Scenario Bible

> **Purpose:** Design reference for AI-generated attack scenarios, behavioral archetypes, phase expansions, and edge-case handling. Use this to improve the Mistral system prompt, design fallback configs, and inform playtesting.
> **Status:** This document targets the arena AI prototype. The current dungeon crawler build does **not** wire the AI stack into gameplay.

---

## Table of Contents

1. [Behavioral Archetypes](#1-behavioral-archetypes)
2. [Phase 1 Scenario Matrix](#2-phase-1-scenario-matrix)
3. [Phase 2 — AI-Generated Response Guide](#3-phase-2--ai-generated-response-guide)
4. [Proposed Phase 3 — The Reckoning (25% HP)](#4-proposed-phase-3--the-reckoning-25-hp)
5. [Proposed Rage Mode — The Patience Meter](#5-proposed-rage-mode--the-patience-meter)
6. [Edge Case Scenarios](#6-edge-case-scenarios)
7. [Taunt Writing Guide](#7-taunt-writing-guide)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. Behavioral Archetypes

The telemetry the boss receives maps to **7 recognizable player archetypes**. Each should produce a distinct boss response — different mechanics, different taunt tone, different difficulty curve.

### 1.1 The Passive Dodger
> "Dodges everything. Never attacks. Just... survives."

**Telemetry signature:**
- `accuracy`: near 0 (shots_fired low or shots_hit ≈ 0)
- `dash_frequency`: very high (>8 dashes/min)
- `damage_taken_from`: all near 0 (took almost no damage)
- `phase_duration_seconds`: long (>90s) — boss HP barely moved
- `average_distance_from_boss`: high (keeping far)

**What actually happened:** Player learned to dodge beautifully but refuses to commit. They circle the arena avoiding everything while landing almost no shots. Effective defense, zero offense.

**Boss response goal:** Force engagement. Remove safe distance. Deny passive play.

**Recommended mechanics:**
- `homing_orb` × 3 (slow, relentless — can't be outrun forever, must be destroyed)
- `wall_of_death` direction: "closing", gap: -1 (no safe gap — must dash through or die)
- `hazard_zone` location: "center", large radius (removes center hiding spot)

**Sample taunt:** `"You haven't fired a single meaningful shot. I'm not impressed by survival. Let me make cowardice expensive."`

---

### 1.2 The Corner Camper
> "Found a corner. Never left."

**Telemetry signature:**
- `corner_time_pct`: >50%
- `movement_heatmap`: 1-2 zones dominate (e.g., `bot_left` very high, all others near 0)
- `dodge_bias`: heavily one direction (always dashing toward the wall)
- `average_distance_from_boss`: consistently high

**What actually happened:** Player parked themselves in a corner and shot from maximum range. Boss attacks are easier to dodge from a corner since half the directions are walled.

**Boss response goal:** Evict the corner. Make the edges dangerous.

**Recommended mechanics:**
- `hazard_zone` at the 3 non-occupied corners (forces player to defend the last safe spot)
- `hazard_zone` at the occupied corner (direct eviction)
- `projectile_spawner` pattern: "fan", aimed toward corner they occupied
- `minion_spawn` behavior: "chase", spawn_location: "corners" (minions spawn AT their safe spot)

**Sample taunt:** `"You clung to that corner like it was your home. I've just condemned it."`

---

### 1.3 The Aggressive Rusher
> "Maximum damage, maximum risk."

**Telemetry signature:**
- `accuracy`: high (>60%)
- `average_distance_from_boss`: low (<200px)
- `damage_taken_from.projectile`: high (gets hit a lot)
- `dash_frequency`: moderate (uses dash offensively, not defensively)
- `phase_duration_seconds`: short (<45s) — dealt serious damage

**What actually happened:** Player committed hard to offense. Got the boss to 50% quickly but took heavy damage doing it. High risk, high reward playstyle.

**Boss response goal:** Punish close range. Create space denial around the boss body.

**Recommended mechanics:**
- `hazard_zone` location: "center" (boss is center-top — puts a damage field around the boss)
- `laser_beam` direction: "tracking" (dangerous at close range, forces repositioning)
- `projectile_spawner` pattern: "ring" (fires 360° — dangerous at close range)
- `minion_spawn` behavior: "orbit" (orbiting minions create a dangerous zone around boss)

**Sample taunt:** `"Brave. Stupid. You got close enough to hurt me. Now I'll make that a death sentence."`

---

### 1.4 The Sprayer
> "Fires constantly, hits nothing."

**Telemetry signature:**
- `accuracy`: very low (<20%)
- High `shots_fired` implied by long phase + many misses
- `damage_taken_from`: moderate (not great at avoiding either)
- `average_distance_from_boss`: moderate

**What actually happened:** Player held the fire button the whole time, relying on volume over precision. Phase 1 boss wasn't moving so most shots should hit — very low accuracy means they were actually missing the stationary boss.

**Boss response goal:** Teach patience. Reward shots only when targeted.

**Recommended mechanics:**
- `minion_spawn` count: 4, behavior: "chase" (many targets — player will spray even more and miss)
- `hazard_zone` at `player_position` with warning (forces them to move before shooting)
- `projectile_spawner` pattern: "random" (chaotic returns their chaos energy)

**Sample taunt:** `"You fired 200 shots and scratched me 12 times. In Phase 2, wasting shots will get you killed."`

---

### 1.5 The Turtle
> "Barely moves. Tanks hits. Relies on invincibility frames."

**Telemetry signature:**
- Low `dash_frequency` (<2/min)
- `movement_heatmap`: very concentrated in one central zone
- `damage_taken_from`: high (took lots of hits, didn't dodge)
- `reaction_time_avg_ms`: slow (>800ms after telegraphs)
- Player survived with low HP despite taking heavy damage

**What actually happened:** Player didn't really try to dodge. Stood still, shot back, tanked the hits. Made it to 50% through raw damage output while absorbing punishment.

**Boss response goal:** Make standing still lethal. Force constant movement.

**Recommended mechanics:**
- `hazard_zone` location: "player_position", warning_time: 0.5 (spawns EXACTLY where they stand)
- `projectile_spawner` pattern: "aimed", high fire_rate (flood player position with projectiles)
- `wall_of_death` direction: "closing" (forces movement or death)

**Sample taunt:** `"You just stood there and took it. Let's see how long that strategy lasts when the floor itself wants you dead."`

---

### 1.6 The Paranoid Pacer
> "Moves constantly but erratically. No real pattern."

**Telemetry signature:**
- `movement_heatmap`: relatively even across all 9 zones (no dominant zone)
- `dodge_bias`: roughly balanced across 4 directions
- `reaction_time_avg_ms`: fast (reactive, not predictive)
- `accuracy`: moderate (moving while shooting reduces accuracy)

**What actually happened:** Player adopted a "never stop moving" strategy. Not corner camping, not rushing — just constant random movement to stay unpredictable.

**Boss response goal:** Punish unpredictability with chaos that's worse than their own.

**Recommended mechanics:**
- `homing_orb` × 2 (random movement does NOT shake homing orbs)
- `laser_beam` direction: "tracking" (follows their erratic movement)
- `projectile_spawner` pattern: "ring" (360° coverage beats random dodge direction)

**Sample taunt:** `"Your randomness is adorable. Unfortunately, I track you frame by frame."`

---

### 1.7 The Balanced Fighter
> "Competent at everything. No glaring weakness."

**Telemetry signature:**
- `accuracy`: 40–60%
- `damage_taken_from`: moderate, spread across types
- `dash_frequency`: healthy (3–6/min)
- `movement_heatmap`: moderate spread, no extreme corner time
- `corner_time_pct`: low (<20%)

**What actually happened:** Player is solid. No obvious exploit, no obvious weakness. This is actually the "hardest" player to counter because there's no single vulnerability to attack.

**Boss response goal:** Apply maximum pressure across all dimensions simultaneously.

**Recommended mechanics:**
- 3-mechanic combo: `projectile_spawner` (pattern: "spiral") + `homing_orb` × 2 + `minion_spawn` (count: 2, behavior: "kamikaze")
- Overwhelm with complexity rather than targeting a specific weakness

**Sample taunt:** `"You're good. Not great. I'll need to use everything to finish you."`

---

## 2. Phase 1 Scenario Matrix

Phase 1 uses three hard-coded attacks that cycle. Here's the intended experience arc and the AI sub-narratives each attack creates:

| Attack | What It Tests | What It Reveals to the AI |
|--------|--------------|--------------------------|
| **SPRAY** (8 fan projectiles) | Lateral dodging. Dodge left or right? | Reveals `dodge_bias` left vs. right preference |
| **SLAM** (telegraphed AoE at player pos) | Reaction time. Move before indicator? | Reveals `reaction_time_avg_ms` |
| **SWEEP** (horizontal projectile wave) | Vertical positioning. Up or down? | Reveals `dodge_bias` up vs. down and `movement_heatmap` zone preferences |

### Phase 1 Sub-narratives (internal, shown only in DevConsole)

These are the "training" moments the AI Game Master is designed to observe:

1. **First SPRAY:** Does the player dodge left or right? Sets initial `dodge_bias`.
2. **Second SPRAY:** Same direction? Confirms bias. Opposite? Player is adaptive — harder to counter.
3. **First SLAM:** Did they react before the telegraph expired? Sets `reaction_time_avg_ms` baseline.
4. **SWEEP:** Up or down dodge? Tells the AI which half of the arena feels "safe" to the player.
5. **Repeat cycle (if long fight):** Accumulates statistical confidence. More data = better targeting.

---

## 3. Phase 2 — AI-Generated Response Guide

This section informs both the Mistral system prompt and the response validation logic.

### 3.1 Analysis Quality Tiers

The `analysis` field in `BossResponse` should match one of these tiers:

| Tier | `phase_duration_seconds` | Description |
|------|------------------------|-------------|
| **Definitive** | >60s | Long fight = rich data. AI should be specific: "You dodged left 73% of the time and camped bot_left for 40 seconds." |
| **Probable** | 30–60s | Decent data. Some patterns visible. "You seemed to prefer the bottom half of the arena." |
| **Sparse** | <30s | Rushed it. Minimal data. Boss should sound slightly frustrated. "You ended Phase 1 before I could fully study you. Let's see if this still works." |

### 3.2 Mechanic Count by Phase Duration

| Phase Duration | Recommended Mechanic Count | Difficulty |
|---------------|---------------------------|------------|
| <30s | 2 mechanics | Hard (sparse data → compensate with difficulty) |
| 30–60s | 2–3 mechanics | Medium-hard |
| >60s | 3 mechanics | Precision-targeted (AI has full profile) |

### 3.3 Mechanic Stagger Timing

The `MechanicInterpreter` staggers activation by 0.5s. With 3 mechanics:
- 0.0s: First mechanic activates
- 0.5s: Second mechanic activates
- 1.0s: Third mechanic activates

This creates a crescendo effect — player has a moment to react to each addition.

---

## 4. Proposed Phase 3 — The Reckoning (25% HP)

> **Status: Design proposal, not yet implemented.** Would require a second Mistral call.

### Concept

At 25% boss HP, the boss performs a **second analysis** — this time analyzing *Phase 2 behavior*. How did the player respond to the generated mechanics? Did they adapt?

**The meta-twist:** The AI is now analyzing the player's response to the *first AI analysis*. This creates a second-order intelligence loop that's genuinely interesting to demonstrate.

### Trigger Condition

Boss HP drops to 25% (50 HP with BOSS_HP = 200).

### Telemetry Delta (Phase 2-specific)

A second `TelemetryPayload` would be collected during Phase 2 only, tracking:
- Which generated mechanics damaged the player most
- Whether the player started countering the mechanics (accuracy on minions, orbs destroyed)
- New movement patterns adopted in response to Phase 2

### Phase 3 Behavior

1. Brief 2-second pause (no full overlay — player is engaged)
2. Boss glows white, emits a pulse
3. Quick taunt: `"You adapted. Impressive. Let's try something you haven't seen."`
4. One NEW mechanic activates (additive, doesn't clear Phase 2 mechanics)
5. Boss attacks accelerate (interval drops from 4s to 2s)

### New Phase 3 Mechanic: **Enrage Stack**

A simpler second call — instead of full mechanic generation, the AI selects a single "enrage modifier" from a menu:

| Modifier | Effect |
|----------|--------|
| `SPEED_SURGE` | All existing projectiles increase speed by 50% |
| `DENSITY_SURGE` | Projectile spawners fire twice as often |
| `ZONE_EXPANSION` | All hazard zones expand by 50% |
| `ORB_BURST` | All homing orbs split into 2 on next hit |
| `MINION_RAGE` | All minions switch to "kamikaze" behavior |
| `WALL_CLOSE` | Wall of Death speed doubles |

**Implementation note:** This is a much smaller Mistral call (could use `ministral-8b-latest` for speed). JSON schema is just `{ modifier: ModifierType, taunt: string }`.

---

## 5. Proposed Rage Mode — The Patience Meter

> **Status: Design proposal.** Addresses the "passive dodger" problem without requiring Phase 3.

### Problem

A player who never attacks but never dies will never trigger Phase 2. The game stalls. The boss just cycles attacks indefinitely. This is bad for demos and bad game design.

### Solution: The Patience Meter

Add an invisible server-side timer. If Phase 1 lasts beyond **120 seconds**, the boss enters **Rage Mode**.

### Rage Mode Behavior

1. The boss forcefully skips to Phase 2 (triggers the analysis pipeline with available data)
2. Rage flag is set in the telemetry: `{ forced_by_timeout: true }`
3. The Mistral prompt receives a **rage preamble:**
   > "The player has survived for over 2 minutes without defeating Phase 1. They are deliberately avoiding combat. Generate mechanics specifically designed to FORCE engagement — punish passive play, deny safe zones, make inaction lethal."
4. Boss taunt is anger-coded: `"Two minutes. TWO MINUTES and you've barely touched me. I'm done being patient."`

### Rage Mechanic Constraints (system-enforced)

When `forced_by_timeout: true`, the response validator enforces:
- At least one `homing_orb` (cannot be outrun)
- At least one `wall_of_death` or `hazard_zone` at `player_position`
- No `minion_spawn` only (minions can be ignored; rage needs inescapable pressure)

### Alternative: Escalating Phase 1

Rather than a timeout, add damage escalation to Phase 1:
- After 60s: Boss attacks every 2s (down from 2.5s)
- After 90s: Boss adds a fourth Phase 1 attack: **CHASE SHOT** — a homing projectile that tracks for 3s
- After 120s: Force transition to Phase 2 with rage flag

---

## 6. Edge Case Scenarios

These are specific situations requiring explicit game logic (not just AI response).

### 6.1 Passive Dodger — Player Survives But Never Attacks

**Situation:** Player dodges 100% of attacks. Phase 1 HP never drops.

**Detection:** `accuracy` ≈ 0 AND `phase_duration_seconds` > 90.

**Game Response:**
1. After 120s: Force Phase 2 transition (Rage Mode — see §5)
2. Telemetry flag: `passive_play: true`
3. System prompt addendum: *"This player deliberately avoided attacking. Design mechanics that make inaction lethal."*
4. Guaranteed mechanic: `homing_orb` (actively tracks the player, requires active response)

**Taunt example:** `"You've been dancing around me for two minutes without firing a single meaningful shot. Adorable. Now I come to you."`

---

### 6.2 Player Dies During Phase Transition

**Situation:** Player's HP reaches 0 at the exact moment the Phase 2 transition starts.

**Current code risk:** Player death triggers `game-over` event; transition logic may still be in flight.

**Required behavior:**
1. If `player.active === false` during transition → abort transition immediately
2. Do NOT send `ANALYZE` to the server (wasted API call)
3. Fire `GAME_OVER` with the last-known boss taunt (or a generic fallback)
4. Cleanup: clear all transition timers and overlays

**Taunt for this case:** `"You managed to die while I was complimenting you. Impressive failure."`

---

### 6.3 Boss Dies During Phase Transition (Impossible in Normal Play, But...)

**Situation:** In theory impossible (boss is invulnerable during transition), but check defensively.

**Required behavior:** If `boss.hp <= 0` fires during transition:
1. Skip Phase 2 entirely
2. Go directly to Victory screen
3. Show taunt: `"You won before I could finish my analysis. Lucky."`

---

### 6.4 API Timeout — Fallback Mechanic Selection

**Situation:** Mistral API doesn't respond within 8 seconds.

**Current behavior (arena prototype only):** A fallback list exists in `fallbackAttacks.ts`, but it is **not wired** into any scene in the current build. Server-side fallback (`fallbackCache.ts`) remains the only active fallback logic.

**Improved behavior:** Use telemetry to select the *most appropriate* fallback even without the AI:

| Top Telemetry Signal | Best Fallback Config |
|---------------------|---------------------|
| High `corner_time_pct` | Fallback 4: "Face my army" — minions spawn at corners |
| Low `accuracy` | Fallback 1: "You cannot escape" — hazard zone + spiral |
| High `dash_frequency` | Fallback 3: "I'll crush you" — wall of death (counters dash-heavy) |
| Low `damage_taken` (good dodger) | Fallback 5: "The arena is mine" — full arena coverage |
| Default | Fallback 2: "Dodge this" — laser + ring (hardest general config) |

**Taunt for timeout:** `"My analysis was... interrupted. No matter. I know enough."` *(keeps the AI narrative intact even when the API failed)*

---

### 6.5 Partial API Response — Invalid JSON

**Situation:** Mistral returns JSON that fails validation (missing fields, out-of-range values, wrong mechanic type).

**Current behavior:** Fall back to cached config.

**Improved recovery priority:**
1. Try to salvage valid mechanics from the partial response (keep any well-formed mechanics, discard malformed ones)
2. If at least 1 valid mechanic is in the response, use it + fill remainder from fallback
3. If completely invalid, use full fallback
4. Always clamp all numeric values regardless (belt-and-suspenders)

---

### 6.6 Player at 1 HP Entering Phase 2

**Situation:** Player barely survived Phase 1, enters Phase 2 with almost no HP.

**AI awareness:** Include current HP in telemetry. The boss *should* know the player is wounded.

**Mechanic adjustment (implemented in response validator or prompt):** If `player_hp_at_transition < 20`, disallow `wall_of_death` with `gap: -1` and `homing_orb count: >2`. The boss should *mock* the wounded player, not insta-kill them — a dead player can't experience the full Phase 2 arc.

**Taunt example:** `"You're barely alive. I want you to experience every second of what I've prepared. Try not to die too quickly."`

---

### 6.7 Player Destroyed All Phase 2 Mechanics Quickly

**Situation:** Player kills all minions, destroys all orbs, survives all hazard zones — Phase 2 becomes empty.

**Detection:** All active mechanics have terminated within 15s of Phase 2 start.

**Response:** Trigger an immediate "second wave" — respawn Phase 2 mechanics at 50% intensity (avoid a second Mistral call for latency). This is a pure engine-side decision.

**Fallback content:** Pick 2 mechanics from the same `BossResponse` with slightly increased parameters (bump `fire_rate` by 0.5, bump `count` by 1).

**Taunt:** `"That was the preview."`

---

### 6.8 Network Disconnect Mid-Fight

**Situation:** WebSocket connection drops before Phase 2 transition.

**Required behavior:**
1. Phase 1 continues without change (no server needed for Phase 1)
2. On Phase 2 trigger: `WebSocketClient.send()` fails → immediate fallback path
3. Show overlay as normal but faster (2s instead of 3–6s)
4. Use telemetry-based fallback selection (see §6.4)
5. Show HUD indicator: `[OFFLINE MODE]` in small text

---

## 7. Taunt Writing Guide

The boss taunts are the most memorable part of the demo. Here are principles for writing (and prompting the AI to write) good ones:

### 7.1 Specificity Over Generality

**Bad:** `"You can't escape my power!"`
**Good:** `"You spent 73 seconds in the bottom-left corner. I've placed something special there for you."`

The taunt should reference the *actual telemetry* to prove the AI really analyzed the player.

### 7.2 Mechanical Foreshadowing

The taunt should hint at the incoming mechanics without spoiling them:

| Mechanic Coming | Taunt Hint |
|----------------|-----------|
| Homing orbs | "You can run. It won't help." |
| Hazard at corner | "Your hiding place becomes your grave." |
| Wall of Death | "The arena is about to get very small." |
| Minions | "You'll have company soon." |
| Tracking laser | "Everywhere you go, I follow." |

### 7.3 Tone Calibration by Player Skill

| Player Performance | Tone |
|-------------------|------|
| Passive / ran away | Contemptuous: "Two minutes of cowardice." |
| Low accuracy | Dismissive: "You couldn't hit me with a map." |
| High accuracy, good player | Respectful menace: "You're actually quite good. That makes this more interesting." |
| Took massive damage | Sadistic: "You came this far on 8 HP. Let's see if you can keep that energy." |
| Perfect Phase 1 (no damage) | Impressed threat: "Untouched. I'll have to fix that." |

### 7.4 Length

- **Audio taunts (via ElevenLabs):** 1–2 sentences. Longer = more API latency.
- **Text-only fallback taunts:** Up to 3 sentences. Screen real estate allows it.
- **Analysis field:** 1 paragraph, data-heavy. This is what the DevConsole shows judges.

---

## 8. Implementation Notes

### 8.1 Telemetry Fields to Add for Better Scenarios

These fields would improve the AI's scenario generation but aren't currently tracked:

| Field | Value | Why It Helps |
|-------|-------|-------------|
| `player_hp_at_transition` | 0–100 | Lets AI calibrate lethality (see §6.6) |
| `shots_fired` | count | Needed for true accuracy calculation (vs. shots_hit only) |
| `mechanics_survived` | list | Phase 3 awareness — did player adapt? |
| `phase_forced_by_timeout` | boolean | Activates rage prompt path |
| `orbs_destroyed` | count | Tells AI if player knows to shoot orbs |

### 8.2 System Prompt Addendums by Archetype

The `promptBuilder.ts` should detect archetypes from telemetry and add a one-line addendum to the system prompt:

```typescript
// In buildSystemPrompt() or buildUserPrompt():
if (telemetry.corner_time_pct > 0.5) {
  addendum = "ARCHETYPE DETECTED: Corner Camper. Design mechanics that evict corner camping.";
} else if (telemetry.accuracy < 0.15 && telemetry.phase_duration_seconds > 60) {
  addendum = "ARCHETYPE DETECTED: Passive Dodger. Design mechanics that punish inaction.";
} else if (telemetry.average_distance_from_boss < 200) {
  addendum = "ARCHETYPE DETECTED: Aggressive Rusher. Design mechanics that punish close range.";
}
```

### 8.3 Phase 3 Beads Task

If Phase 3 is approved for implementation:

```bash
bd create --title="Phase 3: Second AI Analysis at 25% HP" --type=feature --priority=3
bd dep add <new-id> mistral_raid-3j8   # depends on Phase Transition (T17)
```

### 8.4 Rage Mode Beads Task

```bash
bd create --title="Rage Mode: Force Phase 2 after 120s passive play" --type=feature --priority=2
bd dep add <new-id> mistral_raid-3j8   # depends on Phase Transition (T17)
```

---

*Last updated: 2026-02-28*
*Author: AI Game Designer (via Claude)*
