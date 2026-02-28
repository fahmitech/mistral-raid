import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../config/characters';
import { CharacterType } from '../config/types';
import { GameState } from '../core/GameState';

const CHARACTER_ORDER: CharacterType[] = [
  CharacterType.Knight,
  CharacterType.Rogue,
  CharacterType.Mage,
  CharacterType.Paladin,
];

export class PlayerSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private portraitSprites: Phaser.GameObjects.Sprite[] = [];
  private statGraphics?: Phaser.GameObjects.Graphics;
  private statLabels: Phaser.GameObjects.Text[] = [];
  private descText?: Phaser.GameObjects.Text;
  private confirmText?: Phaser.GameObjects.Text;
  private backText?: Phaser.GameObjects.Text;

  constructor() {
    super('PlayerSelectScene');
  }

  create(): void {
    this.createBackground();
    this.add
      .text(160, 16, 'CHOOSE YOUR HERO', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#cc33ff',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.createPortraits();
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

  private createPortraits(): void {
    const centerX = 160;
    const startX = centerX - 84;
    CHARACTER_ORDER.forEach((type, idx) => {
      const cfg = CHARACTER_CONFIGS[type];
      const x = startX + idx * 56;
      const y = 62;
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(x - 22, y - 22, 44, 44, 6);
      const portraitKey = this.resolvePortraitKey(cfg.spriteKey);
      const sprite = this.add.sprite(x, y, portraitKey);
      const animKey = `${cfg.spriteKey}_idle`;
      if (this.anims.exists(animKey)) {
        sprite.play(animKey);
      }
      sprite.setScale(2.0);
      const label = this.add
        .text(x, y + 28, cfg.label.toUpperCase(), {
          fontFamily: '"Press Start 2P"',
          fontSize: '4px',
          color: '#cccccc',
        })
        .setOrigin(0.5);
      this.portraitSprites.push(sprite);
      sprite.setData('bg', bg);
      sprite.setData('label', label);
    });

    this.descText = this.add
      .text(160, 110, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#cccccc',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    this.statGraphics = this.add.graphics();
    const labelX = 72;
    const baseY = 126;
    ['HP', 'SPD', 'DMG', 'RATE'].forEach((label, idx) => {
      const text = this.add
        .text(labelX, baseY + idx * 10 + 2, label, {
          fontFamily: '"Press Start 2P"',
          fontSize: '4px',
          color: '#cccccc',
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
      .text(40, 132, '[ BACK ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#999999',
      })
      .setOrigin(0, 0.5);

    this.confirmText = this.add
      .text(280, 132, '[ CONFIRM ]', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#00ffcc',
      })
      .setOrigin(1, 0.5);
  }

  private moveSelection(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
    this.updateSelection();
  }

  private updateSelection(): void {
    this.portraitSprites.forEach((sprite, idx) => {
      const bg = sprite.getData('bg') as Phaser.GameObjects.Graphics;
      bg.clear();
      bg.fillStyle(0x0a0f1e, 0.9);
      bg.fillRoundedRect(sprite.x - 22, sprite.y - 22, 44, 44, 6);
      if (idx === this.selectedIndex) {
        bg.lineStyle(2, 0xffdd00, 1);
        bg.strokeRoundedRect(sprite.x - 24, sprite.y - 24, 48, 48, 6);
        sprite.setScale(2.4);
      } else {
        sprite.setScale(2.0);
      }
    });

    const type = CHARACTER_ORDER[this.selectedIndex];
    const cfg = CHARACTER_CONFIGS[type];
    if (this.descText) {
      this.descText.setText(cfg.desc);
    }
    this.drawStats(cfg);
  }

  private drawStats(cfg: (typeof CHARACTER_CONFIGS)[CharacterType]): void {
    const graphics = this.statGraphics;
    if (!graphics) return;
    graphics.clear();
    const baseX = 100;
    const baseY = 126;
    const barW = 120;
    const barH = 5;

    const stats = [
      { label: 'HP', value: cfg.maxHP, max: 8, color: 0xff3333 },
      { label: 'SPD', value: cfg.speed, max: 145, color: 0x3399ff },
      { label: 'DMG', value: cfg.damage, max: 2, color: 0xff9933 },
      { label: 'RATE', value: 420 - cfg.fireRate, max: 420, color: 0x33cc55 },
    ];

    stats.forEach((stat, idx) => {
      const y = baseY + idx * 10;
      graphics.fillStyle(0x222222, 1);
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
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelScene', { level: 1 });
    });
  }

  private back(): void {
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
