# Scene Specification

> All 11 registered scenes in the game, their flow, and behavior.

---

## Scene Graph

```
BootScene → MenuScene → PlayerSelectScene → LevelScene
                ↓              ↑                ↓ (overlay)
           OptionsScene        |           PauseScene
                ↓              |           InventoryScene
           CreditsScene        |                ↓
                               |           GameOverScene
                               |           VictoryScene
                               └────────────────┘
```

### Scene Registration Order (in main.ts)
```
BootScene, MenuScene, PlayerSelectScene, LevelScene,
PauseScene, InventoryScene, OptionsScene, CreditsScene,
GameOverScene, VictoryScene, AudioDebugOverlay
```

> **Note:** `ArenaScene` exists in the codebase (`client/src/scenes/ArenaScene.ts`) but is **NOT registered** in `main.ts`. It is a static layout stub with no combat or AI. See [game-behavior.md](game-behavior.md) for details.

> **Note:** `AudioDebugOverlay` is a debug utility scene (not a game scene). It displays AudioManager state: buffers loaded/loading, active music track, recent SFX list, current mood, and volume levels. Not visible to end users — accessed programmatically for audio debugging.

---

## 1. BootScene

**Purpose:** Load all game assets (sprites, tiles, decorations).

### Behavior
1. Show loading bar (200×8 px, centered, purple fill `0xcc33ff`)
2. Show "LOADING…" text (7px, white, Press Start 2P font)
3. Load ALL assets from `assets/0x72/frames/` directory
4. Handle missing assets gracefully (console warn, no crash)
5. Alias missing sprite frames to fallbacks
6. On complete → start MenuScene

### Assets Loaded

**Characters (4 frames idle + 4 frames run each):**
- knight_f (female knight)
- knight_m (male knight)
- elf_f (rogue)
- lizard_f (mage)
- dwarf_m (paladin)

**Bosses:** big_demon, big_zombie (4 idle + 4 run frames each)

**Enemies (10 types):** goblin, imp, chort, masked_orc, doc, ice_zombie, skelet, necromancer, orc_armored

**Floor tiles:** floor_1 through floor_8, floor_plain, floor_light, floor_stairs, floor_edge_1/2, floor_stain_1/2/3, floor_stain_goo, floor_mud_mid_1/2, floor_gargoyle_blue_basin, floor_spikes (4-frame anim)

**Wall tiles:** Full corner set (top_left, top, top_right, mid, left, right, corner_tl/tr/bl/br, side_left/right, column_wall, hole_1/2, goo, goo_base), 4 banner colors (red/blue/green/yellow), outer walls (13 edge variants), pit tiles (13 variants)

**Torches:** 8-frame animation (`torch_1` through `torch_8`)

**Decorations:** skull, column, column_wall, crate, box, boxes_stacked, hole

**Chests:** closed, open_full, open_empty, golden_closed, golden_full, mimic (3-frame anim)

**Potions:** flask_red/blue/green/yellow (small + big variants)

**Coins:** 4-frame animation

**Weapons:** 21 weapon sprites (swords, daggers, axes, hammers, mace, spear, bow, arrow, bombs)

**UI:** 3 heart states (full/half/empty)

**Doors:** closed, open, left, right

**Darkness overlays:** top, bottom, left, right

### Sprite Fallback Aliasing
After loading, frame 0 of missing sprites is aliased:
- skelet → chort
- necromancer → doc
- orc_armored → masked_orc
- ice_zombie run → ice_zombie idle (no run animation)
- Frames 1-3 alias to frame 0 for missing sprites

---

## 2. MenuScene

**Purpose:** Main menu with 5 options.

### Layout (320×180 internal)

**Background:** Vertical gradient (dark blue-teal, line by line)
- Top: RGB(2, 0, 18), Bottom: RGB(12, 8, 46)

**Fog layer:** 10 circular blobs (radius 45–110), slowly drifting horizontally, very low alpha (0.03–0.08), color `0x1a3355`

**Floating particles:** 55 dust particles, rising slowly (vy: -0.15 to -0.55), horizontal drift (vx: ±0.25), size 0.5–2.0, colors from `[0x334499, 0x2255bb, 0x5522aa, 0x1199bb]`, flickering alpha

