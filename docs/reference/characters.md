# Character System & Game State

> Character selection, stats, inventory, save/load, and state persistence.

---

## Character Selection

4 playable characters chosen before starting a new game (PlayerSelectScene).

### Character Stats

| Character | Max HP | Speed | Damage | Fire Rate (ms) | Sprite Key | Description |
|-----------|--------|-------|--------|----------------|------------|-------------|
| Knight | 6 | 110 | 1.0 | 280 | knight_m | Balanced warrior. Strong shield, steady aim. |
| Rogue | 4 | 145 | 0.8 | 200 | elf_f | Lightning fast. Low HP but rapid fire. |
| Mage | 3 | 100 | 2.0 | 420 | lizard_f | High damage spells. Fragile but deadly. |
| Paladin | 8 | 88 | 1.5 | 360 | dwarf_m | Iron tank. Maximum HP, heavy hits. |

### HP System
- HP measured in integer points (NOT percentage)
- 1 heart = 2 HP (e.g., Knight has 3 hearts = 6 HP)
- Hearts display: full (≥2), half (=1), empty (=0)
- Healing restores HP, clamped to maxHP

### Stat Effects
- **Speed**: direct pixel/second movement speed in LevelScene
- **Fire Rate**: milliseconds between shots (lower = faster)
- **Damage**: multiplier applied to player projectile damage

---

## Game State (Singleton)

A global singleton (`GameState`) persists player data across scene transitions.

### Default State

```
level:          1
score:          0
coins:          0
playerHP:       6
playerMaxHP:    6
playerDamage:   1
playerSpeed:    110
playerFireRate: 280
character:      Knight
equippedWeapon: WeaponSword
inventory:      []
hasShield:      false
isMultiShot:    false
```

### State Operations

| Method | Behavior |
|--------|----------|
| reset() | Reset all state to defaults |
| nextLevel() | Increment level (max 5) |
| setCharacter(type) | Set all stats from CHARACTER_CONFIGS |
| loadSave(save) | Restore state from SaveData |
| setHP(hp) | Clamp to [0, maxHP] |
| heal(amount) | Add HP (clamped) |
| takeDamage(amount) | If hasShield → clear shield, skip damage. Else subtract HP |
| isDead() | Returns true if playerHP ≤ 0 |
| addCoins(n) | Add coins + score (n × 5) |
| addScore(n) | Add raw score |
| addItem(config, qty) | Add to inventory (stack if exists) |
| removeItem(config, qty) | Remove from inventory (delete slot if qty ≤ 0) |
| applySpeedBoost(mult, ms) | Multiply speed temporarily, revert via setTimeout |
| applyDamageBoost(mult, ms) | Multiply damage temporarily, revert via setTimeout |
| applyShield(ms) | Set hasShield for duration |
| applyMultiShot(ms) | Set isMultiShot for duration |
| equipWeapon(type) | Set equipped weapon |

### Static Methods
- `GameState.addScore(n)` — accessible without `.get()`
- `GameState.takeDamage(n)` — accessible without `.get()`
- `GameState.isDead()` — accessible without `.get()`

---

## Inventory System

### Slots
Each inventory slot holds an `ItemConfig` and a `qty` (quantity).

### Stacking
- Items of the same type stack (quantity increases)
- Weapons don't typically stack but can technically

### Weapon Cycling
- Q key cycles through owned weapons
- Sword is always owned (default)
- Other weapons require inventory presence
- Cycle order: Sword → Dagger → Katana → Hammer → Bomb

### Potion Use (R Key)
- Searches inventory for first available healing item: FlaskRed, FlaskBigRed, FlaskGreen
- FlaskBigRed heals 3 HP, others heal 1 HP
- Consumed (removed from inventory)

---

## Save System

### Storage
- **localStorage** with JSON serialization
- Save key: `mistralraid_save`
- Options key: `mistralraid_options`

### SaveData Structure
```
{
  character: CharacterType,
  state: GameStateData,    // full game state snapshot
  savedAt: number          // Date.now() timestamp
}
```

### Save Triggers
- Auto-save on boss defeat
- Auto-save on level transition (entering stairs)

### Load Flow
1. MenuScene checks `SaveSystem.hasSave()`
2. "Continue" button enabled only if save exists
3. On continue: load SaveData, pass to LevelScene via scene data
4. LevelScene.init() calls `GameState.loadSave(save)`
5. Restores level number, HP, inventory, character, etc.

### Options Persistence

```
{
  soundOn:     true,    // SFX enabled
  musicOn:     true,    // Ambient music enabled
  screenShake: true,    // Camera shake enabled
  fullscreen:  false    // Fullscreen mode
}
```

- Saved/loaded independently from game state
- Defaults applied if no saved options exist
- Options merged with defaults on load (forward-compatible)

### API

| Method | Description |
|--------|-------------|
| SaveSystem.hasSave() | Check if save exists in localStorage |
| SaveSystem.save(character, state) | Serialize and store |
| SaveSystem.load() | Parse and return SaveData or null |
| SaveSystem.deleteSave() | Remove save from localStorage |
| SaveSystem.saveOptions(opts) | Store options |
| SaveSystem.loadOptions() | Load options with defaults |
