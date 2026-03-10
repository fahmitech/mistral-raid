# Dynamic AI Behavior — Boss & Enemy Movement on the Fly

**Status:** COMPLETE
**Completed:** 2026-03-04

> Implemented in the current codebase. The directive layer now runs on top of the existing
> fallback AI for boss and dungeon enemies, with 5-second live telemetry updates driving
> short-lived server directives.

## Implementation Notes

- Boss directive movement scales the boss's current phase-adjusted speed, so later boss phases
  stay faster even while directives are active.
- Enemy `behavior_override` changes the AI decision path in `updateAI()`. Existing damage,
  shield, and death traits still come from each enemy's original config.

> **Goal:** Replace hardcoded boss/enemy movement and attack patterns with real-time,
> telemetry-driven directives from Mistral. All predefined behavior becomes the **fallback**
> when no server directive is active. No existing files are deleted.

---

## Problem Statement

| Entity | Current state | Desired state |
|--------|--------------|---------------|
| Dungeon enemies | 7-state machine, proximity-only | Speed/aggro/behavior overrideable mid-level from server |
| Boss movement | Hardcoded chase → melee → idle | 5 movement modes chosen by Mistral from live telemetry |
| Boss attacks | Phase-gated: aimed → burst/charge | 7 attack modes chosen by Mistral, not gated by phase |
| Mechanic bricks | AI-driven ✅ (already works) | Unchanged |
| Telemetry | Sent once at phase transition (ANALYZE) + 150ms raw updates | Add 5 s LIVE_TELEMETRY for directive generation |

The 6 mechanic "Lego bricks" (projectile_spawner, hazard_zone, etc.) already work.
This plan adds a **Directive layer** that controls the boss and enemies directly,
running in parallel to the mechanic layer.

---

## Architecture Overview

```
[ArenaScene / LevelScene]
  │
  │── every 5 s: LIVE_TELEMETRY ──────────────────────────────► [Server]
  │                                                                  │
  │                                                    Mistral API (lightweight prompt)
  │                                                                  │
  │◄──────────────── BOSS_DIRECTIVE ───────────────────────────────┘
  │◄──────────────── ENEMY_DIRECTIVE ──────────────────────────────┘
  │
  │── BossEntity.applyDirective(directive)
  │── Enemy.applyDirective(directive)   (broadcast to all active enemies)
```

**Key design decisions:**
- Directive is **optional** — if no directive is active (expired or never received),
  existing hardcoded behavior runs unchanged.
- Directive has a `duration_ms` — it self-expires. Server re-evaluates each cycle.
- Value clamping happens on the server before sending. Client trusts received values.
- Mistral uses a **short prompt** for directives (not the full ARCHITECT prompt).
  Goal is ≤ 1.5 s latency so directive arrives before the next update cycle.

---

## Codebase Audit — What Exists Today

This plan was verified against the actual codebase. Key facts:

| Item | Actual location | Notes |
|------|----------------|-------|
| Client WS types | `client/src/types/arena.ts` | `ServerMessage`, `ClientMessage` union types |
| Server WS types | `server/src/types.ts` | `ClientToServerMessage`, `ServerToClientMessage` union types |
| WebSocketClient | `client/src/network/WebSocketClient.ts` | Singleton `wsClient`; `.isConnected` is a **getter** (NOT a method); `.send(msg: ClientMessage)` |
| ArenaScene | `client/src/scenes/ArenaScene.ts` | Has `wsClient`, `telemetry`, `mechanicInterpreter`, `boss`, `player` |
| LevelScene | `client/src/scenes/LevelScene.ts` | Has `wsClient`, `telemetry`, `this.enemies` (Phaser group) |
| TelemetryTracker | `client/src/systems/TelemetryTracker.ts` | `computeZone(x, y)` exists (private); `getDominantZone()` exists (private); no `getRecentAccuracy()` or `getRecentDodgeBias()` yet |
| BossEntity | `client/src/entities/BossEntity.ts` | 160 lines; `updateAI()` at line 57 |
| Enemy | `client/src/entities/Enemy.ts` | 113 lines; `updateAI()` at line 47 |
| Server WS handler | `server/src/ws/WebSocketServer.ts` | Switch on `msg.type`, calls services; exports `sendToClient(session, msg)` |
| Server Mistral | `server/src/services/mistralService.ts` | `handleAnalyze(session, payload)` + `generateBossReply()` |

### Critical finding: Boss AI only runs in PHASE_1

```typescript
// ArenaScene.ts:514-518
if (this.arenaPhase === 'PHASE_1') {
  this.updateBossAI(time);
  if (time - this.phaseStartTime > 30000 || this.bossHp <= this.bossMaxHp * 0.6) {
    this.beginTransition(time - this.phaseStartTime > 30000);
  }
}
```

