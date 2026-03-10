import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';

export class VictoryScene extends Phaser.Scene {
  private letGoText!: Phaser.GameObjects.Text;
  private holdOnText!: Phaser.GameObjects.Text;
  private selectedChoice: 0 | 1 = 0;
  private inputEnabled = false;
  private confirmed = false;

  constructor() {
    super('VictoryScene');
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);

    const gfx = this.add.graphics();
    gfx.fillStyle(0x060b16, 1);
    gfx.fillRect(0, 0, 320, 180);

    this.letGoText = this.add
      .text(100, 90, 'LET GO', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#fef3c7',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });

    this.holdOnText = this.add
      .text(220, 90, 'HOLD ON', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#556677',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });

    this.refreshChoices();

    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: [this.letGoText, this.holdOnText],
        alpha: 1,
        duration: 300,
        ease: 'Linear',
      });
    });

    this.time.delayedCall(4000, () => {
      this.inputEnabled = true;
      this.setupInput();
      this.refreshChoices();
    });
  }

  private setupInput(): void {
    this.letGoText.on('pointerdown', () => this.confirmChoice(0));
    this.holdOnText.on('pointerdown', () => this.confirmChoice(1));

    this.letGoText.on('pointerover', () => {
      if (!this.inputEnabled || this.confirmed) return;
      this.selectedChoice = 0;
      this.refreshChoices();
    });

    this.holdOnText.on('pointerover', () => {
      if (!this.inputEnabled || this.confirmed) return;
      this.selectedChoice = 1;
      this.refreshChoices();
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      if (!this.inputEnabled || this.confirmed) return;
      this.selectedChoice = 0;
      this.refreshChoices();
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (!this.inputEnabled || this.confirmed) return;
      this.selectedChoice = 1;
      this.refreshChoices();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.confirmChoice(this.selectedChoice);
    });
  }

  private refreshChoices(): void {
    if (this.selectedChoice === 0) {
      this.letGoText.setColor('#fef3c7');
      this.letGoText.setAlpha(1);
      this.holdOnText.setColor('#556677');
      this.holdOnText.setAlpha(0.4);
      return;
    }

    this.letGoText.setColor('#556677');
    this.letGoText.setAlpha(0.4);
    this.holdOnText.setColor('#fef3c7');
    this.holdOnText.setAlpha(1);
  }

  private confirmChoice(choice: 0 | 1): void {
    if (!this.inputEnabled || this.confirmed) return;

    this.selectedChoice = choice;
    this.confirmed = true;
    this.inputEnabled = false;
    this.refreshChoices();

    this.cameras.main.flash(50, 255, 255, 255);
    this.time.delayedCall(60, () => {
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.finishChoice());
    });
  }

  private finishChoice(): void {
    AudioManager.stopAll(this);
    GameState.get().reset();
    this.scene.start('MenuScene');
  }
}
