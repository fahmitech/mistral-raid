import Phaser from 'phaser';
import { FRAME_LIST } from '../utils/assetManifest';
import { CHARACTER_CONFIGS } from '../config/characters';
import { ENEMY_CONFIGS } from '../config/enemies';
import { BOSS_CONFIGS } from '../config/bosses';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = 200;
    const barHeight = 8;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 - barHeight / 2;

    const bar = this.add.graphics();
    const loadingText = this.add
      .text(width / 2, barY - 16, 'LOADING...', {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0xcc33ff, 1);
      bar.fillRect(barX, barY, barWidth * value, barHeight);
    });

    this.load.on('complete', () => {
      bar.destroy();
      loadingText.destroy();
    });

    for (const entry of FRAME_LIST) {
      this.load.image(entry.key, entry.url);
    }

    this.load.on('loaderror', (file: { key: string; url: string }) => {
      console.error('[BootScene] Audio load error:', file.key, file.url);
    });

    // ── Music ────────────────────────────────────────────────────────────────────
    this.load.audio('menu_theme',      '/audio/music/menu_theme.mp3');
    this.load.audio('dungeon_ambient', '/audio/ambient/dungeon_ambient.mp3');
    this.load.audio('combat_music',    '/audio/combat/combat_music.mp3');
    this.load.audio('boss_music',      '/audio/boss/boss_music.mp3');
    this.load.audio('victory_music',   '/audio/music/victory_music.mp3');
    this.load.audio('game_over_music', '/audio/music/game_over.mp3');
    this.load.audio('credits_theme',   '/audio/credits/credits_theme.mp3');
    // ── SFX ──────────────────────────────────────────────────────────────────────
    this.load.audio('sword_attack',    '/audio/combat/sword_attack.mp3');
    this.load.audio('enemy_hit',       '/audio/enemies/enemy_hit.mp3');
    this.load.audio('enemy_die',       '/audio/enemies/enemy_die.mp3');
    this.load.audio('dash',            '/audio/movement/dash.mp3');
    this.load.audio('shield',          '/audio/movement/shield_activate.mp3');
    this.load.audio('footstep',        '/audio/movement/footstep.mp3');
    this.load.audio('ui_click',        '/audio/ui/menu_click.mp3');
    this.load.audio('menu_hover',      '/audio/ui/menu_hover.mp3');
    this.load.audio('chest_open',      '/audio/interaction/chest_open.mp3');
    this.load.audio('potion_drink',    '/audio/interaction/potion_drink.mp3');
    this.load.audio('boss_roar',       '/audio/boss/boss_roar.mp3');
  }

  create(): void {
    this.aliasMissingFrames();
    this.createAnimations();
    this.createWeaponAssets();
    this.scene.start('MenuScene');
  }

  private createAnimations(): void {
    const createAnim = (key: string, action: 'idle' | 'run', frameRate = 8): void => {
      const frames = this.resolveFrames(key, action);
      if (frames.length === 0) return;
      this.anims.create({
        key: `${key}_${action}`,
        frames: frames.map((frame) => ({ key: frame })),
        frameRate,
        repeat: -1,
      });
    };

    Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
      createAnim(cfg.spriteKey, 'idle', 8);
      createAnim(cfg.spriteKey, 'run', 8);
    });

    Object.values(ENEMY_CONFIGS).forEach((cfg) => {
      createAnim(cfg.spriteKey, 'idle', 8);
      createAnim(cfg.spriteKey, 'run', 8);
    });

    Object.values(BOSS_CONFIGS).forEach((cfg) => {
      createAnim(cfg.spriteKey, 'idle', 8);
      createAnim(cfg.spriteKey, 'run', 8);
    });

    const coinFrames = ['coin_anim_f0', 'coin_anim_f1', 'coin_anim_f2', 'coin_anim_f3'].filter((k) =>
      this.textures.exists(k)
    );
    if (coinFrames.length) {
      this.anims.create({
        key: 'coin_spin',
        frames: coinFrames.map((k) => ({ key: k })),
        frameRate: 8,
        repeat: -1,
      });
    }

    const torchFrames = ['wall_fountain_mid_blue_anim_f0', 'wall_fountain_mid_blue_anim_f1', 'wall_fountain_mid_blue_anim_f2'].filter(
      (k) => this.textures.exists(k)
    );
    if (torchFrames.length) {
      this.anims.create({
        key: 'torch',
        frames: torchFrames.map((k) => ({ key: k })),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  private resolveFrames(key: string, action: 'idle' | 'run'): string[] {
    const frames: string[] = [];
    const idleBase = `${key}_idle_anim_f0`;
    const runBase = `${key}_run_anim_f0`;
    const genericBase = `${key}_anim_f0`;

    if (this.textures.exists(idleBase)) {
      for (let i = 0; i < 4; i += 1) {
        const frameKey = `${key}_${action}_anim_f${i}`;
        frames.push(this.textures.exists(frameKey) ? frameKey : `${key}_idle_anim_f0`);
      }
      return frames;
    }

    if (this.textures.exists(genericBase)) {
      for (let i = 0; i < 4; i += 1) {
        const frameKey = `${key}_anim_f${i}`;
        frames.push(this.textures.exists(frameKey) ? frameKey : `${key}_anim_f0`);
      }
      return frames;
    }

    if (this.textures.exists(runBase)) {
      for (let i = 0; i < 4; i += 1) {
        const frameKey = `${key}_${action}_anim_f${i}`;
        frames.push(this.textures.exists(frameKey) ? frameKey : `${key}_run_anim_f0`);
      }
    }

    return frames;
  }

  private aliasMissingFrames(): void {
    const aliasMap: Record<string, string> = {
      skelet: 'chort',
      necromancer: 'doc',
      orc_armored: 'masked_orc',
    };

    Object.entries(aliasMap).forEach(([missing, fallback]) => {
      this.aliasAnimSet(missing, fallback);
    });

    this.aliasRunToIdle('ice_zombie');

    Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
      this.ensureAnimFrames(cfg.spriteKey, 'idle');
      this.ensureAnimFrames(cfg.spriteKey, 'run');
    });
    Object.values(ENEMY_CONFIGS).forEach((cfg) => {
      this.ensureAnimFrames(cfg.spriteKey, 'idle');
      this.ensureAnimFrames(cfg.spriteKey, 'run');
      this.ensureAnimFrames(cfg.spriteKey, 'anim');
    });
    Object.values(BOSS_CONFIGS).forEach((cfg) => {
      this.ensureAnimFrames(cfg.spriteKey, 'idle');
      this.ensureAnimFrames(cfg.spriteKey, 'run');
      this.ensureAnimFrames(cfg.spriteKey, 'anim');
    });
  }

  private aliasAnimSet(target: string, source: string): void {
    const patterns: Array<{ base: string; fallback: string }> = [
      { base: `${target}_idle_anim_f`, fallback: `${source}_idle_anim_f` },
      { base: `${target}_run_anim_f`, fallback: `${source}_run_anim_f` },
      { base: `${target}_anim_f`, fallback: `${source}_anim_f` },
    ];

    patterns.forEach((pattern) => {
      for (let i = 0; i < 4; i += 1) {
        const targetKey = `${pattern.base}${i}`;
        const sourceKey = `${pattern.fallback}${i}`;
        if (!this.textures.exists(targetKey) && this.textures.exists(sourceKey)) {
          const sourceTex = this.textures.get(sourceKey);
          const image = sourceTex.getSourceImage() as HTMLImageElement;
          this.textures.addImage(targetKey, image);
        }
      }
    });
  }

  private ensureAnimFrames(key: string, kind: 'idle' | 'run' | 'anim'): void {
    const baseKey = kind === 'anim' ? `${key}_anim_f` : `${key}_${kind}_anim_f`;
    const frame0 = `${baseKey}0`;
    if (!this.textures.exists(frame0)) return;
    for (let i = 1; i < 4; i += 1) {
      const frameKey = `${baseKey}${i}`;
      if (!this.textures.exists(frameKey)) {
        const sourceTex = this.textures.get(frame0);
        const image = sourceTex.getSourceImage() as HTMLImageElement;
        this.textures.addImage(frameKey, image);
      }
    }
  }

  private createWeaponAssets(): void {
    const requiredKeys = [
      'weapon_regular_sword',
      'weapon_katana',
      'weapon_big_hammer',
      'bomb_f0',
      'bomb_f1',
      'bomb_f2',
      'weapon_shuriken',
    ];
    const status: Record<string, boolean> = {};
    requiredKeys.forEach((key) => {
      status[key] = this.textures.exists(key);
    });

    if (!status['weapon_shuriken']) {
      const fallback = this.findShurikenFallback();
      if (fallback) {
        this.aliasTexture(fallback, 'weapon_shuriken');
        status['weapon_shuriken'] = this.textures.exists('weapon_shuriken');
      }
    }

    this.ensureBombFuseAnimation();
    this.ensureSwordSlashTexture();
    console.info('[BootScene] Weapon textures:', status);
  }

  private findShurikenFallback(): string | null {
    const candidates = ['weapon_throwing_axe', 'weapon_dagger_silver', 'floor_spikes_anim_f0'];
    return candidates.find((key) => this.textures.exists(key)) ?? null;
  }

  private aliasTexture(source: string, target: string): void {
    if (this.textures.exists(target) || !this.textures.exists(source)) return;
    const sourceTex = this.textures.get(source);
    const image = sourceTex.getSourceImage() as HTMLImageElement;
    this.textures.addImage(target, image);
  }

  private ensureBombFuseAnimation(): void {
    if (this.anims.exists('bomb_fuse')) return;
    const frames = ['bomb_f0', 'bomb_f1', 'bomb_f2'].filter((k) => this.textures.exists(k));
    if (!frames.length) return;
    this.anims.create({
      key: 'bomb_fuse',
      frames: frames.map((k) => ({ key: k })),
      frameRate: 10,
      repeat: -1,
    });
  }

  private ensureSwordSlashTexture(): void {
    if (this.textures.exists('weapon_sword_slash')) return;
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x66ccff, 1);
    gfx.fillRoundedRect(0, 0, 18, 4, 2);
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillRoundedRect(2, 1, 14, 2, 1);
    gfx.generateTexture('weapon_sword_slash', 18, 4);
    gfx.destroy();
  }

  private aliasRunToIdle(key: string): void {
    for (let i = 0; i < 4; i += 1) {
      const runKey = `${key}_run_anim_f${i}`;
      const idleKey = `${key}_idle_anim_f${i}`;
      if (!this.textures.exists(runKey) && this.textures.exists(idleKey)) {
        const sourceTex = this.textures.get(idleKey);
        const image = sourceTex.getSourceImage() as HTMLImageElement;
        this.textures.addImage(runKey, image);
      }
    }
  }
}
