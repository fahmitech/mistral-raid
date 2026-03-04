import { Player } from '../entities/Player';
import { GameState } from '../core/GameState';

export type BuffType = 'DAMAGE_UP' | 'CRIT_UP' | 'HP_UP' | 'ATTACK_SPEED_UP' | 'FIRE_RATE_UP';

export interface Buff {
  id: BuffType;
  name: string;
  description: string;
}

export class BuffManager {
  private static instance: BuffManager;
  private activeBuffs: BuffType[] = [];

  static get(): BuffManager {
    if (!BuffManager.instance) {
      BuffManager.instance = new BuffManager();
    }
    return BuffManager.instance;
  }

  applyBuff(buffId: BuffType, player: Player, gameState: GameState): void {
    this.activeBuffs.push(buffId);

    const state = gameState.getData();

    switch (buffId) {
      case 'DAMAGE_UP':
        state.playerDamage *= 1.2;
        break;
      case 'CRIT_UP':
        player.critChance = Math.min(player.critChance + 0.15, 0.4);
        break;
      case 'HP_UP':
        state.playerMaxHP += 1;
        state.playerHP += 1;
        break;
      case 'ATTACK_SPEED_UP':
        state.playerSpeed *= 1.15;
        break;
      case 'FIRE_RATE_UP':
        state.playerFireRate *= 0.85; // Lower is faster
        break;
    }
  }

  getActiveBuffs(): BuffType[] {
    return [...this.activeBuffs];
  }

  reset(): void {
    this.activeBuffs = [];
  }
}
