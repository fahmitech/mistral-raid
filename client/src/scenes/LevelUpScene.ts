import Phaser from 'phaser';
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from '../config/constants';
import { BuffManager, BuffType } from '../systems/BuffManager';
import { GameState } from '../core/GameState';
import { Player } from '../entities/Player';

const BUFF_OPTIONS: { id: BuffType; name: string; description: string }[] = [
  { id: 'DAMAGE_UP', name: '+20% Damage', description: 'Increase attack power' },
  { id: 'CRIT_UP', name: '+15% Crit', description: 'Higher critical chance' },
  { id: 'HP_UP', name: '+1 Max HP', description: 'Gain health point' },
  { id: 'ATTACK_SPEED_UP', name: '+15% Speed', description: 'Move faster' },
  { id: 'FIRE_RATE_UP', name: '+15% Fire Rate', description: 'Shoot faster' },
];

export class LevelUpScene extends Phaser.Scene {
  private selectedIndex = 0;
  private selectedBuffs: { id: BuffType; name: string; description: string }[] = [];

  constructor() {
    super('LevelUpScene');
  }

  init(data: { level: number; player: Player }): void {
    this.data.set('level', data.level);
    this.data.set('player', data.player);
    this.selectedIndex = 0;
  }

  create(): void {
    const level = this.data.get('level') as number;

    // Pause background
    this.add.rectangle(
      INTERNAL_WIDTH / 2,
      INTERNAL_HEIGHT / 2,
      INTERNAL_WIDTH,
      INTERNAL_HEIGHT,
      0x000000,
      0.7
    ).setScrollFactor(0).setDepth(1);

    // Title
    this.add.text(
      INTERNAL_WIDTH / 2,
      20,
      `LEVEL ${level} COMPLETE`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffff00',
      }
    ).setOrigin(0.5).setDepth(2);

    // Select 3 random buffs
    this.selectedBuffs = this.selectRandomBuffs(3);

    // Display buff options
    this.selectedBuffs.forEach((buff, idx) => {
      const y = 60 + idx * 30;
      const isSelected = idx === this.selectedIndex;

      this.add.rectangle(
        INTERNAL_WIDTH / 2,
        y,
        200,
        24,
        isSelected ? 0x00ff00 : 0x333333,
        0.8
      ).setDepth(2);

      this.add.text(
        INTERNAL_WIDTH / 2,
        y - 4,
        buff.name,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: '6px',
          color: isSelected ? '#000000' : '#ffffff',
        }
      ).setOrigin(0.5).setDepth(3);
    });

    // Instructions
    this.add.text(
      INTERNAL_WIDTH / 2,
      140,
      'UP/DOWN or W/S to move | ENTER to select',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#aaaaaa',
      }
    ).setOrigin(0.5).setDepth(2);

    // Input
    this.input.keyboard!.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard!.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard!.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.selectBuff());
  }

  private moveSelection(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + this.selectedBuffs.length) % this.selectedBuffs.length;
    this.scene.restart();
  }

  private selectBuff(): void {
    const buff = this.selectedBuffs[this.selectedIndex];
    const gameState = GameState.get();
    const player = this.data.get('player') as Player;

    BuffManager.get().applyBuff(buff.id, player, gameState);

    const level = this.data.get('level') as number;
    const nextLevel = level + 1;

    this.scene.stop();
    this.scene.resume('LevelScene');
    if (nextLevel < 4) {
      this.scene.start('LevelScene', { level: nextLevel });
    }
  }

  private selectRandomBuffs(count: number): typeof BUFF_OPTIONS {
    const shuffled = [...BUFF_OPTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
