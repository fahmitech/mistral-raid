import type { MechanicConfig } from '../types/arena';
import type { Player } from '../entities/Player';
import type Phaser from 'phaser';
import { ProjectileSpawner } from '../mechanics/ProjectileSpawner';
import { HazardZoneSpawner } from '../mechanics/HazardZoneSpawner';
import { LaserBeam } from '../mechanics/LaserBeam';
import { HomingOrb } from '../mechanics/HomingOrb';
import { WallOfDeath } from '../mechanics/WallOfDeath';
import { MinionSpawner } from '../mechanics/MinionSpawner';

export interface MechanicInstance {
  update(time: number, delta: number): void;
  destroy(): void;
  isExpired: boolean;
}

export type DamageSource = 'projectile' | 'hazard' | 'melee';

interface MechanicContext {
  scene: Phaser.Scene;
  player: Player;
  boss: Phaser.GameObjects.Sprite;
  onDamage: (amount: number, source: DamageSource) => void;
  onOrbDestroyed: () => void;
  onMinionKilled: () => void;
}

export class MechanicInterpreter {
  private scene: Phaser.Scene;
  private player: Player;
  private boss: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number, source: DamageSource) => void;
  private onOrbDestroyed: () => void;
  private onMinionKilled: () => void;
  private mechanics: MechanicInstance[] = [];
  private spawnTimers: Phaser.Time.TimerEvent[] = [];

  constructor(ctx: MechanicContext) {
    this.scene = ctx.scene;
    this.player = ctx.player;
    this.boss = ctx.boss;
    this.onDamage = ctx.onDamage;
    this.onOrbDestroyed = ctx.onOrbDestroyed;
    this.onMinionKilled = ctx.onMinionKilled;
  }

  applyMechanics(configs: MechanicConfig[]): void {
    this.clear();
    configs.forEach((config, idx) => {
      const timer = this.scene.time.addEvent({
        delay: 400 * idx,
        callback: () => this.spawnMechanic(config),
      });
      this.spawnTimers.push(timer);
    });
  }

  update(time: number, delta: number): void {
    this.mechanics.forEach((mechanic) => mechanic.update(time, delta));
    this.mechanics = this.mechanics.filter((mechanic) => !mechanic.isExpired);
  }

  clear(): void {
    this.spawnTimers.forEach((timer) => timer.remove(false));
    this.spawnTimers = [];
    this.mechanics.forEach((mechanic) => mechanic.destroy());
    this.mechanics = [];
  }

  private spawnMechanic(config: MechanicConfig): void {
    const instance = this.createMechanic(config);
    if (instance) this.mechanics.push(instance);
  }

  private createMechanic(config: MechanicConfig): MechanicInstance | null {
    const ctx = {
      scene: this.scene,
      player: this.player,
      boss: this.boss,
      onDamage: this.onDamage,
      onOrbDestroyed: this.onOrbDestroyed,
      onMinionKilled: this.onMinionKilled,
    };

    switch (config.type) {
      case 'projectile_spawner':
        return new ProjectileSpawner(ctx, config);
      case 'hazard_zone':
        return new HazardZoneSpawner(ctx, config);
      case 'laser_beam':
        return new LaserBeam(ctx, config);
      case 'homing_orb':
        return new HomingOrb(ctx, config);
      case 'wall_of_death':
        return new WallOfDeath(ctx, config);
      case 'minion_spawn':
        return new MinionSpawner(ctx, config);
      default:
        return null;
    }
  }
}
