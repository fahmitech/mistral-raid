import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayerSelectScene } from './scenes/PlayerSelectScene';
import { LevelScene } from './scenes/LevelScene';
import { PauseScene } from './scenes/PauseScene';
import { InventoryScene } from './scenes/InventoryScene';
import { OptionsScene } from './scenes/OptionsScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, ZOOM } from './config/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  parent: 'app',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  zoom: 1,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  scene: [
    BootScene,
    MenuScene,
    PlayerSelectScene,
    LevelScene,
    PauseScene,
    InventoryScene,
    OptionsScene,
    CreditsScene,
    GameOverScene,
    VictoryScene,
  ],
  backgroundColor: '#0a0a1a',
};

const game = new Phaser.Game(config);

// Keep the canvas scaling to an integer multiple of the internal resolution.
// This prevents browser sub-pixel scaling that makes UI text look blurry.
const updateIntegerZoom = () => {
  const maxZoom = game.scale.getMaxZoom();
  const nextZoom = Math.max(1, Math.min(ZOOM, maxZoom));
  if (game.scale.zoom !== nextZoom) {
    game.scale.setZoom(nextZoom);
  }
};
window.addEventListener('resize', updateIntegerZoom);
updateIntegerZoom();

const preventContextMenu = (event: Event) => event.preventDefault();
window.addEventListener('contextmenu', preventContextMenu);

export { game };
