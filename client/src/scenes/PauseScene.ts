import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

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
    this.scene.pause('LevelScene');
    AudioManager.get().playSFX('pause_whoosh', 0.7);

    this.add.rectangle(160, 90, 320, 180, 0x000000, 0.65).setScrollFactor(0);
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0f1e, 0.95);
    panel.fillRoundedRect(60, 36, 200, 112, 8);
    panel.lineStyle(2, 0x263d6a, 0.95);
    panel.strokeRoundedRect(60, 36, 200, 112, 8);

    this.add
      .text(160, 52, 'PAUSED', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(160, 70, 'TAKE A BREATH', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#9fb4ff',
      })
      .setOrigin(0.5);

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

    const startY = 96;
    const spacing = 24;

    this.items.forEach((item, idx) => {
      const text = this.add
        .text(160, startY + idx * spacing, `[ ${item.label.toUpperCase()} ]`, {
          fontFamily: '"Press Start 2P"',
          fontSize: '10px',
          color: '#b5c7ff',
          stroke: '#000000',
          strokeThickness: 4,
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
      const active = idx === this.selectedIndex;
      item.text
        .setColor(active ? '#fff799' : '#b5c7ff')
        .setScale(active ? 1.05 : 1)
        .setAlpha(active ? 1 : 0.85);
    });
  }

  private activate(): void {
    this.items[this.selectedIndex].action();
  }
}