In PHASE_2, only `mechanicInterpreter.update()` runs — the boss stands still.
**For directives to work, `updateBossAI()` must also run during PHASE_2.**

---

## New Types

### `BossDirective`

```typescript
// Add to: client/src/types/arena.ts AND server/src/types.ts

type BossMovementMode =
  | 'chase'    // current default: move toward player when dist > melee range
  | 'circle'   // orbit player at a fixed radius
  | 'strafe'   // perpendicular movement relative to player (left/right of player axis)
  | 'retreat'  // move away from player, maintain max range
  | 'idle';    // stay still (boss focuses entirely on attacks)

type BossAttackMode =
  | 'aimed_shot'  // current phase-1 default: single bullet at player
  | 'burst'       // current phase-2+ default: 5-shot 90° spread
  | 'charge'      // current phase-2+ alt: 600ms dash at player
  | 'spiral'      // continuous spiral fire (wraps ProjectileSpawner spiral logic)
  | 'ring'        // 360° bullet ring (wraps ProjectileSpawner ring logic)
  | 'fan'         // wide fan aimed at player (wraps ProjectileSpawner fan logic)
  | 'suppress';   // rapid low-damage aimed shots (high fire rate, low damage)

interface BossDirective {
  movement_mode: BossMovementMode;
  attack_mode: BossAttackMode;
  speed_multiplier: number;        // 0.5–2.0 (applied to config.speed)
  attack_cooldown_ms: number;      // 400–3000 (minimum enforced: 400)
  circle_radius?: number;          // 80–200 (only used when movement_mode = 'circle')
  duration_ms: number;             // 3000–15000 (directive lifetime)
}
```

### `EnemyDirective`

```typescript
interface EnemyDirective {
  aggro_range_multiplier: number;      // 0.5–2.5 (applied to ENEMY_AGGRO_RANGE)
  speed_multiplier: number;            // 0.5–2.0 (applied to config.speed)
  patrol_to_aggro_ms?: number;         // override patrol change interval (500–4000)
  behavior_override?: EnemyBehavior;   // fully override enemy type (e.g. force all to chase)
  duration_ms: number;                 // 5000–30000
}
```

### `LiveTelemetry` (new, lightweight — NOT the full ANALYZE payload)

```typescript
interface LiveTelemetry {
  context: 'arena' | 'dungeon';
  player_hp_pct: number;            // 0–1
  boss_hp_pct?: number;             // 0–1 (arena only)
  enemy_count?: number;             // dungeon only
  player_zone: string;              // current 9-zone key (e.g. "bot_left")
  recent_dodge_bias: {
    left: number; right: number; up: number; down: number;
  };
  recent_accuracy: number;          // 0–1, last 10 shots
  avg_distance_from_boss?: number;  // px
  in_corner: boolean;
  elapsed_ms: number;
  last_damage_source?: 'melee' | 'projectile' | 'hazard';
}
```

### WS Message Union Updates

**`client/src/types/arena.ts` — add to `ClientMessage`:**
```typescript
export type ClientMessage =
  | { type: 'telemetry';          payload: RawTelemetry }
  | { type: 'barge_in';           payload: Record<string, never> }
  | { type: 'vad_state';          payload: { speaking: boolean } }
  | { type: 'ANALYZE';            payload: AnalyzePayload }
  | { type: 'AI_ASSISTANT_QUERY'; payload: { message: string; context: CompanionContext } }
  | { type: 'LIVE_TELEMETRY';     payload: LiveTelemetry };  // ← NEW
```

**`client/src/types/arena.ts` — add to `ServerMessage`:**
```typescript
export type ServerMessage =
  // ... existing entries ...
  | { type: 'BOSS_DIRECTIVE';     payload: BossDirective }    // ← NEW
  | { type: 'ENEMY_DIRECTIVE';    payload: EnemyDirective };  // ← NEW
```

**`server/src/types.ts` — add to `ClientToServerMessage`:**
```typescript
export type ClientToServerMessage =
  // ... existing entries ...
  | { type: 'LIVE_TELEMETRY';     payload: LiveTelemetry };   // ← NEW
```

**`server/src/types.ts` — add to `ServerToClientMessage`:**
```typescript
export type ServerToClientMessage =
  // ... existing entries ...
  | { type: 'BOSS_DIRECTIVE';     payload: BossDirective }    // ← NEW
  | { type: 'ENEMY_DIRECTIVE';    payload: EnemyDirective };  // ← NEW
```

---

## Client-Side Changes

### 1. `client/src/entities/BossEntity.ts` — Add Directive System

**Additions only — no existing methods removed:**

