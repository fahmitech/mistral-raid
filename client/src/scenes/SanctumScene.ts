import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';

type DustParticle = {
  sprite: Phaser.GameObjects.Arc;
  speed: number;
  drift: number;
  phase: number;
};

export class SanctumScene extends Phaser.Scene {
  private dustParticles: DustParticle[] = [];
  private dialogText!: Phaser.GameObjects.Text;
  private transitioning = false;

  constructor() {
    super('SanctumScene');
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.drawBackground();
    this.spawnDustParticles();
    this.createFigures();
    this.createDialogText();

    AudioManager.playMusic(this, 'dungeon_ambient');
    const ambient = this.sound.get('dungeon_ambient');
    if (ambient) {
      ambient.volume = 0.3;
    }

    this.time.delayedCall(1500, () => {
      void this.playDialogSequence();
    });
  }

  update(_time: number, delta: number): void {
    const deltaRatio = delta / 16.666;
    this.dustParticles.forEach((particle) => {
      particle.sprite.y -= particle.speed * deltaRatio;
      particle.sprite.x += Math.sin((particle.sprite.y + particle.phase) * 0.05) * particle.drift * deltaRatio;
      if (particle.sprite.y < -6) {
        particle.sprite.y = INTERNAL_HEIGHT + 6;
        particle.sprite.x = Phaser.Math.Between(30, INTERNAL_WIDTH - 30);
      }
    });
  }

  private drawBackground(): void {
    const gfx = this.add.graphics().setDepth(0);
    const top = { r: 0x1a, g: 0x10, b: 0x08 };
    const bottom = { r: 0x0d, g: 0x09, b: 0x04 };

    for (let y = 0; y < INTERNAL_HEIGHT; y += 1) {
      const t = y / (INTERNAL_HEIGHT - 1);
      const r = Math.round(top.r + (bottom.r - top.r) * t);
      const g = Math.round(top.g + (bottom.g - top.g) * t);
      const b = Math.round(top.b + (bottom.b - top.b) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, INTERNAL_WIDTH, 1);
    }
  }

  private spawnDustParticles(): void {
    const count = Phaser.Math.Between(8, 12);
    for (let index = 0; index < count; index += 1) {
      const particle = this.add
        .circle(
          Phaser.Math.Between(30, INTERNAL_WIDTH - 30),
          Phaser.Math.Between(0, INTERNAL_HEIGHT),
          Phaser.Math.FloatBetween(0.6, 1.8),
          Phaser.Math.RND.pick([0xf8d9a4, 0xffc87a, 0xd6a05c]),
          Phaser.Math.FloatBetween(0.2, 0.45)
        )
        .setDepth(1);

      this.dustParticles.push({
        sprite: particle,
        speed: Phaser.Math.FloatBetween(0.08, 0.25),
        drift: Phaser.Math.FloatBetween(0.08, 0.28),
        phase: Phaser.Math.FloatBetween(0, 200),
      });
    }
  }

  private createFigures(): void {
    this.add
      .image(145, 85, 'npc_sage')
      .setOrigin(0.5, 1)
      .setScale(1)
      .setTint(0xffcc8a)
      .setDepth(2)
      .setFlipX(false);

    this.add
      .image(165, 95, 'npc_elf')
      .setOrigin(0.5, 1)
      .setScale(0.9)
      .setTint(0xf2bb75)
      .setDepth(2)
      .setFlipX(true);
  }

  private createDialogText(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 28, INTERNAL_WIDTH - 20, 22, 0x000000, 0.22).setDepth(4);

    this.dialogText = this.add
      .text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 29, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#fef3c7',
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(5);
  }

  private async playDialogSequence(): Promise<void> {
    await this.showLine('', 1500);
    await this.showLine('Is it time now?', 700);
    await this.showLine('', 3000);
    this.transitionToChoice();
  }

  private showLine(line: string, holdMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (line.length === 0) {
        this.dialogText.setText('');
        this.time.delayedCall(holdMs, () => resolve());
        return;
      }

      this.dialogText.setText('');
      let charIndex = 0;
      const typeTimer = this.time.addEvent({
        delay: 40,
        loop: true,
        callback: () => {
          charIndex += 1;
          this.dialogText.setText(line.slice(0, charIndex));
          if (charIndex >= line.length) {
            typeTimer.remove(false);
            this.time.delayedCall(holdMs, () => resolve());
          }
        },
      });
    });
  }

  private transitionToChoice(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    const ambient = this.sound.get('dungeon_ambient');
    if (ambient) {
      this.tweens.add({
        targets: ambient,
        volume: 0,
        duration: 600,
        ease: 'Linear',
      });
    }

    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      AudioManager.stopMusic(this);
      this.scene.start('VictoryScene');
    });
  }
}
