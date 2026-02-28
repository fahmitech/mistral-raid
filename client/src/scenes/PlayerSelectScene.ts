import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';
import { AudioManager } from '../systems/AudioManager';

const CHARACTER_ORDER: CharacterType[] = [
  CharacterType.Knight,
  CharacterType.Rogue,
  CharacterType.Mage,
  CharacterType.Paladin,
];

export class PlayerSelectScene extends Phaser.Scene {
  private selectedIndex = 0;

  // Top Selection Array
  private portraitSprites: Phaser.GameObjects.Sprite[] = [];

  // Bottom Showcase Variables
  private showcaseSprite!: Phaser.GameObjects.Sprite;
  private statGraphics?: Phaser.GameObjects.Graphics;
  private statLabels: Phaser.GameObjects.Text[] = [];
  private selectedNameText?: Phaser.GameObjects.Text;
  private descText?: Phaser.GameObjects.Text;

  // Buttons
  private confirmText?: Phaser.GameObjects.Text;
  private backText?: Phaser.GameObjects.Text;

  constructor() {
    super('PlayerSelectScene');
  }

  create(): void {
    AudioManager.get().init(this);
    this.createBackground();

    this.add
      .text(160, 8, 'CHOOSE YOUR HERO', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#8833cc',
        strokeThickness: 2,
        resolution: 1,
      })
      .setOrigin(0.5);

    this.createTopSelection();
    this.createShowcasePanel();
    this.createButtons();

    this.updateSelection();

