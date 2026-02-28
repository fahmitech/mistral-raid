

# Visual Issues Report — Level 1 Scene

---

## 1. Lighting & Fog of War

### 1.1 Stray Light Source
There is a **second blue circle** near the bottom-center of the screen that is completely disconnected from the player character. This appears to be a duplicate or misplaced fog-of-war reveal point — likely a bug where a light source or visibility origin is being rendered at an incorrect position (possibly at a default spawn point or `(0,0)` origin).

### 1.2 Fog of War Inconsistency
- Enemies and objects **outside the player's light radius** (such as the blue sword enemies in the upper-left and upper-right, and the red/green creatures on the left) are still **partially or fully visible**. They should be obscured or hidden if the fog-of-war system is meant to limit player visibility.
- The light circle has a **hard edge** in some directions but **fades softly** in others, suggesting inconsistent blending or masking on the fog-of-war shader/overlay.

### 1.3 Pit vs. Darkness Confusion
The **dark pits/gaps** in the floor are visually indistinguishable from the fog-of-war darkness. Players cannot easily tell the difference between "dark because it's unlit" and "dark because it's a bottomless pit or gap." These need distinct visual treatment (e.g., a subtle edge highlight or different color tone for pits).

---

## 2. Tilemap & Art

### 2.1 Inconsistent Tile Sets / Style Mixing
There are at least **two distinct tile styles** present in the scene:
- **Darker, more detailed brick tiles** used in the upper and outer areas
- **Lighter, smoother stone tiles** around the player's immediate area

These two styles **do not visually match** in palette, texture detail, or resolution, creating a jarring and disjointed look.

### 2.2 No Transition Tiles
Where different tile types meet, there are **hard, abrupt seams** with no border, edge, or transition tiles to smooth the visual change. This applies to:
- Wall-to-floor boundaries
- Floor-to-pit boundaries
- Tile style changes between the two different tile sets

### 2.3 Wall vs. Floor Readability
It is very difficult to distinguish **walkable floor tiles from wall tiles**. The walls and floors use similar tones, patterns, and values, making the level geometry confusing to parse at a glance. A clear visual hierarchy is needed:
- **Floor** — lighter, flatter
- **Wall tops** — distinct cap/edge tiles
- **Wall faces** — darker, side-facing with shading to sell depth
- **Pits** — clearly differentiated from both walls and fog

### 2.4 Depth & Layering Confusion
There is no clear distinction between **wall tops, wall faces, and floor surfaces**. Typical top-down dungeon tilesets use distinct cap tiles and side-facing wall tiles to convey height and depth. In this scene, they appear interchangeable, flattening the perceived depth of the environment.

### 2.5 Obvious Tile Repetition
The decorative tiles (particularly the ones featuring **skull/face motifs** in the darker areas) repeat very noticeably in a visible grid pattern. This breaks immersion and makes the environment feel procedurally stamped rather than hand-crafted. Solutions include:
- Adding **tile variants** (multiple versions of the same tile with slight differences)
- Using **random rotation or flipping**
- Introducing **overlay decorations** to break up repetition

---

## 3. Player & Entities

### 3.1 Sword Sprite Offset
The player's sword appears to **float slightly disconnected** from the character sprite. The pivot point or offset for the weapon attachment likely needs adjustment to feel properly held by the character.

### 3.2 Enemy Visibility Outside Fog
As noted in section 1.2, enemies are visible outside the fog-of-war radius. Beyond being a lighting issue, this is also a **gameplay concern** — if the fog system is intended to create tension and limit information, enemies should not be revealed until within the light radius.

---

## 4. UI & HUD

### 4.1 Score Text Clipping
The **score display** in the top-right corner appears to be **partially cut off** or clipped by the screen edge. The text or its container needs repositioning or resizing to ensure full visibility at all resolutions and aspect ratios.

### 4.2 Weapon Label
The bottom-right corner shows what appears to be a weapon label (e.g., "SWORD") but it is **small, hard to read, and lacks visual emphasis**. Consider adding a background panel or icon for better readability.

---

## 5. Summary & Priority

| Priority | Issue | Category |
|----------|-------|----------|
| 🔴 High | Stray second light source at bottom of screen | Bug |
| 🔴 High | Wall vs. floor readability — can't tell what's walkable | Tilemap |
| 🔴 High | Pit vs. fog-of-war darkness indistinguishable | Lighting / Tilemap |
| 🟠 Medium | Inconsistent tile set styles clashing | Art Direction |
| 🟠 Medium | No transition tiles between surfaces | Tilemap |
| 🟠 Medium | Enemies visible outside fog-of-war radius | Fog of War |
| 🟠 Medium | Fog-of-war hard/soft edge inconsistency | Lighting |
| 🟡 Low | Depth/layering confusion on walls | Tilemap |
| 🟡 Low | Obvious tile repetition patterns | Art Polish |
| 🟡 Low | Sword sprite offset from player | Animation |
| 🟡 Low | Score text clipping | UI |
| 🟡 Low | Weapon label readability | UI |

---

*Addressing the **High priority** items first will significantly improve both the visual clarity and gameplay readability of the scene.*