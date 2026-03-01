import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export class CreditsScene extends Phaser.Scene {
  private container!: Phaser.GameObjects.Container;
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private scrollHeight = 0;
  private readonly lineStyles = {
    title: { fontSize: '14px', color: '#fff7c2' },
    section: { fontSize: '10px', color: '#b5c7ff' },
    body: { fontSize: '8px', color: '#f8fbff' },
  } as const;

  constructor() {
    super('CreditsScene');
  }

  create(): void {
    AudioManager.playMusic(this, 'credits_theme');

    this.createBackground();
    this.createScroll();

    const back = this.add
      .text(160, 170, '[ BACK TO MENU ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#dfe5ff',
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.exit());

    this.input.keyboard?.on('keydown-ESC', () => this.exit());

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(): void {
    this.stars.forEach((star) => {
      star.y += 0.35;
      if (star.y > 180) {
        star.y = 0;
      }
    });

    if (this.container) {
      this.container.y -= 0.35;
      if (this.container.y + this.scrollHeight < -20) {
        this.exit();
      }
    }
  }

  private createBackground(): void {
    const gfx = this.add.graphics();
    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(4 + (12 - 4) * t);
      const g = Math.round(2 + (6 - 2) * t);
      const b = Math.round(18 + (32 - 18) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }

    for (let i = 0; i < 80; i += 1) {
      const star = this.add.rectangle(
        Phaser.Math.Between(0, 320),
        Phaser.Math.Between(0, 180),
        1,
        1,
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.8)
      );
      this.stars.push(star);
    }

    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, 320, 24);
    vignette.fillRect(0, 156, 320, 24);
  }

  private createScroll(): void {
    const credits: Array<{ text: string; variant: 'title' | 'section' | 'body' } | { spacer: boolean }> = [
      { text: 'MISTRAL RAID', variant: 'title' },
      { spacer: true },
      { text: 'DESIGN & CODE', variant: 'section' },
      { text: 'Mistral Raid Team', variant: 'body' },
      { spacer: true },
      { text: 'ART', variant: 'section' },
      { text: '0x72 Dungeon Tileset', variant: 'body' },
      { spacer: true },
      { text: 'FONTS', variant: 'section' },
      { text: 'Press Start 2P', variant: 'body' },
      { spacer: true },
      { text: 'SPECIAL THANKS', variant: 'section' },
      { text: 'Mistral Hackathon', variant: 'body' },
      { spacer: true },
      { text: '2026', variant: 'body' },
    ];

    const spacing = {
      title: 28,
      section: 22,
      body: 16,
      spacer: 14,
    };

    let currentY = 0;
    const texts: Phaser.GameObjects.Text[] = [];

    credits.forEach((entry) => {
      if ('spacer' in entry) {
        currentY += spacing.spacer;
        return;
      }

      const style = this.lineStyles[entry.variant];
      const text = this.add
        .text(160, currentY, entry.text, {
          fontFamily: '"Press Start 2P"',
          fontSize: style.fontSize,
          color: style.color,
        })
        .setShadow(0, 0, '#000000', 6, false, true)
        .setOrigin(0.5);

      texts.push(text);
      currentY += spacing[entry.variant];
    });

    this.scrollHeight = currentY;
    this.container = this.add.container(0, 190, texts);
  }

  private exit(): void {
    AudioManager.stopAll(this);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
  }
}
