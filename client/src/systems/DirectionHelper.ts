import type { CompanionContext } from '../types/arena';
import type { GameState } from '../core/GameState';

type Vec2 = { x: number; y: number };

export function getDirection(from: Vec2, to: Vec2): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5)   return 'east';
  if (angle >= 22.5  && angle < 67.5)   return 'south-east';
  if (angle >= 67.5  && angle < 112.5)  return 'south';
  if (angle >= 112.5 && angle < 157.5)  return 'south-west';
  if (Math.abs(angle) >= 157.5)         return 'west';
  if (angle >= -157.5 && angle < -112.5) return 'north-west';
  if (angle >= -112.5 && angle < -67.5)  return 'north';
  return 'north-east';
}

export function getDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function buildContext(
  playerPos: Vec2,
  enemies: Vec2[],
  boss: Vec2 | null,
  treasures: Vec2[],
  gs: GameState
): CompanionContext {
  const data = gs.getData();
  return {
    playerPos,
    enemies,
    boss,
    treasures,
    playerHP: data.playerHP,
    playerMaxHP: data.playerMaxHP,
    level: data.level,
    coins: data.coins,
  };
}