    this.input.keyboard?.on('keydown-LEFT', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.portraitSprites.forEach((sprite, idx) => {
        if (sprite.getBounds().contains(pointer.x, pointer.y)) {
          this.selectedIndex = idx;
          this.updateSelection();
        }
      });
      if (this.confirmText?.getBounds().contains(pointer.x, pointer.y)) {
        this.confirm();
      }
      if (this.backText?.getBounds().contains(pointer.x, pointer.y)) {
        this.back();
      }
    });
  }

  private createBackground(): void {
    const gfx = this.add.graphics();
    for (let y = 0; y < 180; y += 1) {
      const t = y / 180;
      const r = Math.round(2 + (8 - 2) * t);
      const g = Math.round(0 + (6 - 0) * t);
      const b = Math.round(16 + (30 - 16) * t);
      gfx.fillStyle((r << 16) + (g << 8) + b, 1);
      gfx.fillRect(0, y, 320, 1);
    }
  }

  private createTopSelection(): void {
    const startX = 65;
    const spacing = 63;
    const portraitY = 36;
    const boxSize = 32;
    const halfBox = boxSize / 2;

    CHARACTER_ORDER.forEach((type, idx) => {
      const cfg = CHARACTER_CONFIGS[type];
      const x = startX + idx * spacing;

      const bg = this.add.graphics();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(x - halfBox, portraitY - halfBox, boxSize, boxSize, 4);

      const portraitKey = this.resolvePortraitKey(cfg.spriteKey);
      const sprite = this.add.sprite(x, portraitY, portraitKey);
      const animKey = `${cfg.spriteKey}_idle`;
      if (this.anims.exists(animKey)) {
        sprite.play(animKey);
      }
      sprite.setScale(1.0); // 1x scale so sprites fit cleanly inside boxes

      // Names well below the box
      const label = this.add
        .text(x, portraitY + halfBox + 4, cfg.label.toUpperCase(), {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#667788',
          resolution: 1,
        })
        .setOrigin(0.5, 0);

      this.portraitSprites.push(sprite);
      sprite.setData('bg', bg);
      sprite.setData('label', label);
      sprite.setData('boxSize', boxSize);
      sprite.setData('halfBox', halfBox);
    });
  }

  private createShowcasePanel(): void {
    // Shadow under big sprite
    this.add.ellipse(65, 150, 34, 8, 0x000000, 0.35);

    this.showcaseSprite = this.add.sprite(65, 115, '');
    this.showcaseSprite.setScale(3.2);

    // Data Card Background
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x06101e, 0.95);
    cardBg.fillRoundedRect(120, 72, 190, 90, 6);
    cardBg.lineStyle(1, 0x224466, 1);
    cardBg.strokeRoundedRect(120, 72, 190, 90, 6);

    // Hero Name
    this.selectedNameText = this.add
      .text(130, 78, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#00ffcc',
        resolution: 1,
      })
      .setOrigin(0, 0);

    // Description
    this.descText = this.add
      .text(130, 92, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#aabbcc',
        resolution: 1,
        lineSpacing: 2,
        wordWrap: { width: 170, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);

    // Stats
    this.statGraphics = this.add.graphics();

    const labelX = 130;
    const baseY = 126;
    ['HP', 'SPD', 'DMG', 'RATE'].forEach((label, idx) => {
      const text = this.add
        .text(labelX, baseY + idx * 10, label, {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#8899aa',
          resolution: 1,
        })
        .setOrigin(0, 0.5);
      this.statLabels.push(text);
    });
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

  private createButtons(): void {
    this.backText = this.add
      .text(16, 172, '[ BACK ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#999999',
        resolution: 1,
      })
      .setOrigin(0, 0.5);

    this.confirmText = this.add
      .text(304, 172, '[ CONFIRM ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#00ffcc',
        resolution: 1,
      })
      .setOrigin(1, 0.5);
  }

  private moveSelection(dir: number): void {
    this.selectedIndex =
      (this.selectedIndex + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
    this.updateSelection();
  }

  private updateSelection(): void {
    this.portraitSprites.forEach((sprite, idx) => {
      const bg = sprite.getData('bg') as Phaser.GameObjects.Graphics;
      const label = sprite.getData('label') as Phaser.GameObjects.Text;
      const boxSize = sprite.getData('boxSize') as number;
      const halfBox = sprite.getData('halfBox') as number;

      bg.clear();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(sprite.x - halfBox, sprite.y - halfBox, boxSize, boxSize, 4);

      if (idx === this.selectedIndex) {
        bg.lineStyle(2, 0xffdd00, 1);
        bg.strokeRoundedRect(sprite.x - halfBox - 2, sprite.y - halfBox - 2, boxSize + 4, boxSize + 4, 4);
        sprite.setAlpha(1);
        label.setColor('#ffdd00');
      } else {
        sprite.setAlpha(0.6);
        label.setColor('#556677');
      }
    });

    const type = CHARACTER_ORDER[this.selectedIndex];
    const cfg = CHARACTER_CONFIGS[type];

    const animKey = `${cfg.spriteKey}_idle`;
    if (this.anims.exists(animKey)) {
      this.showcaseSprite.play(animKey);
    } else {
      this.showcaseSprite.setTexture(this.resolvePortraitKey(cfg.spriteKey));
    }

    if (this.selectedNameText) {
      this.selectedNameText.setText(cfg.label.toUpperCase());
    }
    if (this.descText) {
      this.descText.setText(cfg.desc);
    }

    this.drawStats(cfg);
  }

  private drawStats(cfg: (typeof CHARACTER_CONFIGS)[CharacterType]): void {
    const graphics = this.statGraphics;
    if (!graphics) return;
    graphics.clear();

    const baseX = 166;
    const baseY = 126;
    const barW = 135;
    const barH = 6;

    const stats = [
      { label: 'HP', value: cfg.maxHP, max: 8, color: 0xff3333 },
      { label: 'SPD', value: cfg.speed, max: 145, color: 0x3399ff },
      { label: 'DMG', value: cfg.damage, max: 2, color: 0xff9933 },
      { label: 'RATE', value: 420 - cfg.fireRate, max: 420, color: 0x33cc55 },
    ];

    stats.forEach((stat, idx) => {
      const y = baseY + idx * 10 - 3;

      graphics.fillStyle(0x1a2536, 1);
      graphics.fillRect(baseX, y, barW, barH);

      graphics.fillStyle(stat.color, 1);
      const filled = (stat.value / stat.max) * barW;
      graphics.fillRect(baseX, y, filled, barH);
    });
  }

  private confirm(): void {
    const type = CHARACTER_ORDER[this.selectedIndex];
    const state = GameState.get();
    state.reset();
    state.setCharacter(type);
    this.scene.start('LevelScene', { level: 1 });
  }

  private back(): void {
    this.scene.start('MenuScene');
  }
}