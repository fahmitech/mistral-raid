import Phaser from 'phaser';
import { GameState } from '../core/GameState';

const TAUNTS = [
  'The darkness claims another.',
  'Your journey ends here.',
  'The abyss waits for no one.',
  'The Watcher sees all.',
  'Steel fades in shadow.',
];

export class GameOverScene extends Phaser.Scene {
  private confetti: { sprite: Phaser.GameObjects.Rectangle; speed: number }[] = [];

  constructor() {
    super('GameOverScene');
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const gfx = this.add.graphics();
    gfx.fillStyle(0x100000, 1);
    gfx.fillRect(0, 0, 320, 180);

    const title = this.add
      .text(160, 30, 'GAME OVER', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ff3333',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    const state = GameState.get().getData();
    this.add
      .text(160, 60, `LEVEL REACHED: ${state.level}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(160, 72, `SCORE: ${state.score}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(160, 84, `COINS: ${state.coins}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(160, 104, Phaser.Utils.Array.GetRandom(TAUNTS), {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#ffaaaa',
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(110, 138, '[ RETRY ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd00',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const menu = this.add
      .text(210, 138, '[ MENU ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#cccccc',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retry.on('pointerdown', () => this.retry());
    menu.on('pointerdown', () => this.backToMenu());

    this.tweens.add({
      targets: [retry, menu],
      alpha: 0.6,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.spawnConfetti();
  }

  update(): void {
    this.confetti.forEach((c) => {
      c.sprite.y += c.speed;
      if (c.sprite.y > 190) {
        c.sprite.y = -10;
        c.sprite.x = Phaser.Math.Between(0, 320);
      }
    });
  }

  private spawnConfetti(): void {
    for (let i = 0; i < 60; i += 1) {
      const rect = this.add.rectangle(
        Phaser.Math.Between(0, 320),
        Phaser.Math.Between(0, 180),
        2,
        2,
        0xff3333,
        Phaser.Math.FloatBetween(0.4, 0.9)
      );
      this.confetti.push({ sprite: rect, speed: Phaser.Math.FloatBetween(0.4, 1.4) });
    }
  }

  private retry(): void {
    GameState.get().reset();
    this.scene.start('LevelScene', { level: 1 });
  }

  private backToMenu(): void {
    GameState.get().reset();
    this.scene.start('MenuScene');
  }
}
