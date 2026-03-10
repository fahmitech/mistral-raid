import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { CreditsOverlay } from '../ui/CreditsOverlay';

export class CreditsScene extends Phaser.Scene {
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private overlay?: CreditsOverlay;

  constructor() {
    super('CreditsScene');
  }

  create(): void {
    AudioManager.playMusic(this, 'credits_theme');

    this.createBackground();
    const parent = this.game.canvas?.parentElement;
    if (!parent) throw new Error('CreditsScene: canvas parent missing');
    parent.querySelectorAll<HTMLDivElement>('[data-credits-overlay="true"]').forEach((node) => node.remove());
    this.overlay = new CreditsOverlay(parent, {
      lines: this.buildLines(),
      onComplete: () => this.exit(),
      onBack: () => this.exit(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownOverlay());

    this.input.keyboard?.on('keydown-ESC', () => this.exit());

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(): void {
    this.stars.forEach((star) => {
      star.y += 0.2;
      if (star.y > 180) {
        star.y = 0;
      }
    });

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

  private buildLines(): string[] {
    return [
      'MISTRAL RAID',
      '',
      'Design & Code',
      'Mistral Raid Team',
      '',
      'Art Assets',
      '0x72 Dungeon Tileset',
      '',
      'Fonts',
      'Press Start 2P',
      '',
      'AI Systems',
      'Mistral AI API',
      'ElevenLabs TTS',
      '',
      'AI-Native Cooperative',
      'Gameplay powered by',
      'Mistral',
      '',
      'Special Thanks',
      'Mistral Hackathon',
      '',
      '2026',
    ];
  }

  private exit(): void {
    AudioManager.stopAll(this);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
  }

  private teardownOverlay(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
  }
}
