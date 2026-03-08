import Phaser from 'phaser';
import { InfernalTorch } from '../objects/InfernalTorch';
import { AudioManager } from '../systems/AudioManager';
import { MenuOverlay, MenuOverlayItem } from '../ui/MenuOverlay';

// ─── Design constants (mirrors our React mockup) ──────────────────────────
const W = 320;
const H = 180;

// Arch portal dimensions (scaled from 1280×720 → 320×180)
const ARCH_CX   = 160;   // centre x
const ARCH_TOP  = 50;    // top of rectangular sides (where arc begins)
const ARCH_BOT  = 148;   // bottom of void — extended deeper, leaves only a thin floor strip
const ARCH_RX   = 65;    // horizontal radius of the rounded top arc
const ARCH_RY   = 50;    // vertical radius
const ARCH_L    = ARCH_CX - ARCH_RX;  // 95
const ARCH_R    = ARCH_CX + ARCH_RX;  // 225

// Stone tile size
const TILE_W = 10;
const TILE_H =  9;

// Menu layout
const MENU_X    = ARCH_CX;
const MENU_TOP  = 64;    // y of first item
const ITEM_GAP  = 9;
const MENU_FONT = '"Press Start 2P", monospace';
const MENU_TEXT_SCALE = 1;
const HUD_TEXT_COLOR = '#fef3c7';
const HUD_TEXT_SHADOW = { offsetX: 0, offsetY: 1, color: '#020406', blur: 0, fill: true } as const;

interface MenuItem {
  label: string;
  action: () => void;
  enabled: boolean;
}