```typescript
// ── New imports ──
import type { BossDirective } from '../types/arena';

// ── New private fields (inside class body) ──
private directive: BossDirective | null = null;
private directiveExpiresAt = 0;
private circleAngle = 0;
private spiralAngle = 0;

// ── New public method — called by ArenaScene on BOSS_DIRECTIVE ──
applyDirective(directive: BossDirective, currentTime: number): void {
  this.directive = directive;
  this.directiveExpiresAt = currentTime + directive.duration_ms;
}

clearDirective(): void {
  this.directive = null;
}
```

**Modified: `updateAI()`** — insert directive check block at top, BEFORE existing logic:

```typescript
updateAI(player: Player, time: number, actions: BossActions): void {
  if (!this.body) return;

  // ── Expire directive ──
  if (this.directive && time >= this.directiveExpiresAt) {
    this.directive = null;
  }

  const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
  if (dist > BOSS_AGGRO_RANGE) {
    this.setVelocity(0, 0);
    return;
  }

  // ── DIRECTIVE PATH (takes priority when active) ──
  if (this.directive) {
    this.applyDirectiveMovement(player, time);
    const cooldown = Math.max(400, this.directive.attack_cooldown_ms);
    if (time - this.lastAttackAt >= cooldown) {
      this.lastAttackAt = time;
      this.executeDirectiveAttack(player, actions);
    }
    // Phase 3 summon still applies regardless of directive
    if (this.phase >= 3 && this.config.phases >= 3 && time - this.lastSummonAt > BOSS_SUMMON_COOLDOWN_MS) {
      this.lastSummonAt = time;
      for (let i = 0; i < 2; i++) {
        actions.spawnEnemy(EnemyType.Goblin,
          this.x + Phaser.Math.Between(-22, 22),
          this.y + Phaser.Math.Between(-22, 22));
      }
    }
    return;
  }

  // ── FALLBACK PATH (existing hardcoded logic, byte-for-byte unchanged) ──
  if (this.charging) { /* ... existing ... */ }
  const speed = this.getPhaseSpeed();
  // ... rest of existing updateAI body unchanged ...
}
```

**New private methods:**

```typescript
private applyDirectiveMovement(player: Player, time: number): void {
  // Let charge run to completion
  if (this.charging) {
    if (time >= this.chargeUntil) {
      this.charging = false;
      this.setVelocity(0, 0);
    } else {
      const speed = this.getPhaseSpeed() * BOSS_CHARGE_SPEED_MULT;
      this.setVelocity(this.chargeDir.x * speed, this.chargeDir.y * speed);
    }
    return;
  }

  const d = this.directive!;
  const speed = this.config.speed * d.speed_multiplier;

  switch (d.movement_mode) {
    case 'chase': {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist > BOSS_MELEE_RANGE) this.scene.physics.moveToObject(this, player, speed);
      else this.setVelocity(0, 0);
      break;
    }
    case 'circle': {
      const radius = d.circle_radius ?? 120;
      this.circleAngle += (speed / radius) * (1 / 60);
      const tx = player.x + Math.cos(this.circleAngle) * radius;
      const ty = player.y + Math.sin(this.circleAngle) * radius;
      this.scene.physics.moveTo(this, tx, ty, speed * 2);
      break;
    }
    case 'strafe': {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const perpAngle = angle + Math.PI / 2;
      // Use game time (not Date.now) for deterministic flip
      const flip = Math.floor(time / 2000) % 2 === 0 ? 1 : -1;
      this.setVelocity(Math.cos(perpAngle) * speed * flip, Math.sin(perpAngle) * speed * flip);
      break;
    }
    case 'retreat': {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const targetDist = BOSS_AGGRO_RANGE * 0.8;
      if (dist < targetDist) {
        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        this.setVelocity(0, 0);
      }
      break;
    }
    case 'idle':
    default:
      this.setVelocity(0, 0);
  }
}

private executeDirectiveAttack(player: Player, actions: BossActions): void {
  switch (this.directive!.attack_mode) {
    case 'aimed_shot': this.fireAimedShot(player, actions); break;
    case 'burst':      this.fireBurst(player, actions); break;
    case 'charge':     this.startCharge(player, this.lastAttackAt, actions); break;
    case 'ring':       this.fireRing(actions); break;
    case 'fan':        this.fireFan(player, actions, 5, 120); break;
    case 'suppress':   this.fireAimedShot(player, actions); break;
    case 'spiral':     this.fireSpiral(actions); break;
  }
}

private fireRing(actions: BossActions): void {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    actions.shootProjectile(this.x, this.y, Math.cos(angle), Math.sin(angle),
      this.config.damage, this.config.projectileColor);
  }
  actions.shake(60, 0.002);
}

private fireFan(player: Player, actions: BossActions, count: number, spreadDeg: number): void {
  const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
  const spread = Phaser.Math.DegToRad(spreadDeg);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = baseAngle - spread / 2 + t * spread;
    actions.shootProjectile(this.x, this.y, Math.cos(angle), Math.sin(angle),
      this.config.damage, this.config.projectileColor);
  }
  actions.shake(80, 0.0025);
}

private fireSpiral(actions: BossActions): void {
  const count = 3;
  for (let i = 0; i < count; i++) {
    const angle = this.spiralAngle + (i / count) * Math.PI * 2;
    actions.shootProjectile(this.x, this.y, Math.cos(angle), Math.sin(angle),
      this.config.damage, this.config.projectileColor);
  }
  this.spiralAngle += 0.35;
}
```

