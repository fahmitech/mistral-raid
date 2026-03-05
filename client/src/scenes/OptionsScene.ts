import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import { OptionsData } from '../config/types';
import { OptionsOverlay } from '../ui/OptionsOverlay';

interface OptionRow {
  key: keyof OptionsData;
  label: string;
}

export class OptionsScene extends Phaser.Scene {
  private options: OptionsData = SaveSystem.loadOptions();
  private rows: OptionRow[] = [];
  private selectedIndex = 0;
  private fromPause = false;
  private overlay?: OptionsOverlay;
  private toastMessage = '';
  private toastTimer?: Phaser.Time.TimerEvent;

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

    this.rows = [
      { key: 'soundOn', label: 'Sound' },
      { key: 'musicOn', label: 'Music' },
      { key: 'screenShake', label: 'Screen Shake' },
      { key: 'fullscreen', label: 'Fullscreen' },
    ];

    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error('OptionsScene: canvas parent missing');
    parent.querySelectorAll<HTMLDivElement>('[data-options-overlay="true"]').forEach((node) => node.remove());
    this.overlay = new OptionsOverlay(parent, {
      rows: this.rows.map((row) => row.label.toUpperCase()),
      onSelect: (idx) => {
        if (this.selectedIndex !== idx) {
          this.selectedIndex = idx;
          this.refresh();
          AudioManager.playSFX(this, 'menu_hover');
        }
      },
      onToggle: (idx) => {
        this.selectedIndex = idx;
        this.toggle();
      },
      onReset: () => this.resetSave(),
      onBack: () => this.back(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownOverlay());

    this.refresh();

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.toggle());
    this.input.keyboard?.on('keydown-ESC', () => this.back());
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
    const rows = this.rows.map((row) => ({
      label: row.label,
      value: this.options[row.key] ? 'ON' : 'OFF',
    }));
    this.overlay?.render({
      rows,
      selectedIndex: this.selectedIndex,
      toast: this.toastMessage || undefined,
    });
  }

  private resetSave(): void {
    AudioManager.playSFX(this, 'ui_click');
    SaveSystem.deleteSave();
    this.setToast('Save data cleared.');
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

  private setToast(message: string): void {
    this.toastMessage = message;
    this.refresh();
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(1400, () => {
      this.toastMessage = '';
      this.refresh();
    });
  }

  private teardownOverlay(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.toastTimer?.remove();
    this.toastTimer = undefined;
  }
}
