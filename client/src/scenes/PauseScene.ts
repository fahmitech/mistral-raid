import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { gameTelemetry } from '../systems/GameTelemetry';

interface PauseItem {
  label: string;
  action: () => void;
  text?: Phaser.GameObjects.Text;
}

export class PauseScene extends Phaser.Scene {
  private items: PauseItem[] = [];
  private selectedIndex = 0;

  constructor() {
    super('PauseScene');
  }

  create(): void {
    gameTelemetry.trackPlayerAction('pause');
    this.scene.pause('LevelScene');
    AudioManager.get().playSFX('pause_whoosh', 0.7);

    this.add.rectangle(160, 90, 320, 180, 0x000000, 0.55).setScrollFactor(0);
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0f1e, 0.92);
    panel.fillRoundedRect(72, 46, 176, 96, 6);
    panel.lineStyle(1, 0x224466, 0.9);
    panel.strokeRoundedRect(72, 46, 176, 96, 6);

    this.items = [
      {
        label: 'Resume',
        action: () => {
          this.scene.resume('LevelScene');
          this.scene.stop();
        },
      },
      {
        label: 'Inventory',
        action: () => {
          this.scene.resume('LevelScene');
          this.scene.stop();
          this.scene.launch('InventoryScene');
        },
      },
      {
        label: 'Options',
        action: () => {
          this.scene.launch('OptionsScene', { fromPause: true });
          this.scene.stop();
        },
      },
      {
        label: 'Main Menu',
        action: () => {
          AudioManager.get().stopMusic();
          AudioManager.get().crossFade('menu_theme');
          this.scene.stop('LevelScene');
          this.scene.stop();
          this.scene.start('MenuScene');
        },
      },
    ];

    this.items.forEach((item, idx) => {
      const text = this.add
        .text(160, 62 + idx * 18, item.label.toUpperCase(), {
          fontFamily: '"Press Start 2P"',
          fontSize: '6px',
          color: '#aabbcc',
        })
        .setOrigin(0.5);
      item.text = text;
    });

    this.refresh();

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activate());
    this.input.keyboard?.on('keydown-ESC', () => this.items[0].action());

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.items.forEach((item, idx) => {
        if (item.text && item.text.getBounds().contains(pointer.x, pointer.y)) {
          this.selectedIndex = idx;
          this.refresh();
        }
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.items.forEach((item) => {
        if (item.text && item.text.getBounds().contains(pointer.x, pointer.y)) {
          item.action();
        }
      });
    });
  }

  private move(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + this.items.length) % this.items.length;
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((item, idx) => {
      if (!item.text) return;
      item.text.setColor(idx === this.selectedIndex ? '#ffdd00' : '#aabbcc');
    });
  }

  private activate(): void {
    this.items[this.selectedIndex].action();
  }
}
