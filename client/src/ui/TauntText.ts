import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import { createGameText } from './TextFactory';

export class TauntText {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private bg: Phaser.GameObjects.Rectangle;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 32, INTERNAL_WIDTH - 12, 22, 0x000000, 0.6)
      .setScrollFactor(0)
      .setDepth(19)
      .setVisible(false);
    this.text = createGameText(scene, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 32, '', {
      fontSize: '5px',
      color: '#ff88aa',
      align: 'center',
      wordWrap: { width: INTERNAL_WIDTH - 20 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(20).setVisible(false);
  }

  show(message: string): void {
    this.bg.setVisible(true);
    this.text.setVisible(true);
    this.text.setText('');
    this.timer?.remove(false);

    let idx = 0;
    this.timer = this.scene.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => {
        idx += 1;
        this.text.setText(message.slice(0, idx));
        if (idx >= message.length) {
          this.timer?.remove(false);
        }
      },
    });
  }

  clear(): void {
    this.timer?.remove(false);
    this.text.setText('');
    this.text.setVisible(false);
    this.bg.setVisible(false);
  }

  destroy(): void {
    this.timer?.remove(false);
    this.text.destroy();
    this.bg.destroy();
  }
}
