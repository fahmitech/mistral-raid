import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { AudioManager } from '../systems/AudioManager';
import { createGameText } from '../ui/TextFactory';

const TAUNTS = [
  'The dungeon remembers your name. It always does.',
  'The architect of cunning, ensnared by the shadow of your own design.',
];

export class GameOverScene extends Phaser.Scene {
  private embers: { sprite: Phaser.GameObjects.Rectangle; speed: number; drift: number }[] = [];

  private yesText!: Phaser.GameObjects.Text;
  private noText!: Phaser.GameObjects.Text;
  private selectedBtn: 0 | 1 = 0;

  private heroSprite?: Phaser.GameObjects.Sprite;
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private glitchBars: Phaser.GameObjects.Rectangle[] = [];
  private inputEnabled = false;

  constructor() {
    super('GameOverScene');
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    AudioManager.playMusic(this, 'game_over_music');

    this.drawBackground();
    this.spawnEmbers();

    this.playPhase1();
  }

  private playPhase1(): void {
    const title = createGameText(this, 160, 70, 'GAME OVER', {
        fontSize: '24px',
        color: '#ff3b3b',
        resolution: 1,
        stroke: '#550000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScale(3)
      .setAlpha(0)
      .setDepth(20);

    this.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameras.main.shake(200, 0.01);

        this.time.delayedCall(400, () => {
          // Move to y=22 so it doesn't clip the top
          this.tweens.add({
            targets: title,
            y: 22,
            duration: 600,
            ease: 'Power2',
          });
          this.playPhase2();
        });
      },
    });
  }

  private playPhase2(): void {
    const cfg = this.getHeroCfg();
    if (!cfg) {
      this.time.delayedCall(200, () => this.playPhase3());
      return;
    }

    const spriteKey = this.resolvePortraitKey(cfg.spriteKey);
    const hero = this.add.sprite(160, -40, spriteKey).setDepth(15);

    const animKey = `${cfg.spriteKey}_idle`;
    if (this.anims.exists(animKey)) hero.play(animKey);

    hero.setScale(5);
    this.heroSprite = hero;

    this.tweens.add({
      targets: hero,
      y: 90,
      duration: 600,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.cameras.main.shake(100, 0.005);

        this.time.delayedCall(300, () => {
          this.tweens.add({
            targets: hero,
            angle: 90,
            duration: 500,
            ease: 'Power2',
          });

          let tintProgress = 0;
          this.time.addEvent({
            delay: 50,
            repeat: 10,
            callback: () => {
              tintProgress += 0.1;
              const r = 255;
              const g = Math.round(255 * (1 - tintProgress));
              const b = Math.round(255 * (1 - tintProgress));
              hero.setTint(Phaser.Display.Color.GetColor(r, g, b));
            },
          });

          this.time.delayedCall(800, () => {
            hero.setTint(0xaa4444);
            hero.setAlpha(0.8);
            this.playPhase3();
          });
        });
      },
    });
  }

  private playPhase3(): void {
    for (let i = 0; i < 12; i++) {
      const y = Phaser.Math.Between(0, 180);
      const h = Phaser.Math.Between(2, 8);
      const bar = this.add
        .rectangle(160, y, 320, h, 0xffffff, 0.8)
        .setDepth(25)
        .setAlpha(0);
      this.glitchBars.push(bar);
    }

    let flickerCount = 0;
    this.time.addEvent({
      delay: 60,
      repeat: 8,
      callback: () => {
        flickerCount++;
        this.glitchBars.forEach((bar) => {
          bar.setAlpha(flickerCount % 2 === 0 ? 0.7 : 0);
          bar.y = Phaser.Math.Between(0, 180);
          const colors = [0xffffff, 0xff0000, 0x00ffff, 0xff00ff];
          bar.setFillStyle(colors[Phaser.Math.Between(0, 3)], 0.6);
        });

        if (flickerCount % 2 === 0) {
          this.cameras.main.setScroll(
            Phaser.Math.Between(-3, 3),
            Phaser.Math.Between(-2, 2)
          );
        } else {
          this.cameras.main.setScroll(0, 0);
        }
      },
    });

    if (this.heroSprite) {
      this.tweens.add({
        targets: this.heroSprite,
        alpha: 0,
        duration: 400,
        delay: 100,
      });
    }

    this.time.delayedCall(600, () => {
      this.cameras.main.setScroll(0, 0);
      this.glitchBars.forEach((bar) => bar.destroy());
      this.glitchBars = [];
      if (this.heroSprite) {
        this.heroSprite.destroy();
        this.heroSprite = undefined;
      }
      this.playPhase4();
    });
  }

  private playPhase4(): void {
    const state = GameState.get().getData();
    const taunt = TAUNTS[Phaser.Math.Between(0, TAUNTS.length - 1)];

    // ── Two columns close together, centered on screen ──
    // Stats on left, quote on right, separated by a small gap
    const midY = 52;
    const lineH = 14;

    // Stats column: right-edge around center
    const statsX = 56;

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '8px',
      color: '#3399ff',
      resolution: 1,
      stroke: '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true },
    };

    const valueStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '8px',
      color: '#ffffff',
      resolution: 1,
      stroke: '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true },
    };

    const lvlLabel = createGameText(this, statsX, midY, 'LEVEL ', labelStyle).setDepth(10).setAlpha(0);
    const lvlVal = createGameText(this, statsX + 48, midY, `${state.level}`, valueStyle).setDepth(10).setAlpha(0);

    const scrLabel = createGameText(this, statsX, midY + lineH, 'SCORE ', labelStyle).setDepth(10).setAlpha(0);
    const scrVal = createGameText(this, statsX + 48, midY + lineH, `${state.score}`, valueStyle).setDepth(10).setAlpha(0);

    const coinLabel = createGameText(this, statsX, midY + lineH * 2, 'COINS ', labelStyle).setDepth(10).setAlpha(0);
    const coinVal = createGameText(this, statsX + 48, midY + lineH * 2, `${state.coins}`, valueStyle).setDepth(10).setAlpha(0);

    this.uiElements.push(lvlLabel, lvlVal, scrLabel, scrVal, coinLabel, coinVal);

    // Subtle vertical separator
    const sep = this.add.graphics().setDepth(10).setAlpha(0);
    sep.lineStyle(1, 0x333333, 0.4);
    sep.lineBetween(148, midY - 2, 148, midY + lineH * 3 - 4);
    this.uiElements.push(sep);

    // Quote column: starts right after separator
    const quoteX = 158;

    const quoteText = createGameText(this, quoteX, midY, taunt, {
        fontSize: '8px',
        color: '#996666',
        resolution: 1,
        lineSpacing: 4,
        wordWrap: { width: 140, useAdvancedWrap: true },
      })
      .setOrigin(0, 0)
      .setDepth(10)
      .setAlpha(0);
    this.uiElements.push(quoteText);

    // ── Bottom: Play Again? + YES / MENU ──
    const btnY = 158;

    const btnSep = this.add.graphics().setDepth(10).setAlpha(0);
    btnSep.lineStyle(1, 0x222222, 0.5);
    btnSep.lineBetween(40, btnY - 24, 280, btnY - 24);
    this.uiElements.push(btnSep);

    const playAgain = createGameText(this, 160, btnY - 14, 'PLAY AGAIN?', {
        fontSize: '8px',
        color: '#ffffff',
        resolution: 1,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);
    this.uiElements.push(playAgain);

    this.yesText = createGameText(this, 120, btnY + 4, '[ YES ]', {
        fontSize: '8px',
        color: '#ffdd00',
        resolution: 1,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    this.uiElements.push(this.yesText);

    this.noText = createGameText(this, 200, btnY + 4, '[ MENU ]', {
        fontSize: '8px',
        color: '#889aab',
        resolution: 1,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    this.uiElements.push(this.noText);

    // ── Stagger fade in ──
    this.uiElements.forEach((el, idx) => {
      this.tweens.add({
        targets: el,
        alpha: 1,
        duration: 400,
        delay: idx * 60,
        ease: 'Power2',
      });
    });

    const totalDelay = this.uiElements.length * 60 + 400;
    this.time.delayedCall(totalDelay, () => {
      this.inputEnabled = true;
      this.setupInput();
      this.refreshButtons();
    });
  }

  private setupInput(): void {
    this.yesText.on('pointerdown', () => this.retry());
    this.noText.on('pointerdown', () => this.backToMenu());

    this.yesText.on('pointerover', () => {
      this.selectedBtn = 0;
      this.refreshButtons();
    });
    this.noText.on('pointerover', () => {
      this.selectedBtn = 1;
      this.refreshButtons();
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      this.selectedBtn = 0;
      this.refreshButtons();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.selectedBtn = 1;
      this.refreshButtons();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.selectedBtn === 0) this.retry();
      else this.backToMenu();
    });
  }

  update(): void {
    this.embers.forEach((p) => {
      p.sprite.y -= p.speed;
      p.sprite.x += Math.sin(p.sprite.y * 0.05) * p.drift;
      if (p.sprite.y < -10) {
        p.sprite.y = 190;
        p.sprite.x = Phaser.Math.Between(0, 320);
      }
    });
  }

  private drawBackground(): void {
    const gfx = this.add.graphics().setDepth(0);

    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(4 + (18 - 4) * t);
      const g = Math.round(0 + (1 - 0) * t);
      const b = Math.round(2 + (6 - 2) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }
  }

  private spawnEmbers(): void {
    for (let i = 0; i < 60; i += 1) {
      const size = Phaser.Math.Between(1, 3);
      const isHot = Math.random() > 0.7;
      const color = isHot ? 0xff6633 : 0xff3b3b;
      const alpha = Phaser.Math.FloatBetween(0.15, isHot ? 0.5 : 0.3);

      const rect = this.add
        .rectangle(
          Phaser.Math.Between(0, 320),
          Phaser.Math.Between(0, 180),
          size,
          size,
          color,
          alpha
        )
        .setDepth(2);

      this.embers.push({
        sprite: rect,
        speed: Phaser.Math.FloatBetween(0.15, 0.5),
        drift: Phaser.Math.FloatBetween(0.2, 0.6),
      });
    }
  }

  private getHeroCfg(): any | null {
    const gs: any = GameState.get();
    const data: any = gs.getData?.() ?? {};

    const candidate =
      gs.getCharacter?.() ??
      data.character ??
      data.selectedCharacter ??
      data.playerCharacter ??
      data.hero;

    if (candidate === undefined || candidate === null) return null;

    const type = candidate as CharacterType;
    const cfg = (CHARACTER_CONFIGS as any)[type];
    return cfg ?? null;
  }

  private resolvePortraitKey(spriteKey: string): string {
    const idleKey = `${spriteKey}_idle_anim_f0`;
    if (this.textures.exists(idleKey)) return idleKey;
    const animKey = `${spriteKey}_anim_f0`;
    if (this.textures.exists(animKey)) return animKey;
    const runKey = `${spriteKey}_run_anim_f0`;
    if (this.textures.exists(runKey)) return runKey;
    return '__MISSING';
  }

  private refreshButtons(): void {
    if (!this.inputEnabled) return;

    if (this.selectedBtn === 0) {
      this.yesText.setColor('#ffdd00');
      this.yesText.setAlpha(1);
      this.noText.setColor('#556677');
      this.noText.setAlpha(0.6);
    } else {
      this.yesText.setColor('#556677');
      this.yesText.setAlpha(0.6);
      this.noText.setColor('#ffdd00');
      this.noText.setAlpha(1);
    }
  }

  private retry(): void {
    if (!this.inputEnabled) return;
    AudioManager.stopAll(this);
    GameState.get().reset();
    this.scene.start('LevelScene', { level: 1 });
  }

  private backToMenu(): void {
    if (!this.inputEnabled) return;
    AudioManager.stopAll(this);
    GameState.get().reset();
    this.scene.start('MenuScene');
  }
}