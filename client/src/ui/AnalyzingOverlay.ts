import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '../config/constants';

export class AnalyzingOverlay {
  private scene: Phaser.Scene;
  private dot: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.label = scene.add
      .text(INTERNAL_WIDTH - 12, 23, 'AI UPDATING', {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Roboto", Arial',
        fontSize: '7px',
        color: '#ffee88',
        stroke: '#000000',
        strokeThickness: 1,
        shadow: { color: '#000000', blur: 4, fill: true, offsetX: 1, offsetY: 1 },
        resolution: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(31)
      .setVisible(false);

    this.dot = scene.add
      .circle(INTERNAL_WIDTH - 6, 26, 2.5, 0xffee88, 1)
      .setScrollFactor(0)
      .setDepth(31)
      .setVisible(false);
  }

  show(): void {
    this.label.setVisible(true);
    this.dot.setVisible(true);
    this.scene.tweens.add({
      targets: this.dot,
      alpha: 0.15,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.dot);
    this.dot.setAlpha(1);
    this.label.setVisible(false);
    this.dot.setVisible(false);
  }

  destroy(): void {
    this.label.destroy();
    this.dot.destroy();
  }
}