**Vignette:** Dark borders — 80px side, 50px top/bottom, alpha 0.45–0.55

**Title:**
- Line 1: "MISTRAL RAID" — 16px, white, purple stroke (0xcc33ff, thickness 4)
- Line 2: "THE WATCHER" — 7px, cyan (0x00ccff), dark stroke
- Float animation: ±3px vertical, 2200ms cycle
- Pulse animation: scale 1.0→1.04, 1100ms cycle

**Menu panel:**
- Dark background (0x06101e, 92% alpha)
- Rounded rectangle: (88, 62, 144, 96) with blue border
- Inner glow line

**Menu buttons:** (6px, Press Start 2P font)
| Index | Label | Action |
|-------|-------|--------|
| 0 | New Game | → PlayerSelectScene |
| 1 | Continue | → LevelScene (with save data) |
| 2 | Options | → OptionsScene |
| 3 | Credits | → CreditsScene |
| 4 | Exit | window.close() |

- "Continue" disabled (gray) if no save exists
- Selected button: gold (#ffdd00), others: gray-blue (#aabbcc)
- Navigation skips disabled buttons
- All transitions use 280ms fade to black

**Controls hint:** "↑↓ Navigate   Enter Select" — 4px, bottom center

### Input
- **Keyboard:** Up/Down arrows to navigate, Enter to select
- **Mouse:** Hover highlights, click selects

---

## 3. PlayerSelectScene

**Purpose:** Choose 1 of 4 characters before starting new game.

### Layout (320×180)

**Background:** Vertical gradient (darker than menu)

**Title:** "CHOOSE YOUR HERO" — 8px, white, purple stroke

**4 portrait slots** (56px apart, centered):
- Dark rounded rectangle backgrounds (44×44)
- Animated sprite portraits (idle animation, 4 frames, 120ms per frame)
- Character name below each (4px)
- Selected portrait: scaled to 2.4×, others: 2.0×
- Selection highlight: gold rounded rectangle border (2px, with inner glow)

**Stat panel** (bottom half):
- Description text: character's desc string (4px, centered)
- 4 stat bars (120px wide, 5px tall): HP red (max 8), SPD blue (max 145), DMG orange (max 2), RATE green (max 420, **inverted**)

**Buttons:**
- "[ CONFIRM ]" — cyan (0x00ffcc), right-center
- "[ BACK ]" — gray, left-center

### Input
- **Keyboard:** Left/Right arrows to select, Enter to confirm
- **Mouse:** Click portrait to select, click buttons

### On Confirm
1. `GameState.reset()`
2. `GameState.setCharacter(selectedType)`
3. Fade to black → start LevelScene with `{ level: 1 }`

---

## 4. LevelScene

See [dungeon-crawler.md](dungeon-crawler.md) for full specification.

---

## 5. PauseScene (Overlay)

**Purpose:** Pause game with a menu overlay (Resume, Inventory, Options, Main Menu).

### Behavior
- Launched via `scene.launch('PauseScene')`
- Immediately `scene.pause('LevelScene')`
- Semi-transparent black backdrop + panel with 4 text buttons
- Keyboard: Up/Down to move cursor, Enter to select, Esc to resume
- Mouse: hover highlights, click selects

### Menu Actions
- **Resume:** `scene.resume('LevelScene')`, then stop PauseScene
- **Inventory:** resume LevelScene, stop PauseScene, then `scene.launch('InventoryScene')`
- **Options:** `scene.launch('OptionsScene', { fromPause: true })`, then stop PauseScene
- **Main Menu:** stop LevelScene, stop PauseScene, start MenuScene

---

## 6. InventoryScene (Overlay)

**Purpose:** View collected weapons/items and equip weapons.

### Behavior
- Launched via `scene.launch('InventoryScene')` (I key or Pause menu)
- Immediately `scene.pause('LevelScene')`
- Semi-transparent black backdrop + rounded panel
- Keyboard: `I` or `Esc` closes the overlay

### Inventory Rendering
- Splits inventory into **Weapons** vs **Items** columns
- Rarity stripe color: common `#aaaaaa`, uncommon `#33cc55`, rare `#3399ff`, legendary `#ffaa00`
- Equipped weapon label at bottom: `Equipped: {WeaponName}`
- Rows show icon, name, and quantity (if >1)
- Hovering an item shows name + rarity text in description box
- Clicking a **weapon name** equips it and re-renders
- No item use or drop actions in this scene

---

## 7. OptionsScene

**Purpose:** Toggle game settings.

### Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Sound | ON | SFX enabled/disabled |
| Music | ON | Ambient oscillator enabled/disabled |
| Screen Shake | ON | Camera shake effects |
| Fullscreen | OFF | Browser fullscreen mode |

### Persistence
- Saved to localStorage via SaveSystem.saveOptions()
- Loaded on game start via SaveSystem.loadOptions()

### Behavior
- Can be launched as a full scene **or** overlay (`fromPause: true`)
- Full scene: gradient background + fade-in
- From pause: semi-transparent black backdrop
- Reset button: `[ RESET SAVE DATA ]` calls `SaveSystem.deleteSave()` and shows a confirmation toast
- Back button: returns to MenuScene (full scene) or simply stops overlay (from pause)
- **Note:** When launched from PauseScene, OptionsScene stops itself without resuming LevelScene (LevelScene remains paused unless another scene resumes it)

### Controls
- Keyboard: Up/Down to focus rows, Enter toggles, Esc goes back
- Mouse: hover + click toggles or buttons

---

## 8. CreditsScene

**Purpose:** Show game credits and attributions.

### Behavior
- Gradient background + subtle starfield + vignette top/bottom
- Credits scroll upward in a container; auto-returns to menu when finished
- Back button (`[ BACK TO MENU ]`) and `Esc` skip return immediately
- Fade-in on create, fade-out on exit

---

## 9. GameOverScene

**Purpose:** Shown when player HP reaches 0.

### Content & Flow
- Red "GAME OVER" title with pulsing alpha
- Stats: level reached, score, coins
- Random taunt line (5 variants)
- Buttons: `[ RETRY ]` (resets GameState, starts LevelScene level 1) and `[ MENU ]` (resets, returns to MenuScene)
- Red confetti particle rain
- Fade-in on create; buttons pulse alpha

---

## 10. VictoryScene

**Purpose:** Shown after defeating level 5 boss (THE WATCHER).

### Trigger
- LevelScene triggers VictoryScene after boss defeat on level 5 (2.5s delay)
- Also possible via stairs on level 5 after boss death

### Content
- "VICTORY" title with subtle scale pulse
- Subtext: "The Watcher has been destroyed."
- Stats list: final score, coins, damage stat, inventory count
- `[ PLAY AGAIN ]` returns to MenuScene (GameState reset)
- Colorful confetti particle rain
- Fade-in on create

---

## Scene Transitions

All scene transitions use camera fade effects:
- **Fade in:** 400–600ms from black on scene create
- **Fade out:** 280–600ms to black before scene switch
- Transition only fires after fade completes (camerafadeoutcomplete event)

### Transition Map

| From | To | Trigger |
|------|----|---------|
| BootScene | MenuScene | Assets loaded |
| MenuScene | PlayerSelectScene | "New Game" selected |
| MenuScene | LevelScene | "Continue" selected (with save) |
| MenuScene | OptionsScene | "Options" selected |
| MenuScene | CreditsScene | "Credits" selected |
| PlayerSelectScene | LevelScene | Character confirmed |
| PlayerSelectScene | MenuScene | "Back" pressed |
| LevelScene | LevelScene | Stairs entered (next level) |
| LevelScene | GameOverScene | Player HP ≤ 0 |
| LevelScene | VictoryScene | Level 5 boss defeated |
| LevelScene | PauseScene | ESC key (overlay) |
| LevelScene | InventoryScene | I key (overlay) |
| PauseScene | LevelScene | Resume |
| PauseScene | MenuScene | Quit |
| PauseScene | OptionsScene | Options (overlay) |
| PauseScene | InventoryScene | Inventory (overlay) |
| OptionsScene | MenuScene | Back |
| CreditsScene | MenuScene | Back |
| GameOverScene | MenuScene | (or retry) |
| VictoryScene | MenuScene | Return to menu |
