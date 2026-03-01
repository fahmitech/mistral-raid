import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import type { AIState, ArenaPhase } from '../types/arena';

export class ArenaHUD {
  private scene: Phaser.Scene;
  private playerBar: Phaser.GameObjects.Graphics;
  private bossBar: Phaser.GameObjects.Graphics;
  private phaseText: Phaser.GameObjects.Text;
  private stateText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.playerBar = scene.add.graphics().setScrollFactor(0).setDepth(20);
    this.bossBar = scene.add.graphics().setScrollFactor(0).setDepth(20);
    this.phaseText = scene.add.text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 10, 'PHASE 1', {
      fontFamily: '"Press Start 2P"',
      fontSize: '5px',
      color: '#ffcc66',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20);

    this.stateText = scene.add.text(INTERNAL_WIDTH - 6, 6, 'LISTENING', {
      fontFamily: '"Press Start 2P"',
      fontSize: '4px',
      color: '#66ffcc',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);
  }

  update(playerHp: number, playerMax: number, bossHp: number, bossMax: number, phase: ArenaPhase, aiState: AIState): void {
    this.playerBar.clear();
    this.bossBar.clear();

    const playerPct = playerMax > 0 ? playerHp / playerMax : 0;
    const bossPct = bossMax > 0 ? bossHp / bossMax : 0;

    this.playerBar.fillStyle(0x111111, 0.8).fillRect(6, INTERNAL_HEIGHT - 18, 80, 6);
    this.playerBar.fillStyle(0x33ff88, 0.9).fillRect(6, INTERNAL_HEIGHT - 18, 80 * playerPct, 6);
    this.playerBar.lineStyle(1, 0x225544, 0.9).strokeRect(6, INTERNAL_HEIGHT - 18, 80, 6);

    this.bossBar.fillStyle(0x111111, 0.8).fillRect(6, 6, INTERNAL_WIDTH - 12, 6);
    this.bossBar.fillStyle(0xff3366, 0.9).fillRect(6, 6, (INTERNAL_WIDTH - 12) * bossPct, 6);
    this.bossBar.lineStyle(1, 0x552233, 0.9).strokeRect(6, 6, INTERNAL_WIDTH - 12, 6);

    this.phaseText.setText(phase.replace('_', ' '));
    const stateLabel = aiState.toUpperCase();
    const stateColor = aiState === 'speaking' ? '#ff6699' : aiState === 'thinking' ? '#ffee88' : '#66ffcc';
    this.stateText.setText(stateLabel);
    this.stateText.setColor(stateColor);
  }

  destroy(): void {
    this.playerBar.destroy();
    this.bossBar.destroy();
    this.phaseText.destroy();
    this.stateText.destroy();
  }
}
