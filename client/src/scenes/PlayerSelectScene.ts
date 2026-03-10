import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';
import { CoopState } from '../systems/CoopState';
import { SoloSelectOverlay, type SoloHeroOption, type SoloHeroStats } from '../ui/SoloSelectOverlay';
import { FRAME_URLS } from '../utils/assetManifest';

const CHARACTER_ORDER: CharacterType[] = [
  CharacterType.Knight,
  CharacterType.Rogue,
  CharacterType.Mage,
  CharacterType.Paladin,
];

interface HeroMeta {
  role: string;
  accentHex: string;
  shortDescription: string;
  longDescription: string;
  special: string;
  difficulty: string;
}

const HERO_CARD_META: Record<CharacterType, HeroMeta> = {
  [CharacterType.Knight]: {
    role: 'Vanguard',
    accentHex: '#f4c56d',
    shortDescription: 'Shielded frontline champion built to weather hits.',
    longDescription: 'A steadfast knight who turns every advance into momentum. Heavy armor and disciplined strikes keep the squad anchored while others push ahead.',
    special: 'Bulwark Entry: Begins each expedition with a barrier that blocks one lethal blow.',
    difficulty: 'Forgiving',
  },
  [CharacterType.Rogue]: {
    role: 'Skirmisher',
    accentHex: '#5fe0ae',
    shortDescription: 'Blinding speed, evasive momentum, precision knives.',
    longDescription: 'A darting duelist who controls the pace of battle. She thrives on spacing, weaving through danger to carve foes before they can react.',
    special: 'Shadow Dash: Gain a burst of speed after every dodge, letting you reposition instantly.',
    difficulty: 'Advanced',
  },
  [CharacterType.Mage]: {
    role: 'Arcanist',
    accentHex: '#8ec9ff',
    shortDescription: 'Glass cannon caster with reality-bending volleys.',
    longDescription: 'Fragile but unstoppable once channeling. The mage floods the arena with piercing spells that delete threats in carefully lined volleys.',
    special: 'Arc Burst: Charged projectiles explode on impact, splashing damage in a small radius.',
    difficulty: 'Expert',
  },
  [CharacterType.Paladin]: {
    role: 'Warden',
    accentHex: '#f892d2',
    shortDescription: 'Holy tank who sustains the line with radiant strikes.',
    longDescription: 'A relentless guardian that turns endurance into offense. Swinging wide arcs, the paladin sustains allies by outlasting anything in the path.',
    special: 'Sanctified Roar: Emits a pulse that weakens nearby foes after blocking damage.',
    difficulty: 'Steady',
  },
};

export class PlayerSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private overlay?: SoloSelectOverlay;
  private heroOptions: SoloHeroOption[] = [];

  constructor() {
    super('PlayerSelectScene');
  }

  create(): void {
    AudioManager.get().init(this);
    this.createBackground();
    this.heroOptions = CHARACTER_ORDER.map((type) => this.buildHeroOption(type));

    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error('PlayerSelectScene: canvas parent missing');

    parent.querySelectorAll<HTMLDivElement>('[data-solo-overlay="true"]').forEach((node) => node.remove());
    this.overlay = new SoloSelectOverlay(parent, {
      heroes: this.heroOptions,
      onSelect: (index) => {
        if (index === this.selectedIndex) return;
        this.selectedIndex = index;
        AudioManager.playSFX(this, 'menu_hover');
        this.updateOverlay();
      },
      onConfirm: () => this.confirm(),
      onBack: () => this.back(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownOverlay());

    this.setupInput();
    this.updateOverlay();
  }

  private setupInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-A', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-D', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  private moveSelection(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
    AudioManager.playSFX(this, 'menu_hover');
    this.updateOverlay();
  }

  private updateOverlay(): void {
    this.overlay?.render(this.selectedIndex);
  }

  private buildHeroOption(type: CharacterType): SoloHeroOption {
    const cfg = CHARACTER_CONFIGS[type];
    const meta = HERO_CARD_META[type];
    const stats = this.buildHeroStats(cfg);
    return {
      label: cfg.label.toUpperCase(),
      role: meta.role,
      shortDescription: meta.shortDescription,
      longDescription: meta.longDescription,
      accentHex: meta.accentHex,
      image: this.resolvePortraitUrl(cfg.spriteKey) ?? null,
      stats,
      special: meta.special,
      difficulty: meta.difficulty,
    };
  }

  private buildHeroStats(cfg: (typeof CHARACTER_CONFIGS)[CharacterType]): SoloHeroStats {
    const normalize = (value: number, min: number, max: number): number => {
      if (max - min <= 0) return 0;
      return Phaser.Math.Clamp((value - min) / (max - min), 0, 1);
    };
    const firePerSecond = 1000 / cfg.fireRate;
    return {
      health: normalize(cfg.maxHP, 3, 8),
      speed: normalize(cfg.speed, 80, 150),
      power: normalize(cfg.damage, 0.6, 2.2),
      attackSpeed: normalize(firePerSecond, 2.3, 5.5),
    };
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

  private createBackground(): void {
    const gfx = this.add.graphics();
    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(2 + (8 - 2) * t);
      const g = Math.round(0 + (6 - 0) * t);
      const b = Math.round(16 + (30 - 16) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }
  }

  private confirm(): void {
    AudioManager.playSFX(this, 'ui_click');
    CoopState.reset(); // ensure solo mode
    const type = CHARACTER_ORDER[this.selectedIndex];
    const state = GameState.get();
    state.reset();
    state.setCharacter(type);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DifficultySelectScene', { fromScene: 'PlayerSelectScene' });
    });
  }

  private back(): void {
    AudioManager.playSFX(this, 'menu_hover');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  private teardownOverlay(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.input.keyboard?.removeAllListeners();
  }
}
