import Phaser from 'phaser';

export class ArenaScene extends Phaser.Scene {
  constructor() {
    super('ArenaScene');
  }

  create(): void {
    this.add.rectangle(160, 90, 320, 180, 0x101018, 1);
    this.add
      .text(160, 90, 'ARENA STUB', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