**Touch points in BossEntity.ts:**
- Add 1 import (`BossDirective` from `../types/arena`)
- Add 4 new private fields (`directive`, `directiveExpiresAt`, `circleAngle`, `spiralAngle`)
- Add `applyDirective()` + `clearDirective()` public methods
- Insert directive check block at top of `updateAI()` (existing code moves into an else branch)
- Add 6 new private methods
- **Zero existing methods removed. Zero existing logic changed.**

---

### 2. `client/src/entities/Enemy.ts` — Add Directive System

**Additions only:**

```typescript
// ── New import ──
import type { EnemyDirective } from '../types/arena';

// ── New private fields ──
private directive: EnemyDirective | null = null;
private directiveExpiresAt = 0;

// ── New public method ──
applyDirective(directive: EnemyDirective, currentTime: number): void {
  this.directive = directive;
  this.directiveExpiresAt = currentTime + directive.duration_ms;
}
```

**Modified: `updateAI()`** — add 3 resolved variables at top:

```typescript
updateAI(player: Player, time: number, actions: EnemyActions): void {
  // Expire directive
  if (this.directive && time >= this.directiveExpiresAt) {
    this.directive = null;
  }

  // Resolve effective values (directive overrides or defaults)
  const aggroRange = ENEMY_AGGRO_RANGE * (this.directive?.aggro_range_multiplier ?? 1);
  const speed = this.config.speed * (this.directive?.speed_multiplier ?? 1);
  const behavior = this.directive?.behavior_override ?? this.config.behavior;

  // ── Rest of existing updateAI logic — 6 substitutions: ──
  // Replace: this.config.behavior → behavior  (3 occurrences: lines 50, 58, 77)
  // Replace: ENEMY_AGGRO_RANGE   → aggroRange (2 occurrences: lines 69, 84)
  // Replace: this.config.speed   → speed      (1 occurrence: line 70)
  // Everything else unchanged.

  const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

  if (behavior === EnemyBehavior.Teleporter && time - this.lastTeleportAt > ENEMY_TELEPORT_COOLDOWN_MS) {
    // ... existing teleport logic unchanged ...
  }

  if (behavior === EnemyBehavior.RangedShoot) {
    if (dist <= ENEMY_RANGED_RANGE) {
      // ... existing ranged logic unchanged ...
    } else if (dist <= aggroRange * 1.5) {
      this.scene.physics.moveToObject(this, player, speed);
    } else {
      this.patrol(time);
    }
    return;
  }

  if (behavior === EnemyBehavior.Summoner) {
    // ... existing summoner logic unchanged ...
  }

  if (dist <= aggroRange) {
    this.scene.physics.moveToObject(this, player, speed);
  } else {
    this.patrol(time);
  }
}
```

**Touch points in Enemy.ts:**
- Add 1 import
- Add 2 private fields + 1 public method
- Replace 6 references in `updateAI()` with resolved variables (3 behavior, 2 aggroRange, 1 speed)
- **Zero existing methods removed.**

---

### 3. `client/src/systems/TelemetryTracker.ts` — Add 3 Helper Methods

The plan needs `getCurrentZone()`, `getRecentAccuracy()`, and `getRecentDodgeBias()`.
These don't exist yet. `computeZone()` exists but is private.

**Add to TelemetryTracker class:**

```typescript
// ── New private field for rolling accuracy ──
private recentShotResults: boolean[] = [];  // true = hit, false = miss

// ── Modify recordShotFired() — append to rolling buffer ──
recordShotFired(): void {
  this.shotsFired += 1;
  this.recentMissStreak += 1;
  this.recentShotResults.push(false);
  if (this.recentShotResults.length > 20) this.recentShotResults.shift();
}

// ── Modify recordShotHit() — mark last shot as hit ──
recordShotHit(): void {
  this.shotsHit += 1;
  this.recentMissStreak = 0;
  const lastFalse = this.recentShotResults.lastIndexOf(false);
  if (lastFalse !== -1) this.recentShotResults[lastFalse] = true;
}

// ── New public methods ──
getCurrentZone(x: number, y: number): string {
  return this.computeZone(x, y);
}

getRecentAccuracy(lastN: number): number {
  const slice = this.recentShotResults.slice(-lastN);
  if (slice.length === 0) return 0;
  return slice.filter(Boolean).length / slice.length;
}

getRecentDodgeBias(): { left: number; right: number; up: number; down: number } {
  const bias = { left: 0, right: 0, up: 0, down: 0 };
  const cutoff = performance.now() - 15000; // last 15s
  this.dashEvents.filter(e => e.time >= cutoff).forEach(e => { bias[e.dir] += 1; });
  return bias;
}
```

