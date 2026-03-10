# Implementation Plan: Demo Finale (Sanctum + Choice Screen)

**Goal:** Close the 3 gaps between the demo script and the codebase.

| Gap | What the script says | What exists |
|-----|---------------------|-------------|
| 1 | Sanctum scene — amber light, two figures, Mira says "Is it time now?" | `sanctum_home` story card exists, no scene |
| 2 | LET GO / HOLD ON ending choice screen | VictoryScene has confetti + PLAY AGAIN only |
| 3 | Name inconsistency — script says "Mira", lore says "Mael" | Pick one |

---

## Files to Create

```
client/src/scenes/SanctumScene.ts    ← new scene (the narrative beat)
```

## Files to Modify

```
client/src/scenes/ArenaScene.ts      ← boss defeat → SanctumScene instead of VictoryScene
client/src/scenes/VictoryScene.ts    ← gut and rebuild as ending choice screen
client/src/main.ts                   ← register SanctumScene
```

---

## Task 1 — SanctumScene.ts (new file)

**What it does:** After the boss kneels, fade to a warm amber room. Two pixel figures (NPC sprites). A short scripted dialog. Then transition to the choice screen.

### Scene flow

```
1. Fade in (400ms) from black
2. Draw background: warm amber gradient (top 0x1a1008, bottom 0x0d0904)
3. Soft particle dust (8-12 amber circles, slow float upward, loop)
4. Two NPC sprites seated at center — use existing frames:
   - npc_sage (Elias Thorne / The Watcher) — tinted slightly amber
   - npc_elf (small figure / Mael) — positioned lower, smaller scale
5. Music: AudioManager.playMusic(this, 'dungeon_ambient') at 0.3 volume
6. After 1.5s delay, show dialog sequence (TauntText-style, bottom-center):
   Line 1 (1.5s hold): ""        ← empty beat, silence
   Line 2 (auto):      "Is it time now?"
   Line 3 (3s hold):   ""        ← silence after the line
7. Fade out (600ms) → scene.start('VictoryScene')
```

### Key details

- Canvas: 320x180 (INTERNAL_WIDTH x INTERNAL_HEIGHT)
- Font: `"Press Start 2P"`, 4-5px, color `#fef3c7` (warm cream)
- Dialog text: letter-by-letter at 40ms per char (slower than combat TauntText's 28ms — reflective pace)
- No player input needed. Scene is purely timed. Total duration: ~8 seconds.
- NPC sprites positioned at ~(145, 85) and ~(165, 95), facing each other
- Both sprites at depth 2, background at depth 0, text at depth 5

### Skeleton

```typescript
export class SanctumScene extends Phaser.Scene {
  constructor() { super('SanctumScene'); }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    AudioManager.playMusic(this, 'dungeon_ambient');

    // amber gradient background
    // dust particles (small amber circles, slow upward drift)
    // two NPC sprites from existing spritesheet
    // timed dialog sequence using add.text + character reveal tween
    // after final beat → fadeOut → VictoryScene
  }
}
```

---

## Task 2 — Rebuild VictoryScene.ts as the Choice Screen

**What it does:** Replace confetti/stats with the LET GO / HOLD ON binary choice.

### Scene flow

```
1. Fade in (400ms) from black
2. Black background (0x060b16)
3. No music (silence carries from Sanctum ambient fade)
4. After 0.8s, fade in two choice texts side by side:
   Left:  "LET GO"   at (100, 90)
   Right: "HOLD ON"   at (220, 90)
5. Keyboard: LEFT/RIGHT to select, ENTER to confirm
   Mouse: hover to highlight, click to confirm
6. Selected text: #fef3c7 (warm cream), alpha 1
   Unselected text: #556677 (dim), alpha 0.4
7. On confirm:
   - Brief white flash (50ms)
   - Fade to black (800ms)
   - scene.start('CreditsScene') or scene.start('MenuScene')
```

### Key details

- Reuse the existing button pattern from GameOverScene (keyboard + mouse, refreshButtons)
- Font: `"Press Start 2P"`, 8px for choices
- No stats, no confetti, no title — just the two words
- Hold for 4 seconds minimum before enabling input (matches demo script)
- Both choices lead to the same destination (MenuScene or CreditsScene) — the moment is narrative, not mechanical

### Skeleton delta from current VictoryScene

```
DELETE: confetti system, stats display, "VICTORY" title, "PLAY AGAIN" button
ADD:    two choice texts, selection state, keyboard/mouse input, 4s input delay
KEEP:   scene key 'VictoryScene', fadeIn, playAgain → MenuScene path
```

---

## Task 3 — Wire ArenaScene boss defeat → SanctumScene

**File:** `client/src/scenes/ArenaScene.ts` line 604-607

### Current

```typescript
if (this.bossHp <= 0 && this.arenaPhase !== 'VICTORY') {
  this.arenaPhase = 'VICTORY';
  this.scene.start('VictoryScene');
}
```

### Change to

```typescript
if (this.bossHp <= 0 && this.arenaPhase !== 'VICTORY') {
  this.arenaPhase = 'VICTORY';
  this.cameras.main.fadeOut(600, 0, 0, 0);
  this.cameras.main.once('camerafadeoutcomplete', () => {
    this.scene.start('SanctumScene');
  });
}
```

- Adds a proper fade-out before transition (matches the death → GameOverScene pattern at line 595)
- Routes through SanctumScene first, which then chains to VictoryScene (now the choice screen)

---

## Task 4 — Register SanctumScene in main.ts

**File:** `client/src/main.ts`

Add `SanctumScene` to the scene array (between ArenaScene and VictoryScene in the list).

```typescript
import { SanctumScene } from './scenes/SanctumScene';
// ...
scene: [..., ArenaScene, SanctumScene, VictoryScene, ...]
```

---

## Task 5 — Fix the name: Mira → Mael

The lore already uses **Mael** consistently (`loreEntries.ts` lines 63-71: "Her name was Mael"). The demo script says "Mira" but `cobb_locket` entry also references "Mira" as the nose-portrait figure.

**Decision needed:** Are Mira and Mael the same character? If yes, pick one name and update the demo script (not the code — the code has both in different lore entries). If they're different characters, the Sanctum figure should be **Mael** (the daughter whose name the player discovers on Level 4).

The SanctumScene dialog does not name the character — it just says "Is it time now?" — so no code change needed here. Just align the demo script narration.

---

## Implementation Order

```
1. SanctumScene.ts        (new file, ~80-120 lines)
2. main.ts                (add import + scene registration, 2 lines)
3. ArenaScene.ts           (change line 606, add fade-out)
4. VictoryScene.ts         (gut and rebuild, ~80-100 lines)
5. Test: kill boss → Sanctum plays → choice screen appears → selection works
```

Estimated total: ~200 lines of new/changed code across 4 files.

---

## What This Does NOT Cover

- **Sister Vael voice shifting** — the demo script mentions it but this is a server-side companion agent enhancement, not needed for the video recording
- **bosstalks.live** — deployment URL, not a code task
- **Video recording** — the demo script describes specific camera angles and player actions; that's performance, not code

---

## Assets Required

**None new.** Everything uses existing assets:
- NPC sprites: `npc_sage`, `npc_elf` (already loaded via asset manifest)
- Music: `dungeon_ambient` (already loaded)
- Font: `"Press Start 2P"` (already loaded)
- No new audio files, no new sprites, no new dependencies
