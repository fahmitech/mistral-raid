import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';
import { CoopState, type CompanionPersonality } from '../systems/CoopState';

const CHARACTER_ORDER: CharacterType[] = [
  CharacterType.Knight,
  CharacterType.Rogue,
  CharacterType.Mage,
  CharacterType.Paladin,
];

const PERSONALITIES: { key: CompanionPersonality; label: string; desc: string; color: string }[] = [
  { key: 'aggressive', label: 'AGGRO',    desc: 'Always attacking, high-risk offense',    color: '#ff4444' },
  { key: 'tactical',  label: 'TACTICAL',  desc: 'Weakest enemy first, smart positioning', color: '#ffaa22' },
  { key: 'protector', label: 'PROTECTOR', desc: 'Guards the player at all times',         color: '#44aaff' },
  { key: 'balanced',  label: 'BALANCED',  desc: 'Mix of attack and defense',              color: '#44ff88' },
];

// Portrait box layout: 4 boxes centred in 320px
const BOX_SIZE   = 24;
const BOX_GAP    = 24;
const BOX_STEP   = BOX_SIZE + BOX_GAP;                // 48px
const ROW_START_X = (320 - (4 * BOX_SIZE + 3 * BOX_GAP)) / 2; // 76

type FocusedSection = 'hero' | 'companion' | 'personality';

export class CoopSelectScene extends Phaser.Scene {
  // Hero row
  private heroIndex = 0;
  private heroSprites: Phaser.GameObjects.Sprite[] = [];
  private heroBgs: Phaser.GameObjects.Graphics[] = [];

  // Companion row
  private companionIndex = 1; // default to Rogue so it differs from hero
  private companionSprites: Phaser.GameObjects.Sprite[] = [];
  private companionBgs: Phaser.GameObjects.Graphics[] = [];

  // Personality row
  private personalityIndex = 3; // default balanced
  private personalityTexts: Phaser.GameObjects.Text[] = [];

  // Focus
  private focused: FocusedSection = 'hero';