**Also add to `startPhase()` reset:**
```typescript
this.recentShotResults = [];
```

**Touch points in TelemetryTracker.ts:**
- Add 1 private field (`recentShotResults`)
- Modify `recordShotFired()` (add 2 lines)
- Modify `recordShotHit()` (add 2 lines)
- Add 3 new public methods
- Add 1 line to `startPhase()`

---

### 4. `client/src/scenes/ArenaScene.ts` — Wire Directives

This is the most delicate file. Changes must be surgical.

#### 4a. Fix: Boss AI must run in PHASE_2 (not just PHASE_1)

```typescript
// ArenaScene.ts update() — CURRENT (lines 514-523):
if (this.arenaPhase === 'PHASE_1') {
  this.updateBossAI(time);
  if (time - this.phaseStartTime > 30000 || this.bossHp <= this.bossMaxHp * 0.6) {
    this.beginTransition(time - this.phaseStartTime > 30000);
  }
}

if (this.arenaPhase === 'PHASE_2') {
  this.mechanicInterpreter.update(time, delta);
}

// ArenaScene.ts update() — NEW:
if (this.arenaPhase === 'PHASE_1') {
  this.updateBossAI(time);
  if (time - this.phaseStartTime > 30000 || this.bossHp <= this.bossMaxHp * 0.6) {
    this.beginTransition(time - this.phaseStartTime > 30000);
  }
}

if (this.arenaPhase === 'PHASE_2') {
  this.updateBossAI(time);  // ← NEW: boss AI also runs in PHASE_2
  this.mechanicInterpreter.update(time, delta);
}
```

#### 4b. Add new private fields

```typescript
private liveTelemetryTimer: Phaser.Time.TimerEvent | null = null;
private lastDamageSource: 'melee' | 'projectile' | 'hazard' | undefined;
```

#### 4c. Wire liveTelemetryTimer in `setupNetworking()`

```typescript
// Add after the existing telemetryTimer setup (line 573-577):
this.liveTelemetryTimer = this.time.addEvent({
  delay: 5000,
  loop: true,
  callback: () => this.sendLiveTelemetry(),
});
```

#### 4d. Add `sendLiveTelemetry()` method

```typescript
private sendLiveTelemetry(): void {
  if (!wsClient.isConnected) return;
  if (this.arenaPhase !== 'PHASE_1' && this.arenaPhase !== 'PHASE_2') return;

  const corners = ['top_left', 'top_right', 'bot_left', 'bot_right'];
  const zone = this.telemetry.getCurrentZone(this.player.x, this.player.y);

  wsClient.send({
    type: 'LIVE_TELEMETRY',
    payload: {
      context: 'arena',
      player_hp_pct: GameState.get().getData().playerHP / GameState.get().getData().playerMaxHP,
      boss_hp_pct: this.bossHp / this.bossMaxHp,
      player_zone: zone,
      recent_dodge_bias: this.telemetry.getRecentDodgeBias(),
      recent_accuracy: this.telemetry.getRecentAccuracy(10),
      avg_distance_from_boss: Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.boss.x, this.boss.y),
      in_corner: corners.includes(zone),
      elapsed_ms: this.time.now - this.phaseStartTime,
      last_damage_source: this.lastDamageSource,
    },
  });
}
```

#### 4e. Track `lastDamageSource` in `damagePlayer()`

```typescript
// In damagePlayer() (line 940), add one line after shield check:
private damagePlayer(amount: number, source: 'projectile' | 'hazard' | 'melee'): void {
  const now = this.time.now;
  if (this.player.isInvincible(now)) return;
  if (this.player.isShieldActive(now) || GameState.get().getData().hasShield) {
    this.spawnShieldBlockEffect();
    return;
  }
  this.lastDamageSource = source;  // ← NEW: 1 line
  GameState.get().takeDamage(amount);
  // ... rest unchanged
}
```

#### 4f. Handle BOSS_DIRECTIVE in `handleServerMessage()`

```typescript
// Add case in handleServerMessage() switch (after 'director_update' case, line 746):
case 'BOSS_DIRECTIVE':
  this.boss.applyDirective(msg.payload, this.time.now);
  break;
```

