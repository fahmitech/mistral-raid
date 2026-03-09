import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { COMPANION_GUIDES, type CompanionGuide } from '../config/companionGuides';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';
import { CoopState, type CompanionPersonality } from '../systems/CoopState';
import { CoopSelectOverlay, type CoopSection, type CoopSelectOverlayState, type CoopHeroOption, type PersonalityOption } from '../ui/CoopSelectOverlay';
import { FRAME_URLS } from '../utils/assetManifest';

// Hero extended info for the card display
const HERO_INFO: Record<CharacterType, { role: string; shortDescription: string; accentHex: string; difficulty: string }> = {
  [CharacterType.Knight]: {
    role: 'TANK',
    shortDescription: 'A balanced warrior with strong defense and steady offense. Perfect for learning the dungeon.',
    accentHex: '#4a90d9',
    difficulty: 'Forgiving',
  },
  [CharacterType.Rogue]: {
    role: 'STRIKER',
    shortDescription: 'Lightning-fast attacker with rapid fire. Low HP demands skilled play.',
    accentHex: '#7ed957',
    difficulty: 'Steady',
  },
  [CharacterType.Mage]: {
    role: 'CASTER',
    shortDescription: 'Devastating spell damage at the cost of fragility. High risk, high reward.',
    accentHex: '#c084fc',
    difficulty: 'Advanced',
  },
  [CharacterType.Paladin]: {
    role: 'JUGGERNAUT',
    shortDescription: 'An iron tank with maximum HP and heavy hits. Slow but unstoppable.',
    accentHex: '#f59e0b',
    difficulty: 'Steady',
  },
};

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

