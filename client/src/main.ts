import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayerSelectScene } from './scenes/PlayerSelectScene';
import { LevelScene } from './scenes/LevelScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { PauseScene } from './scenes/PauseScene';
import { InventoryScene } from './scenes/InventoryScene';
import { OptionsScene } from './scenes/OptionsScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';
import { AudioDebugOverlay } from './systems/AudioDebugOverlay';
import { ArenaScene } from './scenes/ArenaScene';
import { CoopSelectScene } from './scenes/CoopSelectScene';
import { DifficultySelectScene } from './scenes/DifficultySelectScene';
import { AICompanionDebugOverlay } from './systems/AICompanionDebugOverlay';
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
  },
  scene:[
    BootScene,
    MenuScene,
    PlayerSelectScene,
    CoopSelectScene,
    DifficultySelectScene,
    LevelScene,
    LevelUpScene,
    PauseScene,
    InventoryScene,
    OptionsScene,
    CreditsScene,
    GameOverScene,
    VictoryScene,
    ArenaScene,
    AudioDebugOverlay,
    AICompanionDebugOverlay,
  ],
  backgroundColor: '#0a0a1a',
  audio: { disableWebAudio: false },
};

// Wait for fonts to load before starting the game
let game: Phaser.Game;

const startGame = () => {
  game = new Phaser.Game(config);

  const updateIntegerZoom = () => {
    const maxZoom = game.scale.getMaxZoom();
    const nextZoom = Math.floor(Math.max(1, Math.min(ZOOM, maxZoom)));
    if (game.scale.zoom !== nextZoom) {
      game.scale.setZoom(nextZoom);
    }
  };

  window.addEventListener('resize', updateIntegerZoom);
  updateIntegerZoom();

  setTimeout(() => {
    if (game.canvas) {
      game.canvas.style.imageRendering = 'pixelated';
    }
  }, 0);
};

// Preload critical font before starting game
const preloadFonts = async () => {
  try {
    // Force the font to load by using FontFace API
    const font = new FontFace('Press Start 2P', 'url(/fonts/PressStart2P-Regular.ttf)');
    await font.load();
    document.fonts.add(font);
  } catch (e) {
    console.warn('Font preload failed, using document.fonts.ready fallback');
  }
  // Wait for all fonts to be ready
  await document.fonts.ready;
};

preloadFonts().then(startGame);

const ensureErrorOverlay = (): HTMLPreElement => {
  const existing = document.getElementById('error-overlay');
  if (existing && existing instanceof HTMLPreElement) return existing;
  const pre = document.createElement('pre');
  pre.id = 'error-overlay';
  pre.style.position = 'fixed';
  pre.style.left = '0';
  pre.style.right = '0';
  pre.style.top = '0';
  pre.style.margin = '0';
  pre.style.padding = '10px 12px';
  pre.style.maxHeight = '45vh';
  pre.style.overflow = 'auto';
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  pre.style.background = 'rgba(0, 0, 0, 0.85)';
  pre.style.color = '#ffcc66';
  pre.style.zIndex = '99999';
  pre.style.pointerEvents = 'none';
  pre.style.display = 'none';
  document.body.appendChild(pre);
  return pre;
};

const showErrorOverlay = (title: string, details: string) => {
  const pre = ensureErrorOverlay();
  pre.textContent = `${title}\n\n${details}`;
  pre.style.display = 'block';
};

window.addEventListener('error', (event: ErrorEvent) => {
  const details =[event.message, event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : '', event.error?.stack ?? '']
    .filter(Boolean)
    .join('\n');
  showErrorOverlay('Runtime error', details);
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event.reason as unknown;
  const details =
    reason instanceof Error
      ? `${reason.message}\n${reason.stack ?? ''}`
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason, null, 2);
  showErrorOverlay('Unhandled promise rejection', details);
});

const preventContextMenu = (event: Event) => event.preventDefault();
window.addEventListener('contextmenu', preventContextMenu);

export { game };