#### 4g. Clean up in `shutdown()`

```typescript
// Add to shutdown() method (after line 1074):
this.liveTelemetryTimer?.remove(false);
```

**Touch points in ArenaScene.ts:**
- Add 1 import (`LiveTelemetry` from `../types/arena` — `BossDirective` already imported via `ServerMessage`)
- Add 2 private fields
- Add 1 line to `update()` (updateBossAI call in PHASE_2)
- Add 4 lines to `setupNetworking()` (liveTelemetryTimer)
- Add `sendLiveTelemetry()` method (~20 lines)
- Add 1 line to `damagePlayer()`
- Add 1 case to `handleServerMessage()` switch
- Add 1 line to `shutdown()`

---

### 5. `client/src/scenes/LevelScene.ts` — Wire Enemy Directives

#### 5a. Handle ENEMY_DIRECTIVE from server

LevelScene already imports `wsClient` and subscribes to messages.
Add a case in the WS message handler:

```typescript
case 'ENEMY_DIRECTIVE':
  this.enemies.getChildren().forEach(child => {
    (child as Enemy).applyDirective(msg.payload, this.time.now);
  });
  break;
```

#### 5b. Add a 5s live telemetry timer (dungeon context)

```typescript
private liveTelemetryTimer: Phaser.Time.TimerEvent | null = null;

// In create() or wherever networking is set up:
this.liveTelemetryTimer = this.time.addEvent({
  delay: 5000,
  loop: true,
  callback: () => this.sendLiveTelemetry(),
});

private sendLiveTelemetry(): void {
  if (!wsClient.isConnected) return;
  const state = GameState.get().getData();
  const zone = this.telemetry.getCurrentZone(this.player.x, this.player.y);
  const corners = ['top_left', 'top_right', 'bot_left', 'bot_right'];

  wsClient.send({
    type: 'LIVE_TELEMETRY',
    payload: {
      context: 'dungeon',
      player_hp_pct: state.playerHP / state.playerMaxHP,
      enemy_count: this.enemies.getLength(),
      player_zone: zone,
      recent_dodge_bias: this.telemetry.getRecentDodgeBias(),
      recent_accuracy: this.telemetry.getRecentAccuracy(10),
      in_corner: corners.includes(zone),
      elapsed_ms: this.time.now,
    },
  });
}
```

#### 5c. Clean up in shutdown

```typescript
this.liveTelemetryTimer?.remove(false);
```

**Touch points in LevelScene.ts:**
- Add 1 import (`EnemyDirective` from `../types/arena`)
- Add 1 field, 1 method, 1 WS case, 1 cleanup line

---

## Server-Side Changes

### 6. `server/src/ws/WebSocketServer.ts` — Add LIVE_TELEMETRY Handler

```typescript
// Add new case in the switch block (after 'ANALYZE' case, line 52):
case 'LIVE_TELEMETRY': {
  void (async () => {
    try {
      const directive = await mistralService.generateDirective(
        session, msg.payload);
      if (!directive) break;

      if (msg.payload.context === 'arena' && directive.boss) {
        sendToClient(session, {
          type: 'BOSS_DIRECTIVE', payload: directive.boss });
      }
      if (msg.payload.context === 'dungeon' && directive.enemies) {
        sendToClient(session, {
          type: 'ENEMY_DIRECTIVE', payload: directive.enemies });
      }
    } catch (err) {
      console.error('[ws] directive generation error:', err);
      // Silent failure — client keeps existing directive/fallback
    }
  })();
  break;
}
```

**Touch points:** Add 1 case (~15 lines) to the existing switch.

---

### 7. `server/src/services/mistralService.ts` — Add Directive Generation

```typescript
// ── New constants ──
const DIRECTIVE_SYSTEM_PROMPT = `You are THE ARCHITECT, an AI game director. Given live combat telemetry, you output a
JSON directive that controls boss or enemy behavior for the next 5-10 seconds.

Output format for arena context:
{
  "boss": {
    "movement_mode": "chase"|"circle"|"strafe"|"retreat"|"idle",
    "attack_mode": "aimed_shot"|"burst"|"charge"|"spiral"|"ring"|"fan"|"suppress",
    "speed_multiplier": 0.5-2.0,
    "attack_cooldown_ms": 400-3000,
    "circle_radius": 80-200,
    "duration_ms": 3000-10000
  }
}

Output format for dungeon context:
{
  "enemies": {
    "aggro_range_multiplier": 0.5-2.5,
    "speed_multiplier": 0.5-2.0,
    "duration_ms": 5000-20000
  }
}

