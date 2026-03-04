import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { DifficultyManager, type Difficulty } from '../systems/DifficultyManager';

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
    for (let y = 0; y < 180; y++) {
      const t = y / 180;
      const r = Math.round(4 + (14 - 4) * t);
      const g = Math.round(2 + (6 - 2) * t);
      const b = Math.round(18 + (36 - 18) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }

    this.add
      .text(160, 18, 'SELECT DIFFICULTY', {
        fontFamily: '"Pixel Operator 8", "Press Start 2P"',
        fontSize: '8px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Separator line
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x334455, 0.8);
    sep.lineBetween(30, 30, 290, 30);

    // Difficulty rows
    OPTIONS.forEach((opt, idx) => {
      const y = 56 + idx * 40;

      opt.textObj = this.add
        .text(160, y, opt.label, {
          fontFamily: '"Pixel Operator 8", "Press Start 2P"',
          fontSize: '8px',
          color: opt.color,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      opt.descObj = this.add
        .text(160, y + 14, opt.desc, {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#778899',
          align: 'center',
          wordWrap: { width: 280 },
        })
        .setOrigin(0.5);

      opt.textObj.on('pointerover', () => {
        if (this.selectedIndex !== idx) {
          this.selectedIndex = idx;
          this.refresh();
          AudioManager.playSFX(this, 'menu_hover');
        }
      });
      opt.textObj.on('pointerdown', () => {
        this.selectedIndex = idx;
        this.confirm();
      });
    });

    // Buttons row
    const backText = this.add
      .text(60, 166, '[ BACK ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#778899',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const confirmText = this.add
      .text(250, 166, '[ CONFIRM ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backText.on('pointerdown', () => this.back());
    confirmText.on('pointerdown', () => this.confirm());

    this.input.keyboard?.on('keydown-UP',    () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN',  () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC',   () => this.back());

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.refresh();
  }

  private move(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + OPTIONS.length) % OPTIONS.length;
    this.refresh();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private refresh(): void {
    OPTIONS.forEach((opt, idx) => {
      const selected = idx === this.selectedIndex;
      opt.textObj?.setAlpha(selected ? 1 : 0.45);
      opt.descObj?.setColor(selected ? '#aabbcc' : '#445566');
      if (selected) {
        opt.textObj?.setScale(1.05);
      } else {
        opt.textObj?.setScale(1);
      }
    });
  }

  private confirm(): void {
    const chosen = OPTIONS[this.selectedIndex];
    DifficultyManager.get().setDifficulty(chosen.key);
    AudioManager.playSFX(this, 'ui_click');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelScene', { level: 1 });
    });
  }

  private back(): void {
    AudioManager.playSFX(this, 'menu_hover');
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.fromScene);
    });
  }
}
