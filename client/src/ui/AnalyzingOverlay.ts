import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';

export class AnalyzingOverlay {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private spinner: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x000000, 0.55)
      .setScrollFactor(0)
      .setDepth(30)
      .setVisible(false);

    this.text = scene.add.text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2 - 10, 'BOSS IS ANALYZING...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#ffee88',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(31).setVisible(false);

    this.spinner = scene.add.circle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2 + 10, 6, 0xffee88, 0.8)
      .setScrollFactor(0)
      .setDepth(31)
      .setVisible(false);
  }

  show(): void {
    this.bg.setVisible(true);
    this.text.setVisible(true);
    this.spinner.setVisible(true);
    this.scene.tweens.add({
      targets: this.spinner,
      angle: 360,
      duration: 800,
      repeat: -1,
    });
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.spinner);
    this.bg.setVisible(false);
    this.text.setVisible(false);
    this.spinner.setVisible(false);
  }

  destroy(): void {
    this.bg.destroy();
    this.text.destroy();
    this.spinner.destroy();
  }
}
