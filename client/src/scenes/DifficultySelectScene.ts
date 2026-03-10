import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { DifficultyManager, type Difficulty } from '../systems/DifficultyManager';
import { DifficultySelectOverlay, type DifficultyOption } from '../ui/DifficultySelectOverlay';

const W = 320;
const H = 180;

const CARD_CONFIGS: DifficultyOption[] = [
  {
    key: 'easy',
    rank: 'RANK I',
    name: "WANDERER'S PATH",
    tagline: '"The dungeon remembers those who survived."',
    tag: 'NOVICE',
    icon: '✦',
    accentHex: '#44dd88',
    stats: [
      { label: 'Enemies', value: '-30% HP, slower patrol routes' },
      { label: 'Player', value: '+20% damage, +1 revive charge' },
      { label: 'Boss Rhythm', value: 'Longer telegraphs, trimmed combos' },
      { label: 'Loot Bias', value: 'Extra potions & shards' },
    ],
  },
  {
    key: 'medium',
    rank: 'RANK II',
    name: 'BLOOD & IRON',
    tagline: '"As the dungeon was always meant to be."',
    tag: 'DEFAULT',
    icon: '⚔',
    accentHex: '#ffcc44',
    stats: [
      { label: 'Encounter Pace', value: 'Baseline HP, DMG, density' },
      { label: 'AI Director', value: 'Full telemetry + adaptive waves' },
      { label: 'Boss Rhythm', value: 'Intended feints & phase shifts' },
      { label: 'Loot Bias', value: 'Balanced drops & curios' },
    ],
  },
  {
    key: 'hard',
    rank: 'RANK III',
    name: 'ABYSS ETERNAL',
    tagline: '"No light reaches this far. No mercy either."',
    tag: 'CURSED',
    icon: '☠',
    accentHex: '#ff5555',
    stats: [
      { label: 'Enemies', value: '+30% HP, +12% speed' },
      { label: 'Boss Core', value: '+40% HP, strikes +20%' },
      { label: 'Director Aggro', value: 'Prefers elites & ambushes' },
      { label: 'Loot Bias', value: 'Sparse healing, cursed gear' },
    ],
  },
];

export class DifficultySelectScene extends Phaser.Scene {
  private selectedIndex = 1;
  private fromScene = 'PlayerSelectScene';

  private overlay?: DifficultySelectOverlay;

  constructor() {
    super('DifficultySelectScene');
  }

  init(data: { fromScene?: string }): void {
    this.fromScene = data?.fromScene ?? 'PlayerSelectScene';

    const current = DifficultyManager.get().getDifficulty();
    const idx = CARD_CONFIGS.findIndex((c) => c.key === current);
    this.selectedIndex = idx >= 0 ? idx : 1;
  }

  create(): void {
    AudioManager.get().init(this);

    this.cameras.main.setBackgroundColor('#06070d');
    this.cameras.main.roundPixels = true;

    this._buildBackground();
    this._mountOverlay();
    this._bindKeys();

    this._renderOverlay();
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  private _buildBackground(): void {
    const bg = this.add.graphics();

    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      const color = this._lerpColor(0x0b0c16, 0x14101f, t);
      bg.fillStyle(color, 1);
      bg.fillRect(0, y, W, 1);
    }

    for (let i = 0; i < 5; i++) {
      const alpha = 0.045 - i * 0.007;
      const pad = i * 8;
      bg.fillStyle(0x5a2b86, Math.max(alpha, 0.008));
      bg.fillEllipse(W / 2, 82, 180 + pad * 2, 92 + pad);
    }

    const vignette = this.add.graphics();
    for (let i = 0; i < 6; i++) {
      vignette.fillStyle(0x000000, 0.035);
      vignette.fillRoundedRect(-i * 2, -i * 2, W + i * 4, H + i * 4, 10);
    }

    const footerFade = this.add.graphics();
    for (let y = H - 40; y < H; y++) {
      const t = (y - (H - 40)) / 40;
      footerFade.fillStyle(0x020204, t * 0.45);
      footerFade.fillRect(0, y, W, 1);
    }

    const particles = this.add.graphics();
    particles.fillStyle(0xd3b786, 0.2);
    for (let i = 0; i < 18; i++) {
      particles.fillRect(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(10, 70),
        1,
        1,
      );
    }
  }

  private _mountOverlay(): void {
    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error('DifficultySelectScene: canvas parent missing');

    this.overlay?.destroy();
    this.overlay = new DifficultySelectOverlay(parent, {
      options: CARD_CONFIGS,
      initialIndex: this.selectedIndex,
      onSelect: (index) => {
        if (this.selectedIndex === index) return;
        this.selectedIndex = index;
        this._renderOverlay();
        AudioManager.playSFX(this, 'menu_hover');
      },
      onConfirm: () => this._confirm(),
      onBack: () => this._back(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });
  }

  private _bindKeys(): void {
    this.input.keyboard?.on('keydown-LEFT', () => this._move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this._move(1));
    this.input.keyboard?.on('keydown-UP', () => this._move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this._move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this._confirm());
    this.input.keyboard?.on('keydown-ESC', () => this._back());
  }

  private _move(direction: number): void {
    this.selectedIndex =
      (this.selectedIndex + direction + CARD_CONFIGS.length) % CARD_CONFIGS.length;

    this._renderOverlay();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private _renderOverlay(): void {
    this.overlay?.render(this.selectedIndex);
  }

  private _confirm(): void {
    const config = CARD_CONFIGS[this.selectedIndex];
    if (!config) return;
    DifficultyManager.get().setDifficulty(config.key);

    AudioManager.playSFX(this, 'ui_click');

    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelScene', { level: 1 });
    });
  }

  private _back(): void {
    AudioManager.playSFX(this, 'menu_hover');

    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.fromScene);
    });
  }

  private _lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;

    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;

    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);

    return (rr << 16) | (rg << 8) | rb;
  }
}