type FocusedSection = CoopSection;

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

  // Focus
  private focused: FocusedSection = 'hero';

  // Info labels
  private overlay?: CoopSelectOverlay;

  constructor() {
    super('CoopSelectScene');
  }

  create(): void {
    // Phaser reuses scene instances — always reset per-run state before rebuilding.
    this.heroSprites = [];
    this.heroBgs = [];
    this.companionSprites = [];
    this.companionBgs = [];
    this.heroIndex = 0;
    this.companionIndex = 1;
    this.personalityIndex = 3;
    this.focused = 'hero';
    this.overlay?.destroy();
    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error('CoopSelectScene: canvas parentElement missing');
    const heroOptions: CoopHeroOption[] = CHARACTER_ORDER.map((type) => {
      const cfg = CHARACTER_CONFIGS[type];
      const info = HERO_INFO[type];
      // Normalize stats to 0-1 range for display
      const maxHP = 8;
      const maxSpeed = 145;
      const maxDamage = 2.0;
      const maxFireRate = 420;
      return {
        label: cfg.label.toUpperCase(),
        role: info.role,
        shortDescription: info.shortDescription,
        accentHex: info.accentHex,
        image: this.resolvePortraitUrl(cfg.spriteKey) ?? null,
        stats: {
          health: cfg.maxHP / maxHP,
          speed: cfg.speed / maxSpeed,
          power: cfg.damage / maxDamage,
          attackSpeed: 1 - (cfg.fireRate / maxFireRate), // Lower fireRate = faster attacks
        },
        difficulty: info.difficulty,
      };
    });
    const companionOptions = COMPANION_GUIDES.map((guide) => ({
      label: guide.label,
      image: this.createCompanionPreview(guide),
    }));
    const personalityOptions: PersonalityOption[] = PERSONALITIES.map((p) => ({
      key: p.key,
      label: p.label,
      color: p.color,
      icon: this.getPersonalityIcon(p.key),
      desc: p.desc,
    }));
    this.overlay = new CoopSelectOverlay(parent, {
      heroes: heroOptions,
      companions: companionOptions,
      companionDetails: COMPANION_GUIDES,
      personalities: personalityOptions,
      onSelect: (section, index) => this.handleOverlaySelect(section, index),
      onBack: () => this.back(),
      onConfirm: () => this.confirm(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });

    AudioManager.get().init(this);
    this.createBackground();

    // ── Hero section ───────────────────────────────────────────────────────
    this.createPortraitRow(56, this.heroSprites, this.heroBgs, this.getHeroSpriteKeys(), false);

    // ── Companion section ──────────────────────────────────────────────────
    this.createPortraitRow(110, this.companionSprites, this.companionBgs, COMPANION_GUIDES.map((guide) => guide.spriteKey), true);

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
    const panelWidth = 4 * BOX_STEP - BOX_GAP + 24;
    const panelHeight = 152;
    panel.fillStyle(0x06101e, 0.82);
    panel.fillRoundedRect(ROW_START_X - 6, 28, panelWidth, panelHeight, 6);
    panel.lineStyle(1, 0x334466, 0.7);
    panel.strokeRoundedRect(ROW_START_X - 6, 28, panelWidth, panelHeight, 6);
  }

  private createPortraitRow(
    rowCenterY: number,
    sprites: Phaser.GameObjects.Sprite[],
    bgs: Phaser.GameObjects.Graphics[],
    spriteKeys: string[],
    isCompanion: boolean
  ): void {
    spriteKeys.forEach((spriteKey, idx) => {
      const cx = ROW_START_X + idx * BOX_STEP + BOX_SIZE / 2;
      const cy = rowCenterY;

      const bg = this.add.graphics();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(cx - BOX_SIZE / 2, cy - BOX_SIZE / 2, BOX_SIZE, BOX_SIZE, 3);
      bgs.push(bg);

      const portraitKey = this.resolvePortraitKey(spriteKey);
      const sprite = this.add.sprite(cx, cy, portraitKey);
      const animKey = `${spriteKey}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);
      sprite.setScale(0.9);
      sprites.push(sprite);

      // Companion aura indicator
      if (isCompanion) {
        this.add.arc(cx, cy, BOX_SIZE / 2 + 2, 0, 360, false, 0x8844ff, 0.12).setDepth(0);
      }
    });
  }

  private resolvePortraitKey(spriteKey: string): string {
    const idleKey = `${spriteKey}_idle_anim_f0`;
    if (this.textures.exists(idleKey)) return idleKey;
    const animKey = `${spriteKey}_anim_f0`;
    if (this.textures.exists(animKey)) return animKey;
    return '__MISSING';
  }

  private resolvePortraitUrl(spriteKey: string): string | undefined {
    const candidates = [
      `${spriteKey}_idle_anim_f0`,
      `${spriteKey}_idle_anim_f1`,
      `${spriteKey}_idle`,
      spriteKey,
    ];
    for (const key of candidates) {
      const url = FRAME_URLS[key];
      if (url) return url;
    }
    return undefined;
  }

  private getHeroSpriteKeys(): string[] {
    return CHARACTER_ORDER.map((type) => CHARACTER_CONFIGS[type].spriteKey);
  }

  private getPersonalityIcon(key: string): string {
    const map: Record<string, string> = {
      aggressive: '⚔️',
      tactical: '🎯',
      protector: '🛡️',
      balanced: '⚖️',
    };
    return map[key] ?? '★';
  }

  private createCompanionPreview(guide: CompanionGuide): string | null {
    const art = guide.pixelArt;
    if (!art || art.frames.length === 0) return null;
    const frame = art.frames[0];
    const size = frame.length;
    let rects = '';
    frame.forEach((row, y) => {
      row.split('').forEach((symbol, x) => {
        const color = art.palette[symbol];
        if (!color || color === 'transparent') return;
        rects += `<rect x=\"${x}\" y=\"${y}\" width=\"1\" height=\"1\" fill=\"${color}\" />`;
      });
    });
    const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${size} ${size}\">${rects}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

    const overlayState: CoopSelectOverlayState = {
      heroIndex: this.heroIndex,
      companionIndex: this.companionIndex,
      personalityIndex: this.personalityIndex,
      focused: this.focused as CoopSection,
      description: PERSONALITIES[this.personalityIndex].desc,
      companionDetail: COMPANION_GUIDES[this.companionIndex] ?? COMPANION_GUIDES[0],
    };
    this.overlay?.render(overlayState);
  }

  private handleOverlaySelect(section: CoopSection, index: number): void {
    const prevHero = this.heroIndex;
    const prevCompanion = this.companionIndex;
    const prevPersonality = this.personalityIndex;
    const prevFocus = this.focused;

    switch (section) {
      case 'hero':
        this.heroIndex = Phaser.Math.Wrap(index, 0, this.heroSprites.length);
        break;
      case 'companion':
        this.companionIndex = Phaser.Math.Wrap(index, 0, this.companionSprites.length);
        break;
      case 'personality':
        this.personalityIndex = Phaser.Math.Wrap(index, 0, PERSONALITIES.length);
        break;
    }
    this.focused = section;

    if (
      prevHero === this.heroIndex &&
      prevCompanion === this.companionIndex &&
      prevPersonality === this.personalityIndex &&
      prevFocus === section
    ) {
      return;
    }

    AudioManager.playSFX(this, 'menu_hover');
    this.refreshAll();
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

  private confirm(): void {
    AudioManager.playSFX(this, 'ui_click');

    const heroCfg = CHARACTER_CONFIGS[CHARACTER_ORDER[this.heroIndex]];
    const companionGuide = COMPANION_GUIDES[this.companionIndex] ?? COMPANION_GUIDES[0];

    // Configure coop state before launching LevelScene
    CoopState.set({
      isCoopMode: true,
      companionPersonality: PERSONALITIES[this.personalityIndex].key,
      companionSpriteKey: companionGuide.spriteKey,
      voiceEnabled: false,
    });

    // Set player character in GameState
    const state = GameState.get();
    state.reset();
    state.setCharacter(CHARACTER_ORDER[this.heroIndex]);

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DifficultySelectScene', { fromScene: 'CoopSelectScene' });
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
