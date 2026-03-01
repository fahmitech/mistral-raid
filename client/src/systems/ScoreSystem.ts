import Phaser from 'phaser';

export class ScoreSystem {
  static floatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
    const label = scene.add
      .text(x, y, text, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color,
      })
      .setOrigin(0.5, 1);

    scene.tweens.add({
      targets: label,
      y: y - 18,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
