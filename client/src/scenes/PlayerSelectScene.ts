import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';
import { CoopState } from '../systems/CoopState';
import { SoloSelectOverlay, type SoloHeroOption, type SoloHeroStat } from '../ui/SoloSelectOverlay';
import { FRAME_URLS } from '../utils/assetManifest';

const CHARACTER_ORDER: CharacterType[] = [
  CharacterType.Knight,
  CharacterType.Rogue,
  CharacterType.Mage,
  CharacterType.Paladin,
];

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
    this.overlay = new SoloSelectOverlay(parent, this.game.canvas, {
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
    const stats: SoloHeroStat[] = [
      { label: 'HP', value: cfg.maxHP, max: 8, color: '#ff6666' },
      { label: 'SPD', value: cfg.speed, max: 145, color: '#44a0ff' },
      { label: 'DMG', value: cfg.damage, max: 2, color: '#ff9933' },
      { label: 'RATE', value: 420 - cfg.fireRate, max: 420, color: '#33cc77' },
    ];
    return {
      label: cfg.label.toUpperCase(),
      description: cfg.desc,
      image: this.resolvePortraitUrl(cfg.spriteKey) ?? null,
      stats,
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
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    for (let y = 0; y < height; y += 1) {
      const t = y / height;
      const r = Math.round(2 + (8 - 2) * t);
      const g = Math.round(0 + (6 - 0) * t);
      const b = Math.round(16 + (30 - 16) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, width, 1);
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

