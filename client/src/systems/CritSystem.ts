import Phaser from 'phaser';
import { Player } from '../entities/Player';

const CRIT_CAP = 0.4;
const HIT_COUNTER_CRIT_THRESHOLD = 10;
const HIT_COUNTER_CRIT_GAIN = 0.02;

export class CritSystem {
  static calculateDamage(
    baseDamage: number,
    critChance: number,
    critMultiplier: number
  ): { damage: number; isCrit: boolean } {
    const isCrit = Math.random() < critChance;
    const damage = isCrit ? baseDamage * critMultiplier : baseDamage;
    return { damage, isCrit };
  }

  static updateHitCounter(player: Player): void {
    player.hitCounter++;
    if (player.hitCounter % HIT_COUNTER_CRIT_THRESHOLD === 0) {
      player.critChance = Math.min(
        player.critChance + HIT_COUNTER_CRIT_GAIN,
        CRIT_CAP
      );
    }
  }

  static spawnCritEffect(scene: Phaser.Scene, x: number, y: number): void {
    // Yellow damage number with flash
    const text = scene.add.text(x, y, 'CRIT!', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffff00',
    }).setOrigin(0.5).setDepth(20);

    scene.tweens.add({
      targets: text,
      y: y - 20,
      alpha: 0,
      duration: 600,
      ease: 'Power2.easeOut',
      onComplete: () => text.destroy(),
    });

    // Screen shake
    scene.cameras.main.shake(60, 0.003);
  }
}
