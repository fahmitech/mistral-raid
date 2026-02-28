import Phaser from 'phaser';
import { GameState } from '../core/GameState';

export class VictoryScene extends Phaser.Scene {
  private confetti: { sprite: Phaser.GameObjects.Rectangle; speed: number; drift: number }[] = [];

  constructor() {
    super('VictoryScene');
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const gfx = this.add.graphics();
    gfx.fillStyle(0x060b16, 1);
    gfx.fillRect(0, 0, 320, 180);

    const title = this.add
      .text(160, 26, 'VICTORY', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      alpha: 0.9,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(160, 44, 'The Watcher has been destroyed.', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const state = GameState.get().getData();
    const inventoryCount = state.inventory.reduce((sum, slot) => sum + slot.qty, 0);

    this.add
      .text(160, 70, `FINAL SCORE: ${state.score}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd44',
      })
      .setOrigin(0.5);
    this.add
      .text(160, 82, `COINS: ${state.coins}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd44',
      })
      .setOrigin(0.5);
    this.add
      .text(160, 94, `DAMAGE: ${state.playerDamage.toFixed(1)}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd44',
      })
      .setOrigin(0.5);
    this.add
      .text(160, 106, `INVENTORY: ${inventoryCount}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd44',
      })
      .setOrigin(0.5);

    const button = this.add
      .text(160, 138, '[ PLAY AGAIN ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.playAgain());

    this.spawnConfetti();
  }

  update(): void {
    this.confetti.forEach((c) => {
      c.sprite.y += c.speed;
      c.sprite.x += c.drift;
      if (c.sprite.y > 190) {
        c.sprite.y = -10;
        c.sprite.x = Phaser.Math.Between(0, 320);
      }
      if (c.sprite.x < -10) c.sprite.x = 330;
      if (c.sprite.x > 330) c.sprite.x = -10;
    });
  }

  private spawnConfetti(): void {
    const colors = [0xffcc00, 0x33ccff, 0xff66cc, 0x66ff66, 0xffffff];
    for (let i = 0; i < 80; i += 1) {
      const rect = this.add.rectangle(
        Phaser.Math.Between(0, 320),
        Phaser.Math.Between(0, 180),
        2,
        2,
        Phaser.Utils.Array.GetRandom(colors),
        Phaser.Math.FloatBetween(0.4, 0.9)
      );
      this.confetti.push({
        sprite: rect,
        speed: Phaser.Math.FloatBetween(0.3, 1.2),
        drift: Phaser.Math.FloatBetween(-0.2, 0.2),
      });
    }
  }

  private playAgain(): void {
    GameState.get().reset();
    this.scene.start('MenuScene');
  }
}
