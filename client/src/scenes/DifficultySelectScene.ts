import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { DifficultyManager, type Difficulty } from '../systems/DifficultyManager';
import { DifficultySelectOverlay } from '../ui/DifficultySelectOverlay';

interface DifficultyOption {
  key: Difficulty;
  label: string;
  desc: string;
  color: string;
  textObj?: Phaser.GameObjects.Text;
  descObj?: Phaser.GameObjects.Text;
}

const OPTIONS: DifficultyOption[] = [
  {
    key: 'easy',
    label: '[ EASY ]',
    desc: 'Enemies -30% HP  •  Player +20% DMG  •  Boss attacks slower',
    color: '#44dd88',
  },
  {
    key: 'medium',
    label: '[ MEDIUM ]',
    desc: 'Balanced challenge — default settings',
    color: '#ffdd00',
  },
  {
    key: 'hard',
    label: '[ HARD ]',
    desc: 'Enemies +30% HP  •  Boss +40% HP  •  Boss hits +20% harder',
    color: '#ff4444',
  },
];

export class DifficultySelectScene extends Phaser.Scene {
  private selectedIndex = 1; // default Medium
  private fromScene = 'PlayerSelectScene';
  private overlay?: DifficultySelectOverlay;

  constructor() {
    super('DifficultySelectScene');
  }

  init(data: { fromScene?: string }): void {
    this.fromScene = data?.fromScene ?? 'PlayerSelectScene';
    // Sync selection to whatever difficulty is currently stored
    const cur = DifficultyManager.get().getDifficulty();
    const idx = OPTIONS.findIndex((o) => o.key === cur);
    this.selectedIndex = idx >= 0 ? idx : 1;
  }

  create(): void {
    AudioManager.get().init(this);

    // Background gradient
    const gfx = this.add.graphics();
    const height = this.cameras.main.height;
    const width = this.cameras.main.width;
    const centerX = this.cameras.main.centerX;

    for (let y = 0; y < height; y++) {
      const t = y / height;
      const r = Math.round(4 + (14 - 4) * t);
      const g = Math.round(2 + (6 - 2) * t);
      const b = Math.round(18 + (36 - 18) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, width, 1);
    }

    this.overlay = new DifficultySelectOverlay(this.game.canvas.parentElement!, this.game.canvas as HTMLCanvasElement, {
      options: OPTIONS,
      selectedIndex: this.selectedIndex,
      onSelect: (idx) => {
        this.selectedIndex = idx;
        this.refresh();
        AudioManager.playSFX(this, 'menu_hover');
      },
      onConfirm: () => this.confirm(),
      onBack: () => this.back(),
    });

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => this.back());

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.refresh();
  }

  private move(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + OPTIONS.length) % OPTIONS.length;
    this.refresh();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private refresh(): void {
    this.overlay?.render(this.selectedIndex);
  }

  private confirm(): void {
    const chosen = OPTIONS[this.selectedIndex];
    DifficultyManager.get().setDifficulty(chosen.key);
    AudioManager.playSFX(this, 'ui_click');
    this.overlay?.destroy();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelScene', { level: 1 });
    });
  }

  private back(): void {
    AudioManager.playSFX(this, 'menu_hover');
    this.overlay?.destroy();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.fromScene);
    });
  }
}