  // Info labels
  private descText?: Phaser.GameObjects.Text;
  private personalityDescText?: Phaser.GameObjects.Text;
  private sectionLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('CoopSelectScene');
  }

  create(): void {
    // Phaser reuses scene instances — always reset per-run state before rebuilding.
    this.heroSprites = [];
    this.heroBgs = [];
    this.companionSprites = [];
    this.companionBgs = [];
    this.personalityTexts = [];
    this.heroIndex = 0;
    this.companionIndex = 1;
    this.personalityIndex = 3;
    this.focused = 'hero';
    this.descText = undefined;
    this.personalityDescText = undefined;
    this.sectionLabel = undefined;

    AudioManager.get().init(this);
    this.createBackground();

    // ── Title ──────────────────────────────────────────────────────────────
    this.add.text(160, 8, 'AI CO-OP MODE', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#cc88ff',
      stroke: '#220044',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5);

    this.add.text(160, 20, 'AI Companion Powered by Mistral', {
      fontFamily: '"Press Start 2P"',
      fontSize: '5px',
      color: '#ff7700',
      resolution: 2,
    }).setOrigin(0.5);

    // ── Hero section ───────────────────────────────────────────────────────
    this.add.text(ROW_START_X, 34, 'YOUR HERO:', {
      fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffffff', resolution: 2,
    });
    this.createPortraitRow(56, this.heroSprites, this.heroBgs, false);

    // ── Companion section ──────────────────────────────────────────────────
    this.add.text(ROW_START_X, 88, 'AI COMPANION:', {
      fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#88ccff', resolution: 2,
    });
    this.createPortraitRow(110, this.companionSprites, this.companionBgs, true);

    // ── Personality section ────────────────────────────────────────────────
    this.add.text(ROW_START_X, 130, 'PERSONALITY:', {
      fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffcc44', resolution: 2,
    });
    this.createPersonalityRow(142);

    // ── Desc text ─────────────────────────────────────────────────────────
    this.personalityDescText = this.add.text(160, 156, PERSONALITIES[this.personalityIndex].desc, {
      fontFamily: '"Press Start 2P"',
      fontSize: '5px',
      color: '#aabbcc',
      resolution: 2,
    }).setOrigin(0.5);

    // ── Section indicator ─────────────────────────────────────────────────
    this.sectionLabel = this.add.text(160, 165, '▲▼ Switch section   ◄► Change   ENTER Confirm', {
      fontFamily: '"Press Start 2P"', fontSize: '4px', color: '#667788', resolution: 2,
    }).setOrigin(0.5);

    // ── Back / Confirm buttons ─────────────────────────────────────────────
    const backText = this.add.text(12, 173, '[ BACK ]', {
      fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#888888', resolution: 2,
    }).setOrigin(0, 0.5);

    const confirmText = this.add.text(308, 173, '[ START ]', {
      fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#00ffcc', resolution: 2,
    }).setOrigin(1, 0.5);

    // ── Mouse support ──────────────────────────────────────────────────────
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      // Hero row click
      this.heroSprites.forEach((s, i) => {
        if (s.getBounds().contains(ptr.x, ptr.y)) {
          this.focused = 'hero';
          this.heroIndex = i;
          this.refreshAll();
        }
      });
      // Companion row click
      this.companionSprites.forEach((s, i) => {
        if (s.getBounds().contains(ptr.x, ptr.y)) {
          this.focused = 'companion';
          this.companionIndex = i;
          this.refreshAll();
        }
      });
      // Personality click
      this.personalityTexts.forEach((t, i) => {
        if (t.getBounds().contains(ptr.x, ptr.y)) {
          this.focused = 'personality';
          this.personalityIndex = i;
          this.refreshAll();
        }
      });
      // Buttons
      if (backText.getBounds().contains(ptr.x, ptr.y)) this.back();
      if (confirmText.getBounds().contains(ptr.x, ptr.y)) this.confirm();
    });

    // ── Keyboard ──────────────────────────────────────────────────────────
    this.input.keyboard?.on('keydown-LEFT',  () => this.shiftFocus(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.shiftFocus(1));
    this.input.keyboard?.on('keydown-UP',    () => this.switchSection(-1));
    this.input.keyboard?.on('keydown-DOWN',  () => this.switchSection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC',   () => this.back());

    this.refreshAll();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private createBackground(): void {
    const gfx = this.add.graphics();
    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(4 + (10 - 4) * t);
      const g = Math.round(0 + (4 - 0) * t);
      const b = Math.round(20 + (40 - 20) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }

    // Panel for hero row
    const panel = gfx;
    panel.fillStyle(0x06101e, 0.82);
    panel.fillRoundedRect(ROW_START_X - 6, 30, 4 * BOX_STEP - BOX_GAP + 12 + 12, 112, 4);
    panel.lineStyle(1, 0x334466, 0.7);
    panel.strokeRoundedRect(ROW_START_X - 6, 30, 4 * BOX_STEP - BOX_GAP + 12 + 12, 112, 4);
  }

  private createPortraitRow(
    rowCenterY: number,
    sprites: Phaser.GameObjects.Sprite[],
    bgs: Phaser.GameObjects.Graphics[],
    isCompanion: boolean
  ): void {
    CHARACTER_ORDER.forEach((type, idx) => {
      const cfg = CHARACTER_CONFIGS[type];
      const cx = ROW_START_X + idx * BOX_STEP + BOX_SIZE / 2;
      const cy = rowCenterY;

      const bg = this.add.graphics();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(cx - BOX_SIZE / 2, cy - BOX_SIZE / 2, BOX_SIZE, BOX_SIZE, 3);
      bgs.push(bg);

      const portraitKey = this.resolvePortraitKey(cfg.spriteKey);
      const sprite = this.add.sprite(cx, cy, portraitKey);
      const animKey = `${cfg.spriteKey}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);
      sprite.setScale(0.9);
      sprites.push(sprite);

      // Name label
      this.add.text(cx, cy + BOX_SIZE / 2 + 3, cfg.label.substring(0, 4).toUpperCase(), {
        fontFamily: '"Press Start 2P"', fontSize: '4px', color: '#556677', resolution: 2,
      }).setOrigin(0.5, 0);

      // Companion aura indicator
      if (isCompanion) {
        this.add.arc(cx, cy, BOX_SIZE / 2 + 2, 0, 360, false, 0x8844ff, 0.12).setDepth(0);
      }
    });
  }

  private createPersonalityRow(rowY: number): void {
    PERSONALITIES.forEach((p, idx) => {
      const cx = ROW_START_X + idx * BOX_STEP + BOX_SIZE / 2;
      const text = this.add.text(cx, rowY, p.label, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#667788',
        resolution: 2,
      }).setOrigin(0.5);
      this.personalityTexts.push(text);
    });
  }

  private resolvePortraitKey(spriteKey: string): string {
    const idleKey = `${spriteKey}_idle_anim_f0`;
    if (this.textures.exists(idleKey)) return idleKey;
    const animKey = `${spriteKey}_anim_f0`;
    if (this.textures.exists(animKey)) return animKey;
    return '__MISSING';
  }

  private shiftFocus(dir: number): void {
    switch (this.focused) {
      case 'hero':
        this.heroIndex = (this.heroIndex + dir + 4) % 4;
        break;
      case 'companion':
        this.companionIndex = (this.companionIndex + dir + 4) % 4;
        break;
      case 'personality':
        this.personalityIndex = (this.personalityIndex + dir + 4) % 4;
        break;
    }
    AudioManager.playSFX(this, 'menu_hover');
    this.refreshAll();
  }

  private switchSection(dir: number): void {
    const sections: FocusedSection[] = ['hero', 'companion', 'personality'];
    const current = sections.indexOf(this.focused);
    this.focused = sections[(current + dir + 3) % 3];
    AudioManager.playSFX(this, 'menu_hover');
    this.refreshAll();
  }

  private refreshAll(): void {
    this.refreshPortraitRow(this.heroSprites, this.heroBgs, this.heroIndex, this.focused === 'hero', false);
    this.refreshPortraitRow(this.companionSprites, this.companionBgs, this.companionIndex, this.focused === 'companion', true);
    this.refreshPersonalityRow();

    // Update personality description
    const p = PERSONALITIES[this.personalityIndex];
    this.personalityDescText?.setText(p.desc);

    // Section label hint
    const sectionNames: Record<FocusedSection, string> = {
      hero: 'YOUR HERO',
      companion: 'AI COMPANION',
      personality: 'PERSONALITY',
    };
    this.sectionLabel?.setText(`[▲▼] Switch   [◄►] ${sectionNames[this.focused]}   [ENTER] Confirm`);
  }

  private refreshPortraitRow(
    sprites: Phaser.GameObjects.Sprite[],
    bgs: Phaser.GameObjects.Graphics[],
    selectedIdx: number,
    isFocused: boolean,
    isCompanion: boolean
  ): void {
    sprites.forEach((sprite, idx) => {
      const bg = bgs[idx];
      if (!bg) return;
      bg.clear();
      const cx = sprite.x;
      const cy = sprite.y;

      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(cx - BOX_SIZE / 2, cy - BOX_SIZE / 2, BOX_SIZE, BOX_SIZE, 3);

      if (idx === selectedIdx) {
        const outlineColor = isCompanion ? 0x8844ff : 0xffdd00;
        bg.lineStyle(isFocused ? 2 : 1, outlineColor, isFocused ? 1 : 0.5);
        bg.strokeRoundedRect(cx - BOX_SIZE / 2 - 1, cy - BOX_SIZE / 2 - 1, BOX_SIZE + 2, BOX_SIZE + 2, 3);
        sprite.setAlpha(1);
      } else {
        sprite.setAlpha(0.45);
      }
    });
  }

  private refreshPersonalityRow(): void {
    PERSONALITIES.forEach((p, idx) => {
      const text = this.personalityTexts[idx];
      if (!text) return;
      const isFocused = this.focused === 'personality';
      if (idx === this.personalityIndex) {
        text.setColor(isFocused ? p.color : '#aabbcc');
        text.setStroke('#000000', isFocused ? 2 : 0);
      } else {
        text.setColor('#445566');
        text.setStroke('#000000', 0);
      }
    });
  }

  private confirm(): void {
    AudioManager.playSFX(this, 'ui_click');

    const heroCfg = CHARACTER_CONFIGS[CHARACTER_ORDER[this.heroIndex]];
    const companionCfg = CHARACTER_CONFIGS[CHARACTER_ORDER[this.companionIndex]];

    // Configure coop state before launching LevelScene
    CoopState.set({
      isCoopMode: true,
      companionPersonality: PERSONALITIES[this.personalityIndex].key,
      companionSpriteKey: companionCfg.spriteKey,
      voiceEnabled: false,
    });

    // Set player character in GameState
    const state = GameState.get();
    state.reset();
    state.setCharacter(CHARACTER_ORDER[this.heroIndex]);

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelScene', { level: 1 });
    });
  }

  private back(): void {
    AudioManager.playSFX(this, 'menu_hover');
    CoopState.reset();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