Rules:
- If player is in a corner (in_corner=true), use movement_mode "circle" or "retreat" to flush them out
- If dodge_bias heavily favors one direction, use "strafe" to cut off their escape
- If player_hp_pct < 0.3, reduce aggression (lower speed_multiplier, higher attack_cooldown_ms)
- If boss_hp_pct < 0.3, increase aggression (higher speed_multiplier, "ring" or "spiral")
- If player accuracy is high (> 0.6), use "circle" or "strafe" to make them miss
- Respond ONLY with the JSON. No explanation.`;

// ── New types ──
interface DirectiveResponse {
  boss?: BossDirective;
  enemies?: EnemyDirective;
}

// ── New exported function ──
export async function generateDirective(
  session: Session,
  telemetry: LiveTelemetry
): Promise<DirectiveResponse | null> {
  const prompt = JSON.stringify({
    context: telemetry.context,
    player_hp_pct: telemetry.player_hp_pct.toFixed(2),
    boss_hp_pct: telemetry.boss_hp_pct?.toFixed(2),
    player_zone: telemetry.player_zone,
    in_corner: telemetry.in_corner,
    recent_dodge_bias: telemetry.recent_dodge_bias,
    recent_accuracy: telemetry.recent_accuracy.toFixed(2),
    avg_distance: telemetry.avg_distance_from_boss?.toFixed(0),
    enemy_count: telemetry.enemy_count,
    last_damage_source: telemetry.last_damage_source,
  });

  try {
    const response = await client.chat.complete({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: DIRECTIVE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 200,
    });
    const raw = JSON.parse(response.choices![0].message.content as string);
    return validateAndClampDirective(raw, telemetry.context);
  } catch (err) {
    console.error('[mistral] directive generation failed:', err);
    return null;  // graceful — client continues with fallback behavior
  }
}

// ── Value clamping ──
function validateAndClampDirective(raw: any, context: string): DirectiveResponse | null {
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
  const validMovement = ['chase', 'circle', 'strafe', 'retreat', 'idle'];
  const validAttack = ['aimed_shot', 'burst', 'charge', 'spiral', 'ring', 'fan', 'suppress'];

  if (context === 'arena' && raw.boss) {
    const b = raw.boss;
    return {
      boss: {
        movement_mode: validMovement.includes(b.movement_mode) ? b.movement_mode : 'chase',
        attack_mode: validAttack.includes(b.attack_mode) ? b.attack_mode : 'aimed_shot',
        speed_multiplier: clamp(Number(b.speed_multiplier) || 1, 0.5, 2.0),
        attack_cooldown_ms: clamp(Number(b.attack_cooldown_ms) || 1200, 400, 3000),
        circle_radius: clamp(Number(b.circle_radius) || 120, 80, 200),
        duration_ms: clamp(Number(b.duration_ms) || 6000, 3000, 10000),
      },
    };
  }

  if (context === 'dungeon' && raw.enemies) {
    const e = raw.enemies;
    return {
      enemies: {
        aggro_range_multiplier: clamp(Number(e.aggro_range_multiplier) || 1, 0.5, 2.5),
        speed_multiplier: clamp(Number(e.speed_multiplier) || 1, 0.5, 2.0),
        duration_ms: clamp(Number(e.duration_ms) || 10000, 5000, 20000),
      },
    };
  }

  return null;  // invalid — client gets nothing, uses fallback
}
```

**Touch points in mistralService.ts:**
- Add 1 constant (DIRECTIVE_SYSTEM_PROMPT)
- Add 1 interface (DirectiveResponse)
- Add 2 functions (`generateDirective`, `validateAndClampDirective`)
- Uses existing `client` (Mistral SDK instance) already in the file

---

## File Change Summary

| File | Change type | Lines added (est.) | What changes |
|------|-------------|-------------------|--------------|
| `client/src/types/arena.ts` | Edit | ~35 | Add `BossDirective`, `EnemyDirective`, `LiveTelemetry` types + `BossMovementMode`, `BossAttackMode`; extend `ClientMessage` + `ServerMessage` unions |
| `server/src/types.ts` | Edit | ~35 | Mirror same types; extend `ClientToServerMessage` + `ServerToClientMessage` unions |
| `client/src/entities/BossEntity.ts` | Edit | ~90 | +4 fields, +2 public methods, +6 private methods, directive check in `updateAI()` |
| `client/src/entities/Enemy.ts` | Edit | ~15 | +2 fields, +1 public method, 6 reference swaps in `updateAI()` |
| `client/src/systems/TelemetryTracker.ts` | Edit | ~20 | +1 field, modify 2 methods (2 lines each), +3 public methods, +1 reset line |
| `client/src/scenes/ArenaScene.ts` | Edit | ~30 | +2 fields, +1 line in update(), +1 timer, +1 method, +1 case, +1 line in damagePlayer, +1 cleanup |
| `client/src/scenes/LevelScene.ts` | Edit | ~25 | +1 field, +1 timer, +1 method, +1 case, +1 cleanup |
| `server/src/ws/WebSocketServer.ts` | Edit | ~15 | +1 case in switch |
| `server/src/services/mistralService.ts` | Edit | ~80 | +1 constant, +1 interface, +2 functions |

