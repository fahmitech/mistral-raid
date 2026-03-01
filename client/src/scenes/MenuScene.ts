import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import { gameTelemetry } from '../systems/GameTelemetry';

interface MenuItem {
  label: string;
  action: () => void;
  enabled: boolean;
  text?: Phaser.GameObjects.Text;
}

export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private selectedIndex = 0;
  private fogBlobs: Phaser.GameObjects.Ellipse[] = [];
  private dustParticles: { sprite: Phaser.GameObjects.Ellipse; vx: number; vy: number }[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    gameTelemetry.trackSceneTransition('', 'MenuScene');
    this.createBackground();
    this.createTitle();
    this.createMenu();
    this.createControlsHint();

    // Play immediately if audio already unlocked (returning from gameplay)
    if (!this.sound.locked) {
      AudioManager.playMusic(this, 'menu_theme');
    } else {
      // First visit: wait for any user interaction to unlock
      const startMusic = () => {
        this.sound.unlock();
        AudioManager.playMusic(this, 'menu_theme');
      };
      this.input.once('pointerdown', startMusic);
      this.input.keyboard?.once('keydown', startMusic);
      this.sound.once('unlocked', () => AudioManager.playMusic(this, 'menu_theme'));
    }

    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.items.forEach((item, idx) => {
        if (!item.text) return;
        if (item.text.getBounds().contains(pointer.x, pointer.y) && item.enabled) {
          this.selectedIndex = idx;
          this.refreshMenu();
        }
      });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.items.forEach((item) => {
        if (item.text && item.text.getBounds().contains(pointer.x, pointer.y) && item.enabled) {
          item.action();
        }
      });
    });
  }

  update(time: number, delta: number): void {
    for (const blob of this.fogBlobs) {
      blob.x += (delta / 1000) * 3;
      if (blob.x > 400) blob.x = -80;
    }

    for (const particle of this.dustParticles) {
      particle.sprite.y += particle.vy;
      particle.sprite.x += particle.vx;
      if (particle.sprite.y < -10) {
        particle.sprite.y = 190;
      }
      if (particle.sprite.x < -10) particle.sprite.x = 330;
      if (particle.sprite.x > 330) particle.sprite.x = -10;
    }
  }

  private createBackground(): void {
    const gfx = this.add.graphics();
    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(2 + (12 - 2) * t);
      const g = Math.round(0 + (8 - 0) * t);
      const b = Math.round(18 + (46 - 18) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }

    for (let i = 0; i < 10; i += 1) {
      const radius = Phaser.Math.Between(45, 110);
      const blob = this.add.ellipse(
        Phaser.Math.Between(0, 320),
        Phaser.Math.Between(0, 180),
        radius * 2,
        radius * 2,
        0x1a3355,
        Phaser.Math.FloatBetween(0.03, 0.08)
      );
      this.fogBlobs.push(blob);
    }

    const colors = [0x334499, 0x2255bb, 0x5522aa, 0x1199bb];
    for (let i = 0; i < 55; i += 1) {
      const size = Phaser.Math.FloatBetween(0.5, 2.0);
      const sprite = this.add.ellipse(
        Phaser.Math.Between(0, 320),
        Phaser.Math.Between(0, 180),
        size,
        size,
        Phaser.Utils.Array.GetRandom(colors),
        Phaser.Math.FloatBetween(0.2, 0.7)
      );
      this.dustParticles.push({
        sprite,
        vx: Phaser.Math.FloatBetween(-0.25, 0.25),
        vy: Phaser.Math.FloatBetween(-0.55, -0.15),
      });
    }

    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.5);
    vignette.fillRect(0, 0, 320, 50);
    vignette.fillRect(0, 130, 320, 50);
    vignette.fillRect(0, 0, 80, 180);
    vignette.fillRect(240, 0, 80, 180);
  }

  private createTitle(): void {
    const title = this.add
      .text(160, 26, 'MISTRAL RAID', {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px', // 16px is a multiple of 8
        color: '#ffffff',
        stroke: '#cc33ff',
        strokeThickness: 4,
        resolution: 2, // Forces internal high-res render to prevent blur
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(160, 46, 'THE WATCHER', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px', // Fixed from 7px to 8px
        color: '#00ccff',
        stroke: '#001122',
        strokeThickness: 2,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      y: title.y + 3,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        title.y = Math.round(title.y);
      },
    });

    this.tweens.add({
      targets: title,
      alpha: 0.92,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: subtitle,
      y: subtitle.y + 2,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        subtitle.y = Math.round(subtitle.y);
      },
    });
  }

  private createMenu(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x06101e, 0.92);
    panel.fillRoundedRect(88, 62, 144, 96, 6);
    panel.lineStyle(1, 0x224466, 0.9);
    panel.strokeRoundedRect(88, 62, 144, 96, 6);

    const hasSave = SaveSystem.hasSave();
    this.items = [
      {
        label: 'New Game',
        enabled: true,
        action: () => this.startScene('PlayerSelectScene'),
      },
      {
        label: 'Continue',
        enabled: hasSave,
        action: () => this.startScene('LevelScene', { continue: true }),
      },
      {
        label: 'Arena Demo',
        enabled: true,
        action: () => this.startScene('ArenaScene'),
      },
      {
        label: 'Options',
        enabled: true,
        action: () => this.startScene('OptionsScene'),
      },
      {
        label: 'Credits',
        enabled: true,
        action: () => this.startScene('CreditsScene'),
      },
      {
        label: 'Exit',
        enabled: true,
        action: () => window.close(),
      },
    ];

    const startY = 74;
    this.items.forEach((item, idx) => {
      const text = this.add
        .text(160, startY + idx * 16, item.label, {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px', // Fixed from 6px to 8px
          color: '#aabbcc',
          resolution: 2,
        })
        .setOrigin(0.5);

      item.text = text;
    });

    if (!hasSave) {
      this.selectedIndex = 0;
    }

    this.refreshMenu();
  }

  private createControlsHint(): void {
    this.add
      .text(160, 172, '↑↓ Navigate   Enter Select', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px', // Fixed from 4px to 8px
        color: '#cccccc',
        resolution: 2,
      })
      .setOrigin(0.5, 1);
  }

  private moveSelection(dir: number): void {
    let idx = this.selectedIndex;
    do {
      idx = (idx + dir + this.items.length) % this.items.length;
    } while (!this.items[idx].enabled);
    this.selectedIndex = idx;
    this.refreshMenu();
    AudioManager.playSFX(this, 'menu_hover');
  }

  private refreshMenu(): void {
    this.items.forEach((item, idx) => {
      if (!item.text) return;
      if (!item.enabled) {
        item.text.setColor('#666777');
      } else if (idx === this.selectedIndex) {
        item.text.setColor('#ffdd00');
      } else {
        item.text.setColor('#aabbcc');
      }
    });
  }

  private activateSelection(): void {
    const item = this.items[this.selectedIndex];
    if (item.enabled) {
      AudioManager.playSFX(this, 'ui_click');
      item.action();
    }
  }

  private startScene(key: string, data?: object): void {
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      gameTelemetry.trackSceneTransition('MenuScene', key);
      this.scene.start(key, data);
    });
  }
}