export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private selectedIndex = 0;

  // Visual objects
  private torchFlameL: InfernalTorch[] = [];
  private torchFlameR: InfernalTorch[] = [];
  private swordGraphic!: Phaser.GameObjects.Graphics;
  private particles: { g: Phaser.GameObjects.Ellipse; vx: number; vy: number }[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private titleOutlineText!: Phaser.GameObjects.Text;
  private titleScanlineOverlay!: Phaser.GameObjects.TileSprite;
  private subtitleText!: Phaser.GameObjects.Text;
  private glitchTimer = 0;
  private glitchActive = false;
  private glitchIntensity = 0;   // 0–1, drives blood + knight opacity

  // Single unified event — phases:
  // 'idle'    → waiting
  // 'flicker' → torch stuttering (200–400ms), blood/knight hidden
  // 'dark'    → torches OFF, blood + knight fully visible (500–900ms)
  // 'restore' → torches back, blood/knight fade out
  private eventPhase: 'idle' | 'flicker' | 'dark' | 'restore' = 'idle';
  private eventTimer = 0;
  private eventNextIn = 6500 + Math.random() * 5000;
  private eventPhaseDuration = 0;

  private torchPhase = 0;         // continuous flicker animation tick
  private bloodGraphics!: Phaser.GameObjects.Graphics;
  private knightGraphics!: Phaser.GameObjects.Graphics;
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private menuOverlay?: MenuOverlay;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.createDungeonHallway();
    this.createVoid();
    this.createTorches();
    this.createTitle();
    this.initMenuOverlay();
    this.createMenu();
    this.createSword();
    this.createParticles();
    this.createNavHints();
    this.createBloodLayer();

    // Audio
    if (!this.sound.locked) {
      AudioManager.playMusic(this, 'menu_theme');
    } else {
      const startMusic = () => {
        this.sound.unlock();
        AudioManager.playMusic(this, 'menu_theme');
      };
      this.input.once('pointerdown', startMusic);
      this.input.keyboard?.once('keydown', startMusic);
      this.sound.once('unlocked', () => AudioManager.playMusic(this, 'menu_theme'));
    }

    // Keyboard nav
    this.input.keyboard?.on('keydown-UP',    () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN',  () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());

  }

  update(time: number, delta: number): void {
    this.torchPhase += delta * 0.007;

    // ── Unified event state machine ──────────────────────────────────────
    // idle → flicker → dark → restore → idle
    this.eventTimer += delta;

    switch (this.eventPhase) {
      case 'idle':
        if (this.eventTimer >= this.eventNextIn) {
          // Start flicker phase — torches stutter
          this.eventPhase = 'flicker';
          this.eventPhaseDuration = 180 + Math.random() * 200;
          this.eventTimer = 0;
        }
        break;

      case 'flicker':
        if (this.eventTimer >= this.eventPhaseDuration) {
          // Torches go dark — blood + knight snap on instantly
          this.eventPhase = 'dark';
          this.eventPhaseDuration = 420 + Math.random() * 300;
          this.eventTimer = 0;
          this.glitchIntensity = 1;   // instant snap — no lerp
        }
        break;

      case 'dark':
        if (this.eventTimer >= this.eventPhaseDuration) {
          // Torches restore — blood/knight fade out
          this.eventPhase = 'restore';
          this.eventTimer = 0;
        }
        break;

      case 'restore':
        // Fade out blood/knight over ~400ms
        this.glitchIntensity -= delta / 320;
        if (this.glitchIntensity <= 0) {
          this.glitchIntensity = 0;
          this.eventPhase  = 'idle';
          this.eventTimer  = 0;
          this.eventNextIn = 4200 + Math.random() * 3200;
        }
        break;
    }

    // Convenience booleans for sub-systems
    const torchFlickering = this.eventPhase === 'flicker';
    const torchDark       = this.eventPhase === 'dark' || this.eventPhase === 'restore';

    this.updateTorches(delta, torchFlickering, torchDark);
    this.updateTitle(torchDark);
    this.updateBlood();
    this.updateKnight();
    this.updateSword();
    this.updateParticles(delta);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUILD METHODS
  // ══════════════════════════════════════════════════════════════════════════

  /** Full-screen dungeon hallway: floor, ceiling, side walls with stone tiles */
  private createDungeonHallway(): void {
    const gfx = this.add.graphics();

    // ── Sky / void base ──
    gfx.fillStyle(0x000005, 1);
    gfx.fillRect(0, 0, W, H);

    // ── LEFT WALL — perspective trapezoid, stone tiles ──
    this.drawStoneTrapezoid(gfx,
      [{ x: 0, y: 0 }, { x: ARCH_L, y: ARCH_TOP }, { x: ARCH_L, y: ARCH_BOT }, { x: 0, y: H }],
      'left'
    );

    // ── RIGHT WALL ──
    this.drawStoneTrapezoid(gfx,
      [{ x: W, y: 0 }, { x: ARCH_R, y: ARCH_TOP }, { x: ARCH_R, y: ARCH_BOT }, { x: W, y: H }],
      'right'
    );

    // ── CEILING ──
    this.drawStoneTrapezoid(gfx,
      [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: ARCH_R, y: ARCH_TOP }, { x: ARCH_L, y: ARCH_TOP }],
      'ceil'
    );

    // ── FLOOR ──
    this.drawStoneTrapezoid(gfx,
      [{ x: 0, y: H }, { x: W, y: H }, { x: ARCH_R, y: ARCH_BOT }, { x: ARCH_L, y: ARCH_BOT }],
      'floor',
      0x080710   // darker floor base
    );

    // Store reference to redraw wall glow
    this.wallGraphics = gfx;
  }

  /** Fills a trapezoid with stone blocks in a brick-bond pattern */
  private drawStoneTrapezoid(
    gfx: Phaser.GameObjects.Graphics,
    poly: { x: number; y: number }[],
    side: 'left' | 'right' | 'ceil' | 'floor',
    baseColor = 0x16151e
  ): void {
    // Base fill
    gfx.fillStyle(baseColor, 1);
    gfx.fillPoints(poly as Phaser.Types.Math.Vector2Like[], true);

    // Stone tile grid — clipped by drawing only tiles whose centre is inside the polygon
    const isInsidePoly = (px: number, py: number) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        if (((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    };

    const cols = Math.ceil(W / TILE_W) + 2;
    const rows = Math.ceil(H / TILE_H) + 2;

    // Seeded random for consistent cracks
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const stagger = (row % 2) * (TILE_W / 2);
        const tx = col * TILE_W - TILE_W + stagger;
        const ty = row * TILE_H - TILE_H;
        const cx = tx + TILE_W / 2;
        const cy = ty + TILE_H / 2;

        if (!isInsidePoly(cx, cy)) continue;

        // Gray stone color — floor is darker than walls
        const baseShade = side === 'floor' ? 0.03 : 0.12;
        // Add more variation for floor tiles
        const tileVariation = side === 'floor' ? seededRandom(col * 37 + row * 53) * 0.015 : 0;
        const shade = baseShade + ((col + row * 2) % 5) * (side === 'floor' ? 0.008 : 0.018) + tileVariation;
        const color = Phaser.Display.Color.HSLToColor(0.63, side === 'floor' ? 0.02 : 0.05, shade).color;
        gfx.fillStyle(color, 1);
        gfx.fillRect(tx + 0.5, ty + 0.5, TILE_W - 1, TILE_H - 1);

        // Floor-specific realistic details
        if (side === 'floor') {
          const floorSeed = col * 71 + row * 29;

          // Worn/scuffed center area on some tiles
          if (seededRandom(floorSeed) < 0.25) {
            const wornShade = shade + 0.008;
            const wornColor = Phaser.Display.Color.HSLToColor(0.60, 0.012, wornShade).color;
            gfx.fillStyle(wornColor, 0.6);
            const wornW = TILE_W * (0.4 + seededRandom(floorSeed + 1) * 0.3);
            const wornH = TILE_H * (0.3 + seededRandom(floorSeed + 2) * 0.3);
            const wornX = tx + (TILE_W - wornW) * seededRandom(floorSeed + 3);
            const wornY = ty + (TILE_H - wornH) * seededRandom(floorSeed + 4);
            gfx.fillRect(wornX, wornY, wornW, wornH);
          }

          // Dirt accumulation in corners/edges
          if (seededRandom(floorSeed + 10) < 0.35) {
            gfx.fillStyle(0x0a0808, 0.25);
            const corner = Math.floor(seededRandom(floorSeed + 11) * 4);
            if (corner === 0) {
              gfx.fillTriangle(tx + 0.5, ty + 0.5, tx + 3, ty + 0.5, tx + 0.5, ty + 2.5);
            } else if (corner === 1) {
              gfx.fillTriangle(tx + TILE_W - 1, ty + 0.5, tx + TILE_W - 3, ty + 0.5, tx + TILE_W - 1, ty + 2.5);
            } else if (corner === 2) {
              gfx.fillTriangle(tx + 0.5, ty + TILE_H - 1, tx + 3, ty + TILE_H - 1, tx + 0.5, ty + TILE_H - 3);
            } else {
              gfx.fillTriangle(tx + TILE_W - 1, ty + TILE_H - 1, tx + TILE_W - 3, ty + TILE_H - 1, tx + TILE_W - 1, ty + TILE_H - 3);
            }
          }

          // Dark water/age stains on some tiles
          if (seededRandom(floorSeed + 20) < 0.15) {
            gfx.fillStyle(0x08060a, 0.3);
            const stainX = tx + 1 + seededRandom(floorSeed + 21) * (TILE_W - 4);
            const stainY = ty + 1 + seededRandom(floorSeed + 22) * (TILE_H - 3);
            gfx.fillEllipse(stainX, stainY, 2 + seededRandom(floorSeed + 23) * 2, 1.5);
          }

          // Subtle surface scratches
          if (seededRandom(floorSeed + 30) < 0.2) {
            gfx.lineStyle(0.3, 0x0c0a0e, 0.4);
            const scratchX1 = tx + 1 + seededRandom(floorSeed + 31) * 3;
            const scratchY1 = ty + 1 + seededRandom(floorSeed + 32) * 2;
            gfx.strokeLineShape(new Phaser.Geom.Line(
              scratchX1, scratchY1,
              scratchX1 + 3 + seededRandom(floorSeed + 33) * 3, scratchY1 + seededRandom(floorSeed + 34) * 2
            ));
          }

          // Edge wear (lighter worn edges)
          gfx.fillStyle(0xffffff, 0.02 + seededRandom(floorSeed + 40) * 0.015);
          gfx.fillRect(tx + TILE_W - 1.5, ty + 0.5, 1, TILE_H - 1);
        }

        // Top highlight edge
        gfx.fillStyle(0xffffff, side === 'floor' ? 0.04 : 0.06);
        gfx.fillRect(tx + 0.5, ty + 0.5, TILE_W - 1, 1);

        // Mortar / grout line - deeper for floor
        gfx.fillStyle(side === 'floor' ? 0x040308 : 0x060510, 1);
        gfx.fillRect(tx, ty, TILE_W, side === 'floor' ? 0.8 : 0.5);
        gfx.fillRect(tx, ty, side === 'floor' ? 0.8 : 0.5, TILE_H);

        // Floor grout shadow (dirt in grout lines)
        if (side === 'floor') {
          gfx.fillStyle(0x020204, 0.5);
          gfx.fillRect(tx + 0.8, ty + 0.8, TILE_W - 0.8, 0.3);
          gfx.fillRect(tx + 0.8, ty + 0.8, 0.3, TILE_H - 0.8);
        }

        // Random cracks on some tiles
        const tileSeed = col * 100 + row + (side === 'left' ? 1000 : side === 'right' ? 2000 : side === 'ceil' ? 3000 : 4000);
        if (seededRandom(tileSeed) < 0.25) {
          gfx.lineStyle(0.5, 0x050408, 0.7);
          const crackType = Math.floor(seededRandom(tileSeed + 1) * 4);

          if (crackType === 0) {
            // Diagonal crack from corner
            gfx.strokeLineShape(new Phaser.Geom.Line(
              tx + 1, ty + 1,
              tx + TILE_W * 0.6, ty + TILE_H * 0.7
            ));
          } else if (crackType === 1) {
            // Forked crack
            const midX = tx + TILE_W * 0.5;
            const midY = ty + TILE_H * 0.4;
            gfx.strokeLineShape(new Phaser.Geom.Line(tx + 2, ty + 1, midX, midY));
            gfx.strokeLineShape(new Phaser.Geom.Line(midX, midY, tx + TILE_W - 2, ty + TILE_H * 0.6));
            gfx.strokeLineShape(new Phaser.Geom.Line(midX, midY, tx + TILE_W * 0.3, ty + TILE_H - 1));
          } else if (crackType === 2) {
            // Horizontal crack
            gfx.strokeLineShape(new Phaser.Geom.Line(
              tx + 1, ty + TILE_H * 0.5,
              tx + TILE_W - 2, ty + TILE_H * 0.6
            ));
          } else {
            // Corner chip
            gfx.fillStyle(0x050408, 0.6);
            gfx.fillTriangle(
              tx + TILE_W - 1, ty + 1,
              tx + TILE_W - 1, ty + 3,
              tx + TILE_W - 3, ty + 1
            );
          }
        }
      }
    }

    // Add longer cracks that span multiple tiles on walls
    if (side === 'left' || side === 'right') {
      const wallCracks = side === 'left'
        ? [[15, 20, 45, 80], [60, 40, 75, 100], [30, 90, 50, 140]]
        : [[260, 25, 290, 75], [240, 60, 270, 110], [275, 100, 300, 150]];

      wallCracks.forEach(([x1, y1, x2, y2]) => {
        if (!isInsidePoly((x1 + x2) / 2, (y1 + y2) / 2)) return;

        gfx.lineStyle(0.8, 0x030306, 0.5);
        // Main crack line with slight zigzag
        const midX = (x1 + x2) / 2 + (seededRandom(x1 + y1) - 0.5) * 8;
        const midY = (y1 + y2) / 2;
        gfx.strokeLineShape(new Phaser.Geom.Line(x1, y1, midX, midY));
        gfx.strokeLineShape(new Phaser.Geom.Line(midX, midY, x2, y2));

        // Branch cracks
        gfx.lineStyle(0.5, 0x040308, 0.4);
        gfx.strokeLineShape(new Phaser.Geom.Line(midX, midY, midX + 6, midY + 12));
        gfx.strokeLineShape(new Phaser.Geom.Line(midX, midY, midX - 5, midY + 8));
      });
    }
  }

  /** The dark arch portal — rounded top, straight sides */
  private createVoid(): void {
    const gfx = this.add.graphics();

    // Solid void fill using fillPath (rect body + arc cap)
    gfx.fillStyle(0x010008, 1);

    // Body: rectangle from arc centre down to bottom
    gfx.fillRect(ARCH_L, ARCH_TOP, ARCH_RX * 2, ARCH_BOT - ARCH_TOP);

    // Rounded cap: filled arc at top (half ellipse)
    // Approximate with a polygon
    const arcPoints: { x: number; y: number }[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI + (i / steps) * Math.PI; // π → 2π (bottom half of circle = top of arch)
      arcPoints.push({
        x: ARCH_CX + Math.cos(angle) * ARCH_RX,
        y: ARCH_TOP + Math.sin(angle) * ARCH_RY,   // sin goes negative = upward
      });
    }
    // Close with the rectangle bottom corners
    arcPoints.push({ x: ARCH_R, y: ARCH_TOP });
    arcPoints.push({ x: ARCH_L, y: ARCH_TOP });
    gfx.fillPoints(arcPoints as Phaser.Types.Math.Vector2Like[], true);

    // Receding corridor perspective lines
    gfx.lineStyle(0.5, 0x1a1438, 0.5);
    for (let i = 0; i <= 6; i++) {
      const t  = i / 6;
      const lx = ARCH_L + t * ARCH_RX;
      const ly = ARCH_TOP - (1 - t) * 8;
      gfx.strokeLineShape(new Phaser.Geom.Line(lx, ly, ARCH_CX, ARCH_TOP + (ARCH_BOT - ARCH_TOP) * 0.52));
      const rx = ARCH_R - t * ARCH_RX;
      gfx.strokeLineShape(new Phaser.Geom.Line(rx, ly, ARCH_CX, ARCH_TOP + (ARCH_BOT - ARCH_TOP) * 0.52));
    }

    // Perspective rings inside void
    [[0.25, 0x1c1240], [0.45, 0x150e30], [0.6, 0x0f0a20]].forEach(([t, col], i) => {
      const lx = ARCH_L + (t as number) * ARCH_RX;
      const rx = ARCH_R - (t as number) * ARCH_RX;
      const ty = ARCH_TOP + (t as number) * (ARCH_BOT - ARCH_TOP) * 0.55;
      const by = ARCH_BOT - (t as number) * (ARCH_BOT - ARCH_TOP) * 0.40;
      gfx.lineStyle(0.8, col as number, 0.5 - i * 0.1);
      gfx.strokeRect(lx, ty, rx - lx, by - ty);
    });

    // Arch frame keystones
    const frameGfx = this.add.graphics();
    // Left pillar stones
    for (let i = 0; i < 9; i++) {
      const shade = i % 2 === 0 ? 0x1a1825 : 0x141320;
      frameGfx.fillStyle(shade, 1);
      frameGfx.fillRect(ARCH_L - 4, ARCH_TOP + i * 9, 5, 8);
      frameGfx.fillStyle(0x080610, 1);
      frameGfx.fillRect(ARCH_L - 4, ARCH_TOP + i * 9, 5, 0.5);
    }
    // Right pillar stones
    for (let i = 0; i < 9; i++) {
      const shade = i % 2 === 0 ? 0x1a1825 : 0x141320;
      frameGfx.fillStyle(shade, 1);
      frameGfx.fillRect(ARCH_R, ARCH_TOP + i * 9, 5, 8);
      frameGfx.fillStyle(0x080610, 1);
      frameGfx.fillRect(ARCH_R, ARCH_TOP + i * 9, 5, 0.5);
    }
    // Arc cap keystone blocks
    const kSteps = 10;
    for (let i = 0; i <= kSteps; i++) {
      const angle = Math.PI + (i / kSteps) * Math.PI;
      const kx = ARCH_CX + Math.cos(angle) * ARCH_RX - 2;
      const ky = ARCH_TOP + Math.sin(angle) * ARCH_RY - 2;
      const shade = i % 2 === 0 ? 0x1c1a28 : 0x16141e;
      frameGfx.fillStyle(shade, 1);
      frameGfx.fillRect(kx, ky, 5, 4);
    }

    // Cyan arch edge glow — very subtle
    frameGfx.lineStyle(0.8, 0x00ffff, 0.08);
    frameGfx.strokeRect(ARCH_L, ARCH_TOP, ARCH_RX * 2, ARCH_BOT - ARCH_TOP);
    frameGfx.setDepth(2);
    gfx.setDepth(2);
  }

  /** Two pixel-art torches flanking the arch entrance */
  private createTorches(): void {
    // Left torch at (ARCH_L - 10, ARCH_TOP - 6)
    // Right torch at (ARCH_R + 2, ARCH_TOP - 6)
    for (let side = 0; side < 2; side++) {
      const bx = side === 0 ? ARCH_L - 12 : ARCH_R + 3;
      const by = ARCH_TOP + 6;
      const gfx = this.add.graphics();
      gfx.setDepth(10);

      // Bracket (static — draw once)
      const bracketPx = 2;
      const bracket: [number, number, number][] = [
        [1,3,0x6a4820],[2,3,0x7a5828],[3,3,0x6a4820],
        [0,4,0x3a2a18],[1,4,0x7a5828],[2,4,0x8a6830],[3,4,0x7a5828],[4,4,0x3a2a18],
        [1,5,0x5a3818],[2,5,0x6a4820],[3,5,0x5a3818],
        [2,6,0x4a2a10],[2,7,0x4a2a10],
      ];
      bracket.forEach(([px, py, col]) => {
        gfx.fillStyle(col, 1);
        gfx.fillRect(bx + px * bracketPx, by + py * bracketPx, bracketPx, bracketPx);
      });

      const torch = new InfernalTorch(this, bx + 5, by + 16, 0.58);
      if (side === 0) this.torchFlameL.push(torch);
      else            this.torchFlameR.push(torch);
    }
  }

  private createTitle(): void {
    this.ensureTitleTextures();

    const titleY = 30;
    const titleString = 'MISTRAL RAID';
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: MENU_FONT,
      fontSize: '20px',
      align: 'center',
      color: '#ffffff',
      resolution: 2,
    };

    this.titleOutlineText = this.add.text(ARCH_CX, titleY, titleString, titleStyle)
      .setOrigin(0.5)
      .setDepth(19);
    this.titleOutlineText.setColor('#08002a');
    this.titleOutlineText.setStroke('#08002a', 8);
    this.titleOutlineText.setShadow(0, 0, '#08002a', 24, false, true);

    this.titleText = this.add.text(ARCH_CX, titleY, titleString, titleStyle)
      .setOrigin(0.5)
      .setDepth(20);
    this.titleText.setStroke('#08002a', 3);
    this.titleText.setShadow(0, 0, '#00f0ff', 18, false, true);

    const gradient = this.titleText.context.createLinearGradient(0, 0, 0, this.titleText.height);
    gradient.addColorStop(0, '#a8f0ff');
    gradient.addColorStop(0.25, '#40e0ff');
    gradient.addColorStop(0.5, '#00c8ff');
    gradient.addColorStop(0.8, '#8040ff');
    gradient.addColorStop(1, '#c060ff');
    this.titleText.setFill(gradient);

    const overlayWidth = this.titleText.displayWidth + 12;
    const overlayHeight = this.titleText.displayHeight + 8;
    this.titleScanlineOverlay = this.add.tileSprite(ARCH_CX, titleY, overlayWidth, overlayHeight, 'menu_title_scan')
      .setDepth(21)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.titleScanlineOverlay.setMask(this.titleText.createBitmapMask());
    this.tweens.add({
      targets: this.titleScanlineOverlay,
      tilePositionY: -12,
      duration: 1400,
      ease: 'Sine.easeInOut',
      repeat: -1,
      yoyo: true,
    });

    const subtitleY = titleY + 16;
    this.subtitleText = this.addPixelText(ARCH_CX, subtitleY, 'THE WATCHER', {
      fontFamily: MENU_FONT,
      fontSize: '10px',
      color: '#7b5fff',
      letterSpacing: 0.5,
      shadow: { offsetX: 0, offsetY: 1, color: '#08001a', blur: 0, fill: true },
    })
      .setOrigin(0.5)
      .setDepth(20);
    this.snapToPixels(this.subtitleText);

    const floatConfigs: Array<{ target: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform; delta: number; duration: number }> = [
      { target: this.titleText, delta: 2, duration: 1400 },
      { target: this.titleOutlineText, delta: 2, duration: 1450 },
      { target: this.titleScanlineOverlay, delta: 2, duration: 1350 },
      { target: this.subtitleText, delta: 1, duration: 2000 },
    ];

    floatConfigs.forEach(({ target, delta, duration }) => {
      const baseY = target.y;
      this.tweens.add({
        targets: target,
        y: baseY + delta,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => { target.y = Math.round(target.y); },
      });
    });
  }

  private initMenuOverlay(): void {
    const canvas = this.game.canvas;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) {
      console.warn('[MenuScene] Unable to create MenuOverlay — missing canvas or parent element');
      return;
    }

    const subtitleY = this.subtitleText?.y ?? MENU_TOP - 8;
    this.menuOverlay = new MenuOverlay(parent, canvas, {
      menuX: MENU_X,
      menuTop: MENU_TOP,
      itemGap: ITEM_GAP,
      subtitleY,
      hintBaseline: H - 4,
    });
    this.menuOverlay.setSubtitle('THE WATCHER');
    this.menuOverlay.setHints('↑↓ NAVIGATE   ENTER SELECT   ESC BACK');
    this.menuOverlay.onHover((index) => {
      if (!this.items[index] || !this.items[index].enabled || index === this.selectedIndex) return;
      this.selectedIndex = index;
      this.refreshMenu();
    });
    this.menuOverlay.onClick((index) => {
      if (!this.items[index] || !this.items[index].enabled) return;
      this.selectedIndex = index;
      this.refreshMenu();
      this.activateSelection();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menuOverlay?.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.menuOverlay?.destroy());
    this.subtitleText?.setVisible(false);
  }

  private createMenu(): void {
    this.items = [
      {
        label: 'NEW GAME',
        enabled: true,
        action: () => this.startScene('PlayerSelectScene'),
      },
      {
        label: 'AI CO-OP MODE',
        enabled: true,
        action: () => this.startScene('CoopSelectScene'),
      },
      {
        label: 'ARENA DEMO',
        enabled: true,
        action: () => this.startScene('ArenaScene'),
      },
      {
        label: 'OPTIONS',
        enabled: true,
        action: () => this.startScene('OptionsScene'),
      },
      {
        label: 'CREDITS',
        enabled: true,
        action: () => this.startScene('CreditsScene'),
      },
      {
        label: 'EXIT',
        enabled: true,
        action: () => window.close(),
      },
    ];

    this.menuOverlay?.setItems(this.items.map<MenuOverlayItem>((item) => ({
      label: item.label,
      enabled: item.enabled,
    })));
    this.refreshMenu();
  }

  /** Pixel-art sword that tracks the selected item */
  private createSword(): void {
    this.swordGraphic = this.add.graphics().setDepth(20);
    this.drawSword();
  }

  private createParticles(): void {
    const colors = [0x00aacc, 0x6622cc, 0x2244aa];
    for (let i = 0; i < 18; i++) {
      const size = Phaser.Math.FloatBetween(0.5, 1.5);
      const g = this.add.ellipse(
        Phaser.Math.Between(ARCH_L + 4, ARCH_R - 4),
        Phaser.Math.Between(ARCH_TOP + 4, ARCH_BOT - 4),
        size, size,
        Phaser.Utils.Array.GetRandom(colors),
        Phaser.Math.FloatBetween(0.2, 0.5),
      ).setDepth(12);
      this.particles.push({
        g,
        vx: Phaser.Math.FloatBetween(-0.15, 0.15),
        vy: Phaser.Math.FloatBetween(-0.3, -0.08),
      });
    }
  }

  private createNavHints(): void {
    const hintBg = this.add.graphics().setDepth(18);
    const paddingX = 18;
    const paddingY = 3;
    const bgWidth = W - paddingX * 2;
    const bgHeight = 18;
    hintBg.fillStyle(0x050a16, 0.88);
    hintBg.fillRoundedRect(paddingX, H - bgHeight - paddingY, bgWidth, bgHeight, 6);
    hintBg.lineStyle(1, 0x1e2b45, 0.9);
    hintBg.strokeRoundedRect(paddingX, H - bgHeight - paddingY, bgWidth, bgHeight, 6);

  }

  private createBloodLayer(): void {
    this.bloodGraphics  = this.add.graphics().setDepth(15);
    this.knightGraphics = this.add.graphics().setDepth(16);
  }

  private addPixelText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    scale = MENU_TEXT_SCALE
  ): Phaser.GameObjects.Text {
    // Higher makes small pixel fonts way crisper.
    // 3 is a good default; 4 is even sharper for 9–10px text.
    const RESOLUTION = 4;

    const merged: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: MENU_FONT,
      ...style,
    };

    const obj = this.add.text(Math.round(x), Math.round(y), text, merged);

    // Letter spacing support (Phaser version dependent)
    const ls = (style as { letterSpacing?: number }).letterSpacing;
    if (typeof ls === 'number' && typeof (obj as any).setLetterSpacing === 'function') {
      (obj as any).setLetterSpacing(ls);
    }

    obj.setResolution(RESOLUTION);
   

    // Make sure the text texture is sampled sharply
    obj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Kill smoothing on the internal canvas used to draw text (big blur culprit)
    const ctx = (obj as any).context as CanvasRenderingContext2D | undefined;
    if (ctx) ctx.imageSmoothingEnabled = false;

    // Avoid fractional scaling
    obj.setScale(Math.round(scale * 1000) / 1000);
    this.snapToPixels(obj);

    return obj;
  }

  private snapToPixels<
    T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform,
  >(obj: T): T {
    obj.setPosition(Math.round(obj.x), Math.round(obj.y));
    return obj;
  }

  /** Ensure small helper textures used by the title exist before creating sprites */
  private ensureTitleTextures(): void {
    const textureKey = 'menu_title_scan';
    if (this.textures.exists(textureKey)) return;

    const width = 16;
    const height = 16;
   const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.clear();
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRect(0, 0, width, height);

    // Horizontal scanline strip (bright line + transparent gap)
    gfx.fillStyle(0xffffff, 0.4);
    for (let y = 0; y < height; y += 4) {
      gfx.fillRect(0, y, width, 1);
      gfx.fillStyle(0xffffff, 0.18);
      gfx.fillRect(0, y + 1, width, 1);
      gfx.fillStyle(0xffffff, 0.08);
    }

    gfx.generateTexture(textureKey, width, height);
    gfx.destroy();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE METHODS
  // ══════════════════════════════════════════════════════════════════════════

  private updateTorches(delta: number, flickering: boolean, dark: boolean): void {
    const flickerL = Math.abs(Math.sin(this.torchPhase * 0.7 + 0.3)) * 0.5 + 0.5;
    const flickerR = Math.abs(Math.sin(this.torchPhase * 0.85 + 1.2)) * 0.5 + 0.5;

    const stutter = (base: number) =>
      flickering ? (Math.random() > 0.35 ? base : 0.15) : base;

    const torchData = [
      { torch: this.torchFlameL[0], flicker: stutter(flickerL) },
      { torch: this.torchFlameR[0], flicker: stutter(flickerR) },
    ];

    torchData.forEach(({ torch, flicker: flk }) => {
      if (!torch) return;
      torch.step(delta);
      torch.setDark(dark);
      if (!dark) {
        torch.setFlicker(flk);
      }
    });
  }

  private updateTitle(dark: boolean): void {
    if (dark) {
      this.titleText.setAlpha(0.85);
      this.titleText.x = ARCH_CX + (Math.random() > 0.5 ? 1 : -1);
    } else {
      this.titleText.setAlpha(1);
      this.titleText.x = ARCH_CX;
    }
  }

  private updateBlood(): void {
    this.bloodGraphics.clear();
    const t = this.glitchIntensity;
    if (t < 0.001) return;

    const gfx = this.bloodGraphics;
    const px = 2;
    const q = (value: number) => Math.round(value / px) * px;
    const intensity = Math.max(0.2, t);
    const noise = (seed: number) => Math.abs(Math.sin(seed * 12.9898 + this.torchPhase * 0.33));

    // ── Heavy layered wall wash ──
    const washes: Array<{ startX: number; width: number; color: number; alpha: number }> = [
      { startX: 0,       width: ARCH_L,        color: 0x1c0000, alpha: 0.55 },
      { startX: 0,       width: ARCH_L,        color: 0x420000, alpha: 0.35 },
      { startX: ARCH_R,  width: W - ARCH_R,    color: 0x1a0000, alpha: 0.5 },
      { startX: ARCH_R,  width: W - ARCH_R,    color: 0x3e0000, alpha: 0.32 },
    ];
    washes.forEach(({ startX, width, color, alpha }) => {
      gfx.fillStyle(color, alpha * intensity);
      gfx.fillRect(q(startX), 0, q(width), H);
    });

    // Subtle streaks to mimic dried cracks
    gfx.fillStyle(0x080000, 0.2 + 0.18 * intensity);
    for (let i = 0; i < 7; i += 1) {
      const offset = 8 + i * 18 + noise(i) * 6;
      gfx.fillRect(q(offset), 0, px, H);
      gfx.fillRect(q(W - offset), 0, px, H);
    }

    const paintDrips = (originX: number, mirror = 1) => {
      const drips: Array<{ x: number; start: number; w: number; len: number }> = [
        { x: 6,  start: 6,  w: 3, len: 96 },
        { x: 18, start: 2,  w: 4, len: 78 },
        { x: 32, start: 10, w: 5, len: 118 },
        { x: 50, start: 0,  w: 4, len: 102 },
        { x: 66, start: 14, w: 3, len: 70 },
        { x: 82, start: 4,  w: 4, len: 110 },
      ];
      drips.forEach((d, idx) => {
        const bleed = 0.5 + noise(idx * 3.3 + mirror) * 0.45;
        const x = mirror === 1 ? originX + d.x : originX - d.x - d.w;
        const height = d.len * (0.3 + intensity * 0.7);
        gfx.fillStyle(0x7c0000, bleed * intensity);
        gfx.fillRect(q(x), q(d.start), q(d.w), q(height));

        gfx.fillStyle(0x3a0000, 0.3 + 0.25 * intensity);
        gfx.fillRect(q(x + 1), q(d.start + 2), q(Math.max(1, d.w - 2)), q(height * 0.85));

        gfx.fillStyle(0xaa1a1a, 0.45 + 0.15 * intensity);
        gfx.fillRect(q(x - 1), q(d.start + height), q(d.w + 2), px * 2);
        gfx.fillRect(q(x - 2), q(d.start + height + 2), q(d.w + 4), px);

        gfx.fillStyle(0xff6666, 0.12 + 0.08 * intensity);
        gfx.fillRect(
          q(x + (mirror === 1 ? d.w - 1 : 0)),
          q(d.start + 4),
          px,
          q(height * 0.6)
        );
      });
    };

    paintDrips(0, 1);
    paintDrips(W, -1);

    // Floating mist / splatter near arch
    for (let i = 0; i < 16; i += 1) {
      const n = noise(i + 6.2);
      const sx = ARCH_L + n * (ARCH_R - ARCH_L);
      const sy = ARCH_TOP + n * 52;
      gfx.fillStyle(0xbb1111, (0.15 + 0.12 * intensity) * (0.4 + n));
      gfx.fillRect(q(sx), q(sy), q(2 + n * 3), px);
    }

    // ── Floor blood pool spreading from both base corners ──
    const poolAlpha = 0.35 + 0.25 * intensity;
    const pools = [
      { x: ARCH_L - 6, y: H - 8, offset: 0 },
      { x: ARCH_R + 6, y: H - 8, offset: 1 },
    ];
    pools.forEach((pool, idx) => {
      const sway = 1 + noise(idx * 4.7) * 0.6;
      const width = 56 * (0.3 + intensity * 0.7) * sway;
      gfx.fillStyle(0x5a0000, poolAlpha);
      gfx.fillRect(q(pool.x - width / 2), q(pool.y - 4), q(width), px * 2);
      gfx.fillStyle(0x8c1010, 0.22 + 0.12 * intensity);
      gfx.fillRect(q(pool.x - width / 3), q(pool.y - 6), q(width * 0.6), px);
      gfx.fillStyle(0xff4a4a, 0.12 + 0.06 * intensity);
      gfx.fillRect(q(pool.x - width / 4 + 6), q(pool.y - 8), q(width * 0.35), px);
    });

    gfx.fillStyle(0x320000, 0.35 + 0.25 * intensity);
    gfx.fillRect(q(ARCH_L - 10), q(H - 11), q(ARCH_R - ARCH_L + 20), px * 2 + px);
  }

  /** Dead fallen knight — pixel art, fades in/out with glitch intensity */
  private updateKnight(): void {
    this.knightGraphics.clear();
    const t = this.glitchIntensity;
    if (t < 0.01) return;

    // Knight lies on the floor just inside the arch left side
    // Horizontal, head to the right, feet to the left
    // Origin: floor level = ARCH_BOT - 4, centred around x=118
    const ox = 108;
    const oy = ARCH_BOT - 12;
    const px = 2;

    const knight: [number, number, number][] = [
      // ── Helmet ──
      [9,0,0x888899],[10,0,0x9999aa],[11,0,0x888899],
      [8,1,0x666677],[9,1,0xaaaacc],[10,1,0xbbbbdd],[11,1,0xaaaacc],[12,1,0x666677],
      [8,2,0x555566],[9,2,0x999aaa],[10,2,0x8888aa],[11,2,0x999aaa],[12,2,0x555566],
      // visor slit
      [9,2,0x222233],[10,2,0x111122],[11,2,0x222233],

      // ── Chest / torso (lying flat) ──
      [4,1,0x667788],[5,1,0x778899],[6,1,0x8899aa],[7,1,0x778899],
      [4,2,0x556677],[5,2,0x667788],[6,2,0x778899],[7,2,0x667788],
      [3,2,0x445566],

      // ── Arm reaching out (left) ──
      [1,1,0x556677],[2,1,0x667788],[3,1,0x667788],
      [0,2,0x445566],[1,2,0x556677],[2,2,0x667788],
      // gauntlet
      [0,1,0x778899],[-1,1,0x889988],

      // ── Legs ──
      [4,3,0x556677],[5,3,0x667788],[6,3,0x556677],
      [4,4,0x445566],[5,4,0x556677],
      // boots
      [4,5,0x334455],[5,5,0x334455],

      // ── Broken sword lying beside knight ──
      [7,4,0x99aacc],[8,4,0xaabbdd],[9,4,0x99aacc],   // blade fragment
      [10,4,0x7788aa],[11,4,0x556688],                  // tip (broken)
      [6,4,0x885544],[6,5,0x774433],                    // handle
      // crossguard
      [6,3,0x997755],[7,3,0x886644],

      // ── Puddle of blood under helmet ──
      [8,3,0x880000],[9,3,0xaa0000],[10,3,0x880000],
      [8,4,0x660000],[9,5,0x550000],
    ];

    // Draw shadow/silhouette first
    this.knightGraphics.fillStyle(0x000000, 0.45 * t);
    this.knightGraphics.fillEllipse(ox + 12, oy + 6, 30, 8);

    // Draw each pixel
    knight.forEach(([bx, by, col]) => {
      this.knightGraphics.fillStyle(col, t);
      this.knightGraphics.fillRect(ox + bx * px, oy + by * px, px, px);
    });

    // Soul particle rising — faint cyan wisp above the knight
    const soulY = oy - 8 - (Date.now() % 2000) / 2000 * 10;
    this.knightGraphics.fillStyle(0x44aaff, 0.25 * t);
    this.knightGraphics.fillEllipse(ox + 20, soulY, 4, 6);
    this.knightGraphics.fillStyle(0x88ccff, 0.15 * t);
    this.knightGraphics.fillEllipse(ox + 21, soulY - 4, 2, 3);
  }

  private updateSword(): void {
    this.drawSword();
  }

  private updateParticles(delta: number): void {
    this.particles.forEach(p => {
      p.g.y += p.vy * (delta / 16);
      p.g.x += p.vx * (delta / 16);
      if (p.g.y < ARCH_TOP + 2) p.g.y = ARCH_BOT - 4;
      if (p.g.x < ARCH_L + 2)  p.g.x = ARCH_R - 4;
      if (p.g.x > ARCH_R - 2)  p.g.x = ARCH_L + 4;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRAWING HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private drawSword(): void {
    const gfx = this.swordGraphic;
    gfx.clear();

    const targetItem = this.items[this.selectedIndex];
    if (!targetItem) return;

    const cy = this.menuOverlay?.getItemCenterY(this.selectedIndex) ?? (MENU_TOP + this.selectedIndex * ITEM_GAP);
    const itemLeft = this.menuOverlay?.getItemLeft(this.selectedIndex);
    const fallbackLeft = MENU_X - 50;
    const sx = (itemLeft ?? fallbackLeft) - 34;

    // === POMMEL ===
    gfx.fillStyle(0x7755bb, 1);
    gfx.fillCircle(sx, cy, 2.8);
    gfx.fillStyle(0x9977dd, 1);
    gfx.fillCircle(sx, cy, 2);

    // === HANDLE ===
    gfx.fillStyle(0x4a2818, 1);
    gfx.fillRoundedRect(sx + 3, cy - 2, 7, 4, 1.2);
    gfx.fillStyle(0x6a3828, 1);
    gfx.fillRoundedRect(sx + 3.5, cy - 1.5, 6, 1.5, 0.8);

    // === CROSSGUARD ===
    gfx.fillStyle(0x6644aa, 1);
    gfx.fillRoundedRect(sx + 10, cy - 4.5, 2.5, 9, 1);
    gfx.fillStyle(0x8866cc, 1);
    gfx.fillRoundedRect(sx + 10.5, cy - 4, 1.5, 8, 0.6);

    // === BLADE - proper sword shape ===
    const bladeX = sx + 12.5;
    const bladeLen = 18;
    const bladeW = 2;

    // Blade body - rectangular with pointed tip
    gfx.fillStyle(0x6090b8, 1);
    gfx.beginPath();
    gfx.moveTo(bladeX, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen - 4, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen, cy);
    gfx.lineTo(bladeX + bladeLen - 4, cy + bladeW);
    gfx.lineTo(bladeX, cy + bladeW);
    gfx.closePath();
    gfx.fillPath();

    // Blade highlight (top half)
    gfx.fillStyle(0x90c0e0, 1);
    gfx.beginPath();
    gfx.moveTo(bladeX, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen - 4, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen, cy);
    gfx.lineTo(bladeX, cy);
    gfx.closePath();
    gfx.fillPath();

    // Top edge line
    gfx.lineStyle(1.2, 0xc8e8ff, 1);
    gfx.beginPath();
    gfx.moveTo(bladeX, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen - 4, cy - bladeW);
    gfx.lineTo(bladeX + bladeLen, cy);
    gfx.strokePath();

    // Center fuller line
    gfx.lineStyle(0.8, 0x5080a0, 0.8);
    gfx.beginPath();
    gfx.moveTo(bladeX + 1, cy);
    gfx.lineTo(bladeX + bladeLen - 5, cy);
    gfx.strokePath();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MENU STATE
  // ══════════════════════════════════════════════════════════════════════════

  private refreshMenu(): void {
    this.menuOverlay?.setSelectedIndex(this.selectedIndex);
  }

  private moveSelection(dir: number): void {
    let idx = this.selectedIndex;
    do {
      idx = (idx + dir + this.items.length) % this.items.length;
    } while (!this.items[idx].enabled);
    this.selectedIndex = idx;
    this.refreshMenu();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private activateSelection(): void {
    const item = this.items[this.selectedIndex];
    if (item.enabled) {
      AudioManager.playSFX(this, 'ui_click');
      item.action();
    }
  }

  private startScene(key: string, data?: object): void {
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(key, data);
    });
  }
}
