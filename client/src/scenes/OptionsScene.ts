import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import { OptionsData } from '../config/types';
import { createReadableText } from '../utils/createReadableText';

interface OptionRow {
  key: keyof OptionsData;
  label: string;
  text?: Phaser.GameObjects.Text;
}

export class OptionsScene extends Phaser.Scene {
  private options: OptionsData = SaveSystem.loadOptions();
  private rows: OptionRow[] = [];
  private selectedIndex = 0;
  private fromPause = false;
  private toast?: Phaser.GameObjects.Text;

  constructor() {
    super('OptionsScene');
  }

  init(data: { fromPause?: boolean }): void {
    this.fromPause = !!data?.fromPause;
  }

  create(): void {
    AudioManager.get().init(this);

    if (this.fromPause) {
      this.add.rectangle(160, 90, 320, 180, 0x000000, 0.6).setScrollFactor(0);
    } else {
      const gfx = this.add.graphics();
      for (let y = 0; y < 180; y += 1) {
        const t = y / 180;
        const r = Math.round(2 + (10 - 2) * t);
        const g = Math.round(1 + (6 - 1) * t);
        const b = Math.round(20 + (40 - 20) * t);
        gfx.fillStyle((r << 16) + (g << 8) + b, 1);
        gfx.fillRect(0, y, 320, 1);
      }
      this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    createReadableText(this, 160, 24, 'OPTIONS', {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.rows = [
      { key: 'soundOn', label: 'Sound' },
      { key: 'musicOn', label: 'Music' },
      { key: 'screenShake', label: 'Screen Shake' },
      { key: 'fullscreen', label: 'Fullscreen' },
    ];

    this.rows.forEach((row, idx) => {
      row.text = createReadableText(this, 80, 52 + idx * 16, '', {
          fontFamily: '"Press Start 2P"',
          fontSize: '5px',
          color: '#aabbcc',
        })
        .setOrigin(0, 0.5);
    });

    const resetText = createReadableText(this, 160, 130, '[ RESET SAVE DATA ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ff6666',
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    resetText.on('pointerdown', () => this.resetSave());

    const backText = createReadableText(this, 160, 150, '[ BACK ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#cccccc',
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    backText.on('pointerdown', () => this.back());

    this.toast = this.add
      .text(160, 166, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    this.refresh();

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.toggle());
    this.input.keyboard?.on('keydown-ESC', () => this.back());

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.rows.forEach((row, idx) => {
        if (row.text && row.text.getBounds().contains(pointer.x, pointer.y)) {
          if (this.selectedIndex !== idx) {
            this.selectedIndex = idx;
            this.refresh();
            AudioManager.playSFX(this, 'menu_hover');
          }
        }
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.rows.forEach((row, idx) => {
        if (row.text && row.text.getBounds().contains(pointer.x, pointer.y)) {
          this.selectedIndex = idx;
          this.toggle();
        }
      });
      if (resetText.getBounds().contains(pointer.x, pointer.y)) {
        AudioManager.playSFX(this, 'ui_click');
      }
      if (backText.getBounds().contains(pointer.x, pointer.y)) {
        AudioManager.playSFX(this, 'menu_hover');
      }
    });
  }

  private move(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + this.rows.length) % this.rows.length;
    this.refresh();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private toggle(): void {
    const row = this.rows[this.selectedIndex];
    this.options[row.key] = !this.options[row.key];
    if (row.key === 'fullscreen') {
      if (this.options.fullscreen) {
        this.scale.startFullscreen();
      } else {
        this.scale.stopFullscreen();
      }
    }
    SaveSystem.saveOptions(this.options);
    AudioManager.get().setOptions(this.options);
    this.refresh();
    AudioManager.playSFX(this, 'ui_click');
  }

  private refresh(): void {
    this.rows.forEach((row, idx) => {
      if (!row.text) return;
      const value = this.options[row.key] ? 'ON' : 'OFF';
      row.text.setText(`${row.label.toUpperCase()}: ${value}`);
      row.text.setColor(idx === this.selectedIndex ? '#ffdd00' : '#aabbcc');
    });
  }

  private resetSave(): void {
    AudioManager.playSFX(this, 'ui_click');
    SaveSystem.deleteSave();
    if (!this.toast) return;
    this.toast.setText('Save data cleared.');
    this.time.delayedCall(1200, () => this.toast?.setText(''));
  }

  private back(): void {
    AudioManager.playSFX(this, 'menu_hover');
    if (this.fromPause) {
      this.scene.stop();
      this.scene.launch('PauseScene');
    } else {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    }
  }
}