**Total: ~345 lines added across 9 files. No new files created. No files deleted. No existing logic removed.**

---

## Behavior Matrix

| Scenario | Result |
|----------|--------|
| WS disconnected | No directives sent; hardcoded behavior runs unchanged |
| Mistral API timeout/error | `generateDirective()` returns null; no message sent; client keeps existing directive or falls back |
| Directive expires (`time >= directiveExpiresAt`) | Boss/enemy reverts to hardcoded state machine automatically |
| Directive + mechanic both active | Both run independently (boss moves per directive; projectiles spawn per mechanic) |
| Phase transition (HP threshold) | Phase tint/counter still updates; directive continues unless server sends new one |
| Charge attack mid-directive | Charge runs to completion (`this.charging` check), then directive movement resumes |
| PHASE_1 → TRANSITIONING | `updateBossAI()` stops being called; directive goes dormant |
| PHASE_2 starts | `updateBossAI()` now called again; directive resumes if still valid |
| New directive while old active | Old is overwritten immediately (no queuing) |

---

## Telemetry Cycle Timeline

```
t=0    ─ Fight starts (PHASE_1)
t=5    ─ LIVE_TELEMETRY sent → server → Mistral (~1-1.5s round trip)
t=6.5  ─ BOSS_DIRECTIVE received (duration_ms: 8000)
         Boss switches from hardcoded to directive movement/attack
t=10   ─ LIVE_TELEMETRY sent → new directive arrives at ~11.5s
         Old directive overwritten (no gap)
t=14.5 ─ If no new directive arrived, old expires → hardcoded fallback
...continues every 5s...
```

---

## Implementation Order

1. **Types** — Add `BossDirective`, `EnemyDirective`, `LiveTelemetry` to `client/src/types/arena.ts` and `server/src/types.ts`; extend union types
2. **TelemetryTracker** — Add `recentShotResults` field, modify `recordShotFired/Hit`, add 3 public methods
3. **BossEntity** — Add directive fields + methods, insert check block in `updateAI()`
4. **Enemy** — Add directive fields + method, parameterise 6 references
5. **ArenaScene** — Add PHASE_2 boss AI call, wire liveTelemetry timer, handle BOSS_DIRECTIVE, track lastDamageSource, cleanup
6. **LevelScene** — Wire liveTelemetry timer, handle ENEMY_DIRECTIVE, cleanup
7. **Server: mistralService** — Add `generateDirective()` + prompt + clamping
8. **Server: WebSocketServer** — Add `LIVE_TELEMETRY` case

Each step is independently testable:
- Steps 1–4: Pure logic, no WS needed. Test by calling `boss.applyDirective({ ... }, Date.now())` from browser console.
- Steps 5–6: Test with a mock server that returns a hardcoded BOSS_DIRECTIVE.
- Steps 7–8: Test with wscat sending a `{"type":"LIVE_TELEMETRY","payload":{...}}` payload.

---

## What Remains Hardcoded (Intentionally)

| Item | Why |
|------|-----|
| HP phase thresholds | Visual feedback (tint change) must be predictable |
| Min attack cooldown (400ms) | Prevents unplayable bullet hell via bad Mistral output |
| Boss aggro range (160px) | Out-of-range boss should always idle |
| Melee range (30px) | Physics safety — boss shouldn't teleport |
| Max speed_multiplier (2.0) | Prevents untrackably fast boss |
| Phase 3 summon (6s cooldown) | Minion spawning already balanced |
| Existing `sendTelemetry()` at 150ms | Separate concern — feeds adaptive music + DevConsole |

---

## Safety Guarantees

- **No eval(), no code execution:** Directive only sets enum strings and clamped numbers
- **All enums validated server-side:** Invalid strings replaced with safe defaults (`'chase'` / `'aimed_shot'`)
- **All numerics double-clamped:** Server clamps before sending; client enforces `Math.max(400, cooldown)`
- **Directive is opt-in:** Existing code paths remain 100% intact as fallback
- **WS failure is silent:** No user-visible errors if `LIVE_TELEMETRY` fails
- **No new files created:** All changes are edits to existing files (timer is inline in each scene)
- **shutdown() cleanup:** Both scenes clean up their `liveTelemetryTimer` to prevent memory leaks
- **TypeScript type safety:** New message types added to union types so TS enforces correctness at compile time
