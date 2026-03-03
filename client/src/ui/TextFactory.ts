import Phaser from 'phaser';

/**
 * Unified text factory for the entire game.
 *
 * Defaults:
 *   – VT323 pixel font (sharper at small dungeon-HUD sizes)
 *   – Black stroke (thickness 3) for contrast against all backgrounds
 *   – Hard 1-pixel drop shadow (blur: 0) for pixel-perfect clarity
 *   – resolution: 1 (no sub-pixel smoothing on pixel-art canvas)
 *
 * All properties in `style` override the defaults. Depth is NOT forced —
 * set it on the returned object via .setDepth() as usual.
 */
export function createGameText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string | string[],
  style: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.GameObjects.Text {
  const mergedShadow = {
    offsetX: 1,
    offsetY: 1,
    color: '#000000',
    blur: 0,
    fill: true,
    ...(style.shadow as Record<string, unknown> ?? {}),
  };

  const merged: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"VT323"',
    stroke: '#000000',
    strokeThickness: 3,
    resolution: 1,
    ...style,
    shadow: mergedShadow,
  };

  return scene.add.text(x, y, content, merged);
}
