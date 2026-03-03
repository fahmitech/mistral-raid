import Phaser from 'phaser';

/**
 * Drop-in replacement for scene.add.text() with readability defaults.
 *
 * Adds:
 *   – Black stroke (thickness 3) to prevent text from blending into dark
 *     backgrounds or particle effects.
 *   – Soft drop shadow for depth and visual separation.
 *
 * All properties in `style` override the defaults, so existing font family,
 * color, fontSize, wordWrap, lineSpacing etc. are preserved exactly.
 * Depth is NOT forced so the caller can set it via .setDepth() as usual.
 */
export function createReadableText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string | string[],
  style: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.GameObjects.Text {
  // Deep-merge shadow so a partial override still gets the base values
  const mergedShadow = {
    offsetX: 1,
    offsetY: 1,
    color: '#000000',
    blur: 2,
    fill: true,
    ...(style.shadow as Record<string, unknown> ?? {}),
  };

  const merged: Phaser.Types.GameObjects.Text.TextStyle = {
    stroke: '#000000',
    strokeThickness: 3,
    ...style,
    shadow: mergedShadow,
  };

  return scene.add.text(x, y, content, merged);
}
