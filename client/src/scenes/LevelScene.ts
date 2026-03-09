import Phaser from 'phaser';
import {
  DASH_COOLDOWN_MS,
  DASH_DISTANCE,
  DASH_INVINCIBLE_MS,
  DASH_MAX_CHARGES,
  ENEMY_EXPLODE_RANGE,
  ENEMY_PROJECTILE_LIFETIME_MS,
  ENEMY_PROJECTILE_SPEED,
  INVINCIBLE_MS,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  PROJECTILE_LIFETIME_MS,
  PROJECTILE_SPEED,
  PROJECTILE_SIZE,
  SHIELD_COOLDOWN_MS,
  SHIELD_DURATION_MS,
  TILE_SIZE,
} from '../config/constants';
import { CHARACTER_CONFIGS } from '../config/characters';
import { ENEMY_CONFIGS } from '../config/enemies';
import { ITEM_CONFIGS, WEAPON_LABELS, WEAPON_ORDER } from '../config/items';
import {
  EnemyBehavior,
  EnemyConfig,
  EnemyType,
  ItemEffect,
  ItemType,
  LevelData,
  RoomType,
  TileType,
} from '../config/types';
import { GameState } from '../core/GameState';
import { MazeData, MazeGenerator, type Room } from '../core/MazeGenerator';
import { getLevelData } from '../core/LevelConfig';
import { EnemyFactory } from '../core/EnemyFactory';
import { BossFactory } from '../core/BossFactory';
import { ItemFactory } from '../core/ItemFactory';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { BossEntity } from '../entities/BossEntity';
import { Item } from '../entities/Item';
import { WeaponConfig, WeaponExplosionConfig } from '../config/types';
import { LootSystem } from '../systems/LootSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { MiniMap } from '../systems/MiniMap';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import { TelemetryTracker } from '../systems/TelemetryTracker';
import { AssistantChat } from '../systems/AssistantChat';
import { buildContext } from '../systems/DirectionHelper';
import { wsClient } from '../network/WebSocketClient';
import { AICompanion, type CompanionDecision } from '../entities/AICompanion';
import { CoopState } from '../systems/CoopState';
import type { CompanionDebugData } from '../systems/AICompanionDebugOverlay';
import { DifficultyManager } from '../systems/DifficultyManager';
import { CritSystem } from '../systems/CritSystem';
import { BuffManager } from '../systems/BuffManager';
import { LevelHUDOverlay } from '../ui/LevelHUDOverlay';
import { JournalOverlay } from '../ui/JournalOverlay';
import { getLoreEntry, type LoreEntry, type LoreEntryId } from '../content/loreEntries';
import { getStoryCard, type StoryCardId } from '../content/storyCards';
import { LevelKey } from '../entities/LevelKey';
import { LevelDoor, type LevelDoorOptions } from '../entities/LevelDoor';

import { MusicLayer } from '../types/AudioTypes';
import type { ServerMessage } from '../types/arena';

// Persists across scene.restart() calls so retries reuse the exact same map and enemy positions.
interface EnemySpawnRecord { x: number; y: number; config: EnemyConfig; }
let _checkpoint: { maze: MazeData; spawns: EnemySpawnRecord[]; level: number } | null = null;

interface LoreInteractable {
  id: LoreEntryId;
  marker: Phaser.GameObjects.Rectangle;
  bounds: Phaser.Geom.Rectangle;
  pulse: Phaser.Tweens.Tween;
}

interface GateLetter {
  id: LoreEntryId;
  sprite: Phaser.GameObjects.Sprite;
  bounds: Phaser.Geom.Rectangle;
  prompt: Phaser.GameObjects.Text;
}

interface GateVisualConfig {
  hintId: LoreEntryId;
  keyStrategy: 'northAlcove' | 'floodedCrypt' | 'collapsedBeam' | 'shatteredObelisk';
  letterStrategy: 'startSide' | 'wardDesk' | 'forgeEdge' | 'riftCarving';
  doorTextures: { closed: string; open: string; tint?: number };
  glow?: { color: number; width: number; height: number; alpha: number };
}

const GATE_CONFIGS: Record<number, GateVisualConfig> = {
  1: {
    hintId: 'level1_key_hint',
    keyStrategy: 'northAlcove',
    letterStrategy: 'startSide',
    // Placeholder sprite keys for the rusted quarantine gate; replace when bespoke art lands.
    doorTextures: { closed: 'door_lvl1_closed', open: 'door_lvl1_open', tint: 0xb87333 },
    glow: { color: 0x7c3aed, width: 22, height: 40, alpha: 0.18 },
  },
  2: {
    hintId: 'level2_key_hint',
    keyStrategy: 'floodedCrypt',
    letterStrategy: 'wardDesk',
    doorTextures: { closed: 'door_lvl2_closed', open: 'door_lvl2_open', tint: 0x94a3b8 },
    glow: { color: 0x7dd3a7, width: 24, height: 42, alpha: 0.22 },
  },
  3: {
    hintId: 'level3_key_hint',
    keyStrategy: 'collapsedBeam',
    letterStrategy: 'forgeEdge',
    doorTextures: { closed: 'door_lvl3_closed', open: 'door_lvl3_open', tint: 0x9a3412 },
    glow: { color: 0xf97316, width: 26, height: 38, alpha: 0.2 },
  },
  4: {
    hintId: 'level4_key_hint',
    keyStrategy: 'shatteredObelisk',
    letterStrategy: 'riftCarving',
    doorTextures: { closed: 'door_lvl4_closed', open: 'door_lvl4_open', tint: 0x8b5cf6 },
    glow: { color: 0xc084fc, width: 28, height: 52, alpha: 0.3 },
  },
};

export class LevelScene extends Phaser.Scene {
  private levelData!: LevelData;
  private maze!: MazeData;
  private player!: Player;
  private playerSpriteKey = 'knight_m';

  private wallShadows?: Phaser.GameObjects.Graphics;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bossGroup!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private playerProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private lighting!: LightingSystem;
  private minimap!: MiniMap;
  private shieldRing!: Phaser.GameObjects.Graphics;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { [key: string]: Phaser.Input.Keyboard.Key };

  private lastShotAt = 0;
  private hudOverlay?: LevelHUDOverlay;
  private dashBar?: Phaser.GameObjects.Graphics;
  private dashBarBg?: Phaser.GameObjects.Graphics;
  private dashCooldownRect = { x: 0, y: 0, width: 0, height: 0 };
  private shieldBarRect = { x: 0, y: 0, width: 0, height: 0 };
  private shieldBarBg?: Phaser.GameObjects.Graphics;
  private shieldIndicator?: Phaser.GameObjects.Graphics;
  private leftSeparator?: Phaser.GameObjects.Graphics;
  private rightSeparator?: Phaser.GameObjects.Graphics;
  private heartSprites: Phaser.GameObjects.Image[] = [];
  private lastHP = -1;
  private lastTelemetrySentAt = 0;

  private boss?: BossEntity;
  private bossBar?: Phaser.GameObjects.Graphics;
  private bossNameText?: Phaser.GameObjects.Text;
  private bossTriggered = false;
  private currentLevel = 1;
  private levelCompleting = false;
  private lives = 3;
  private isRetry = false;
  private checkpointEnemiesKilled = 0;
  private enemiesKilledThisLevel = 0;
  private retrying = false;
  private stairsSprite?: Phaser.GameObjects.Image;
  private stairsActive = false;

  private stairsCheck?: Phaser.Time.TimerEvent;
  private minimapTimer?: Phaser.Time.TimerEvent;

  private options = SaveSystem.loadOptions();
  private currentWeaponType: ItemType = ItemType.WeaponSword;
  private weaponConfig!: WeaponConfig;
  private lastUpdateTime = 0;

  private debugEnabled = false;
  private debugText?: Phaser.GameObjects.Text;
  private debugMarker?: Phaser.GameObjects.Graphics;
  private debugToggleKey?: Phaser.Input.Keyboard.Key;
  private playerRenderGlitchFrames = 0;

  // ─── AI Companion chat (voice/text assistant) ─────────────────────────────────
  private assistantChat?: AssistantChat;
  private lastProximityCheck = 0;

  // ─── AI Co-Op Companion ────────────────────────────────────────────────────────
  private companion?: AICompanion;
  private companionProjectiles?: Phaser.Physics.Arcade.Group;
  private companionDecisionTimer?: Phaser.Time.TimerEvent;
  private companionDecisionPending = false;
  private lastCompanionDecision: CompanionDecision | null = null;
  private companionDecisionLatencyMs = 0;
  private companionFallbackActive = false;
  private companionRequestCount = 0;
  private companionDebugOverlayOpen = false;
  private companionSpeakBubble?: Phaser.GameObjects.Container;
  private companionSpeakTimer?: Phaser.Time.TimerEvent;

  private journalOverlay?: JournalOverlay;
  private loreInteractables: LoreInteractable[] = [];
  private pendingLoreEntries: LoreEntry[] = [];
  private loreTriggered = new Set<LoreEntryId>();
  private loreOverlayOpen = false;
  private lorePauseActive = false;
  private pausedTimeScale = 1;
  private physicsPausedForLore = false;
  private tweensPausedForLore = false;
  private animsPausedForLore = false;
  private gateLetter?: GateLetter;
  private gateKey?: LevelKey;
  private gateDoor?: LevelDoor;
  private gateDoorCollider?: Phaser.Physics.Arcade.Collider;
  private gateDoorOverlap?: Phaser.Physics.Arcade.Collider;
  private gateDecor: Phaser.GameObjects.GameObject[] = [];
  private gateKeyPrompt?: Phaser.GameObjects.Text;
  private gateDoorPrompt?: Phaser.GameObjects.Text;
  private gateState = {
    active: false,
    letterRead: false,
    keyCollected: false,
    hintId: null as LoreEntryId | null,
  };
  private doorPromptResetTimer?: Phaser.Time.TimerEvent;
  private storyOverlayActive = false;

  // ─── Telemetry (adaptive backend) ───────────────────────────────────────────
  private telemetry = new TelemetryTracker();
  private telemetryTimer: Phaser.Time.TimerEvent | null = null;
  private liveTelemetryTimer: Phaser.Time.TimerEvent | null = null;
  private telemetryActive = false;
  private wsMessageUnsub: (() => void) | null = null;

  // ─── Audio debug (F4 overlay) ─────────────────────────────────────────────────
  private audioDebugText?: Phaser.GameObjects.Text;

  // ─── Audio state ─────────────────────────────────────────────────────────────
  private activeAudioLayer: MusicLayer = 'ambient';
  private combatMusicActive = false;
  private enemyQuietStart = 0;
  private audioOverlayOpen = false;
  private damageLog: { amount: number; time: number }[] = [];
  private lastFootstepAt = 0;
  private lastTelemetryUpdate = 0;

  constructor() {
    super('LevelScene');
  }

  init(data: { level?: number; continue?: boolean; lives?: number; enemiesKilled?: number; isRetry?: boolean }): void {
    const state = GameState.get();
    if (data?.continue) {
      const save = SaveSystem.load();
      if (save) {
        state.loadSave(save);
      }
    } else if (data?.level) {
      state.setLevel(data.level);
    }
    this.currentLevel = data?.level ?? 1;
    this.lives = data?.lives ?? 3;
    this.isRetry = data?.isRetry ?? false;
    this.checkpointEnemiesKilled = data?.enemiesKilled ?? 0;
    this.enemiesKilledThisLevel = 0;
    this.levelCompleting = false;
    this.retrying = false;
    this.levelData = getLevelData(state.getData().level);
  }

  create(): void {
    const audio = AudioManager.get();
    audio.setOptions(this.options);
    audio.init(this);

    this.setupTelemetry();

    // Reset combat music state.
    this.activeAudioLayer = 'ambient';
    this.combatMusicActive = false;
    this.enemyQuietStart = 0;
    this.audioOverlayOpen = false;
    this.damageLog = [];
    this.lastFootstepAt = 0;
    this.lastTelemetryUpdate = 0;
    this.resetGateState();
    this.pendingLoreEntries = [];
    this.loreTriggered.clear();
    this.loreOverlayOpen = false;
    this.lorePauseActive = false;
    this.clearLoreInteractables();
    this.resumeFromLorePause(true);

    // Start dungeon ambient music
    AudioManager.playMusic(this, 'dungeon_ambient');

    this.cameras.main.setBackgroundColor(this.levelData.bgColor);

    // Scene instances are reused across `scene.start('LevelScene', ...)`.
    // Make event binding idempotent to avoid leaking handlers across long sessions / retries.
    this.events.off('resume', this.handleResume, this);
    this.events.on('resume', this.handleResume, this);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.createBulletTextures();

    // Reuse the saved maze on retry so the player returns to the exact same map.
    const usingCheckpoint = this.isRetry && _checkpoint?.level === this.currentLevel;
    if (usingCheckpoint) {
      this.maze = _checkpoint!.maze;
    } else {
      this.maze = new MazeGenerator().generate(this.levelData);
    }
    this.physics.world.setBounds(0, 0, this.maze.width * TILE_SIZE, this.maze.height * TILE_SIZE);

    this.createFloor();
    this.createWalls();
    this.createDecor();

    this.playerProjectiles = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.items = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.bossGroup = this.physics.add.group();

    this.createPlayer();
    this.spawnItems();

    if (usingCheckpoint) {
      // Spawn only the enemies that were still alive when the player died.
      for (let i = this.checkpointEnemiesKilled; i < _checkpoint!.spawns.length; i += 1) {
        const s = _checkpoint!.spawns[i];
        const enemy = new Enemy(this, s.x, s.y, s.config);
        this.add.existing(enemy);
        this.physics.add.existing(enemy);
        enemy.setCollideWorldBounds(true);
        this.enemies.add(enemy);
      }
    } else {
      // Fresh level — spawn exactly the right enemies for this level and save for retry.
      const spawned = this.spawnLevelEnemies();
      _checkpoint = {
        maze: this.maze,
        spawns: spawned.map((e) => ({ x: e.x, y: e.y, config: e.config })),
        level: this.currentLevel,
      };
    }

    // ── AI Co-Op companion (spawned before collision setup so groups exist) ──────
    if (CoopState.get().isCoopMode) {
      this.createCompanion();
    }

    this.setupCollisions();
    if (this.companion) this.setupCompanionCollisions();
    this.setupCamera();
    this.createHUD();
    this.setupLoreHotspots();

    this.lighting = new LightingSystem(this, this.levelData.fogDensity);
    this.lighting.setTorches(this.maze.torchSpawns.map((t) => ({ x: t.x * TILE_SIZE + 8, y: t.y * TILE_SIZE + 8 })));

    this.minimap = new MiniMap(this, this.maze);
    this.minimapTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const tileX = Math.floor(this.player.x / TILE_SIZE);
        const tileY = Math.floor(this.player.y / TILE_SIZE);
        this.minimap.update(tileX, tileY, this.stairsActive, this.maze.stairs);
      },
    });

    this.shieldRing = this.add.graphics().setDepth(18);

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.showLevelIntro();

    this.stairsSprite = this.add.image(
      this.maze.stairs.x * TILE_SIZE + 8,
      this.maze.stairs.y * TILE_SIZE + 8,
      'floor_stairs'
    );
    this.stairsSprite.setVisible(false).setDepth(2);
    this.setupLevelGate();

    this.stairsCheck = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => this.checkStairs(),
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
      Q: this.input.keyboard!.addKey('Q'),
      R: this.input.keyboard!.addKey('R'),
      E: this.input.keyboard!.addKey('E'),
      I: this.input.keyboard!.addKey('I'),
      ESC: this.input.keyboard!.addKey('ESC'),
      SPACE: this.input.keyboard!.addKey('SPACE'),
      SHIFT: this.input.keyboard!.addKey('SHIFT'),
      F2: this.input.keyboard!.addKey('F2'),
      F3: this.input.keyboard!.addKey('F3'),
      F4: this.input.keyboard!.addKey('F4'),
      F9: this.input.keyboard!.addKey('F9'),
      H: this.input.keyboard!.addKey('H'),
    };
    this.debugToggleKey = this.keys.F2;

    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerdown', this.handlePointerDown, this);

    // AI Companion chat panel
    this.assistantChat?.destroy();
    this.assistantChat = new AssistantChat(() => {
      const enemies = (this.enemies.getChildren() as Enemy[])
        .filter((e) => e.active)
        .map((e) => ({ x: e.x, y: e.y }));
      const boss = this.boss?.active ? { x: this.boss.x, y: this.boss.y } : null;
      const treasures = (this.items.getChildren() as Item[])
        .filter((i) => i.active)
        .map((i) => ({ x: i.x, y: i.y }));
      return buildContext(
        { x: this.player.x, y: this.player.y },
        enemies, boss, treasures, GameState.get()
      );
    });

    if (this.currentLevel === 4) {
      this.setupSuspenseMode();
    }
  }

  update(time: number, delta: number): void {
    this.lastUpdateTime = time;
    this.handleInput(time);
    this.updateCombatMusic(time);

    this.player.updateBlink(time);
    // Defensive: keep the player above the fog overlay even if something resets depths.
    if (this.lighting) {
      const overlayDepth = this.lighting.getOverlayDepth();
      if ((this.player.depth ?? 0) <= overlayDepth) {
        this.player.setDepth(overlayDepth + 1);
      }
    }
    if (!Number.isFinite(this.player.alpha) || this.player.alpha <= 0) {
      this.player.setAlpha(1);
      this.player.setVisible(true);
    }
    this.player.updateWeaponPosition();
    this.ensurePlayerRenderable();
    this.updateShieldRing(time);
    this.checkAutoCollect();
    this.applyFogVisibility();

    this.enemies.children.iterate((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) return true;
      enemy.updateAI(this.player, time, {
        shootProjectile: (x, y, vx, vy, dmg, color) => this.spawnEnemyProjectile(x, y, vx, vy, dmg, color),
        spawnEnemy: (type, x, y) => this.spawnSummonedEnemy(type, x, y),
        shake: (d, i) => this.shakeCamera(d, i),
        playSound: (sx, sy, name) => AudioManager.get().playSFXAt(name, sx, sy, this.player.x, this.player.y),
      });
      this.updateEnemyAnim(enemy);
      return true;
    });

    if (this.boss) {
      this.boss.updateAI(this.player, time, {
        shootProjectile: (x, y, vx, vy, dmg, color) => this.spawnEnemyProjectile(x, y, vx, vy, dmg, color),
        spawnEnemy: (type, x, y) => this.spawnSummonedEnemy(type, x, y),
        shake: (d, i) => this.shakeCamera(d, i),
      });
      this.updateBossBar();
    }

    if (this.telemetryActive) {
      this.telemetry.update(this.player, this.boss ?? null, delta);
    }

    this.checkBossTrigger();
    this.updateProximityAlert(time);
    this.updateHUD(time);
    this.lighting.update(this.player.x, this.player.y);
    this.updateDebug(time);
    if (this.companion?.active) this.updateCompanion(time);
  }

  private ensurePlayerRenderable(): void {
    // Defensive watchdog: in long sessions / multiple restarts, we've seen intermittent cases where the
    // player is logically visible but stops rendering. Keep the fix surgical by only intervening when
    // the sprite *should* be visible yet renderFlags indicate otherwise.
    if (!this.player) return;

    // Ensure the player and weapon aren't excluded by camera ignore filters.
    // (cameraFilter is used by Camera.ignore; 0 means render for all cameras).
    (this.player as unknown as { cameraFilter?: number }).cameraFilter = 0;
    (this.player.weaponSprite as unknown as { cameraFilter?: number }).cameraFilter = 0;

    // Ensure they're still on the display list (should be, but guards long-session edge cases).
    if (!this.children.exists(this.player)) {
      this.add.existing(this.player);
    }
    if (!this.children.exists(this.player.weaponSprite)) {
      this.add.existing(this.player.weaponSprite);
    }

    const rf = (this.player as unknown as { renderFlags?: number }).renderFlags;
    const shouldRender = this.player.visible && this.player.alpha > 0.2;
    if (shouldRender && rf === 0) {
      this.playerRenderGlitchFrames += 1;
      // After a few consecutive frames, force a minimal refresh of render-related flags.
      if (this.playerRenderGlitchFrames >= 6) {
        this.player.setVisible(true);
        this.player.setAlpha(1);
        this.player.setActive(true);
        this.player.weaponSprite.setVisible(true);
        this.player.weaponSprite.setActive(true);
        this.playerRenderGlitchFrames = 0;
      }
    } else {
      this.playerRenderGlitchFrames = 0;
    }
  }

  private handleResume(): void {
    this.options = SaveSystem.loadOptions();
    AudioManager.get().setOptions(this.options);
    if (!AudioManager.isMusicPlaying(this, 'dungeon_ambient') && !AudioManager.isMusicPlaying(this, 'combat_music') && !AudioManager.isMusicPlaying(this, 'boss_music')) {
      if (this.activeAudioLayer === 'boss') {
        AudioManager.playMusic(this, 'boss_music');
      } else if (this.combatMusicActive) {
        AudioManager.playMusic(this, 'combat_music');
      } else {
        AudioManager.playMusic(this, 'dungeon_ambient');
      }
    }
    if (this.player) {
      this.player.setAlpha(1);
      this.player.setVisible(true);
      this.player.invincibleUntil = 0;
    }
  }

  private setupTelemetry(): void {
    const url = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:8787';
    wsClient.connect(url);
    this.wsMessageUnsub?.();
    this.wsMessageUnsub = wsClient.onMessage((msg) => this.handleServerMessage(msg));
    this.telemetry.startPhase(0);
    this.telemetryActive = true;
    this.lastTelemetrySentAt = 0;
    this.telemetryTimer = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => this.sendTelemetry(),
    });
    this.liveTelemetryTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => this.sendLiveTelemetry(),
    });
  }

  private sendTelemetry(): void {
    if (!this.telemetryActive) return;
    if (!wsClient.isConnected) return;
    const playerData = GameState.get().getData();
    const bossHp = this.boss?.active ? this.boss.hp : 0;
    const raw = this.telemetry.getRawTelemetry(playerData.playerHP, playerData.playerMaxHP, bossHp);
    wsClient.send({ type: 'telemetry', payload: raw });
    this.lastTelemetrySentAt = this.time.now;
  }

  private sendLiveTelemetry(): void {
    if (!this.telemetryActive) return;
    if (!wsClient.isConnected) return;
    if (!this.player || !this.enemies) return;

    const state = GameState.get().getData();
    const zone = this.telemetry.getCurrentZone(this.player.x, this.player.y);
    const corners = new Set(['top_left', 'top_right', 'bot_left', 'bot_right']);

    wsClient.send({
      type: 'LIVE_TELEMETRY',
      payload: {
        context: 'dungeon',
        player_hp_pct: state.playerMaxHP > 0 ? state.playerHP / state.playerMaxHP : 0,
        enemy_count: this.enemies.countActive(),
        player_zone: zone,
        recent_dodge_bias: this.telemetry.getRecentDodgeBias(),
        recent_accuracy: this.telemetry.getRecentAccuracy(10),
        in_corner: corners.has(zone),
        elapsed_ms: this.time.now,
      },
    });
  }

  private handleServerMessage(msg: ServerMessage): void {
    if (msg.type !== 'ENEMY_DIRECTIVE') return;
    if (!this.enemies) return;

    (this.enemies.getChildren() as Enemy[]).forEach((enemy) => {
      if (!enemy.active) return;
      enemy.applyDirective(msg.payload, this.time.now);
    });
  }

  private recordTelemetryHit(proj: Phaser.Physics.Arcade.Sprite): void {
    if (!this.telemetryActive) return;
    if (proj.getData('telemetryHit')) return;
    proj.setData('telemetryHit', true);
    this.telemetry.recordShotHit();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.loreOverlayOpen) return;
    if (pointer.rightButtonDown()) {
      this.tryShield();
    }
  }

  private handleShutdown(): void {
    // Remove per-run handlers (avoid accumulation across retries).
    this.events.off('resume', this.handleResume, this);
    this.input?.off('pointerdown', this.handlePointerDown, this);
    AudioManager.stopAll(this);
    AudioManager.get().stopHeartbeat();
    if (this.audioOverlayOpen) {
      this.scene.stop('AudioDebugOverlay');
      this.audioOverlayOpen = false;
    }

    const safeClearGroup = (group?: { scene?: unknown; children?: { size?: number }; clear?: (remove?: boolean, destroy?: boolean) => void }) => {
      // During Scene shutdown, plugins (like Arcade Physics) may have already destroyed groups,
      // leaving `children` undefined. Guard to avoid runtime errors.
      if (!group?.scene) return;
      if (!group.children || typeof group.children.size !== 'number') return;
      group.clear?.(true, true);
    };

    // Timers / delayed calls.
    this.stairsCheck?.remove(false);
    this.stairsCheck = undefined;
    this.minimapTimer?.remove(false);
    this.minimapTimer = undefined;
    this.telemetryTimer?.remove(false);
    this.telemetryTimer = null;
    this.liveTelemetryTimer?.remove(false);
    this.liveTelemetryTimer = null;
    this.time.removeAllEvents();

    // Kill tweens created by this Scene.
    this.tweens.killAll();

    // Systems / overlays.
    this.minimap?.destroy();
    // @ts-expect-error - minimap is set in create.
    this.minimap = undefined;
    this.lighting?.destroy();
    // @ts-expect-error - lighting is set in create.
    this.lighting = undefined;

    // Destroy game objects we keep references to (the Scene will also clear display lists, but be explicit).
    this.debugText?.destroy();
    this.debugText = undefined;
    this.debugMarker?.destroy();
    this.debugMarker = undefined;
    this.audioDebugText?.destroy();
    this.audioDebugText = undefined;
    this.hudOverlay?.destroy();
    this.hudOverlay = undefined;
    this.journalOverlay?.destroy();
    this.journalOverlay = undefined;
    this.clearGateObjects();
    this.clearLoreInteractables();
    this.pendingLoreEntries = [];
    this.loreTriggered.clear();
    this.loreOverlayOpen = false;
    this.resumeFromLorePause(true);

    this.wallShadows?.destroy();
    this.wallShadows = undefined;
    this.shieldRing?.destroy();
    // @ts-expect-error - shieldRing is set in create.
    this.shieldRing = undefined;

    this.dashBar?.destroy();
    this.dashBar = undefined;
    this.shieldIndicator?.destroy();
    this.shieldIndicator = undefined;
    this.bossBar?.destroy();
    this.bossBar = undefined;
    this.bossNameText?.destroy();
    this.bossNameText = undefined;
    this.stairsSprite?.destroy();
    this.stairsSprite = undefined;

    this.player?.weaponSprite?.destroy();
    this.player?.destroy();

    safeClearGroup(this.enemies);
    safeClearGroup(this.items);
    safeClearGroup(this.playerProjectiles);
    safeClearGroup(this.enemyProjectiles);
    safeClearGroup(this.bossGroup);
    safeClearGroup(this.walls);
    this.assistantChat?.destroy();
    this.assistantChat = undefined;

    // AI Co-Op companion cleanup
    this.companionDecisionTimer?.remove(false);
    this.companionDecisionTimer = undefined;
    this.companionSpeakTimer?.remove(false);
    this.companionSpeakTimer = undefined;
    this.companionSpeakBubble?.destroy();
    this.companionSpeakBubble = undefined;
    this.companion?.destroyCompanion();
    this.companion = undefined;
    safeClearGroup(this.companionProjectiles);
    if (this.companionDebugOverlayOpen) {
      this.scene.stop('AICompanionDebugOverlay');
      this.companionDebugOverlayOpen = false;
    }

    this.wsMessageUnsub?.();
    this.wsMessageUnsub = null;
    wsClient.disconnect();
    this.telemetryActive = false;
  }

  private createBulletTextures(): void {
    if (!this.textures.exists('player_bullet')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(PROJECTILE_SIZE / 2, PROJECTILE_SIZE / 2, PROJECTILE_SIZE / 2);
      gfx.generateTexture('player_bullet', PROJECTILE_SIZE, PROJECTILE_SIZE);
      gfx.destroy();
    }
    if (!this.textures.exists('enemy_bullet')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(2, 2, 2);
      gfx.generateTexture('enemy_bullet', 4, 4);
      gfx.destroy();
    }
  }

  private createFloor(): void {
    const floor = this.add.renderTexture(0, 0, this.maze.width * TILE_SIZE, this.maze.height * TILE_SIZE);
    floor.setOrigin(0, 0).setDepth(0);
    // Slightly brighten the floor layer to improve floor-vs-wall readability without changing assets.
    floor.setTint(0xdddddd);
    for (let y = 0; y < this.maze.height; y += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        const tile = this.maze.tiles[y][x];
        if (tile !== TileType.Wall) {
          // Break up obvious grid repetition while staying deterministic per tile.
          const variant = ((x * 73856093) ^ (y * 19349663)) & 3;
          floor.draw(`floor_${variant + 1}`, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
  }

  private createWalls(): void {
    this.wallShadows?.destroy();
    this.wallShadows = this.add.graphics().setDepth(0.9);
    this.wallShadows.fillStyle(0x000000, 0.22);

    this.walls = this.physics.add.staticGroup();
    for (let y = 0; y < this.maze.height; y += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        if (this.maze.tiles[y][x] === TileType.Wall) {
          const aboveWall = y > 0 && this.maze.tiles[y - 1][x] === TileType.Wall;
          const key = aboveWall ? 'wall_mid' : 'wall_top_mid';
          const wall = this.add.image(x * TILE_SIZE + 8, y * TILE_SIZE + 8, key).setDepth(1);
          // Slight tint separation improves wall/floor readability without changing assets.
          wall.setTint(aboveWall ? 0x777777 : 0xffffff);
          this.walls.add(wall);

          // Add a subtle shadow on the floor just below wall tiles to make boundaries more readable.
          const belowIsWall = y + 1 < this.maze.height && this.maze.tiles[y + 1][x] === TileType.Wall;
          if (!belowIsWall) {
            this.wallShadows.fillRect(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - 3, TILE_SIZE, 3);
          }
        }
      }
    }
  }

  private createDecor(): void {
    for (const room of this.maze.rooms) {
      if (Math.random() < 0.6) {
        const decor = Phaser.Utils.Array.GetRandom(['skull', 'crate', 'box', 'boxes_stacked', 'column']);
        const cornerX = room.x + (Math.random() < 0.5 ? 1 : room.w - 2);
        const cornerY = room.y + (Math.random() < 0.5 ? 1 : room.h - 2);
        this.add.image(cornerX * TILE_SIZE + 8, cornerY * TILE_SIZE + 8, decor).setDepth(2);
      }

      const bannerKey = Math.random() < 0.5 ? 'wall_banner_red' : 'wall_banner_blue';
      this.add
        .image(room.cx * TILE_SIZE + 8, room.y * TILE_SIZE, bannerKey)
        .setOrigin(0.5, 0)
        .setDepth(2);

      if (room.type === RoomType.Normal && Math.random() < 0.5) {
        const stain = Phaser.Utils.Array.GetRandom(['floor_stain_1', 'floor_stain_2', 'floor_stain_3']);
        const rx = Phaser.Math.Between(room.x + 1, room.x + room.w - 2);
        const ry = Phaser.Math.Between(room.y + 1, room.y + room.h - 2);
        this.add
          .image(rx * TILE_SIZE + 8, ry * TILE_SIZE + 8, stain)
          .setAlpha(0.7)
          .setDepth(2);
      }
    }

    for (const torch of this.maze.torchSpawns) {
      const sprite = this.add.sprite(torch.x * TILE_SIZE + 8, torch.y * TILE_SIZE + 8, 'torch_1');
      sprite.setDepth(2);
      if (this.anims.exists('torch')) {
        sprite.play('torch');
      }
    }
  }

  private createPlayer(): void {
    const gs = GameState.get();
    const state = gs.getData();
    const config = CHARACTER_CONFIGS[state.character];
    this.playerSpriteKey = config.spriteKey;
    const spawnX = this.maze.playerSpawn.x * TILE_SIZE + 8;
    const spawnY = this.maze.playerSpawn.y * TILE_SIZE + 8;
    const weaponConfig = ITEM_CONFIGS[state.equippedWeapon];
    const weaponBehavior = GameState.get().getWeaponConfig(state.equippedWeapon);
    this.currentWeaponType = state.equippedWeapon;
    this.weaponConfig = weaponBehavior;
    this.player = new Player(this, spawnX, spawnY, `${this.playerSpriteKey}_idle_anim_f0`, weaponConfig, weaponBehavior);
    this.add.existing(this.player);
    this.physics.add.existing(this.player);
    if (!this.player.body) {
      this.physics.world.enable(this.player);
    }
    this.player.initPhysics();
    if (this.anims.exists(`${this.playerSpriteKey}_idle`)) {
      this.player.play(`${this.playerSpriteKey}_idle`);
    }
    this.applyEquippedWeapon();
  }

  private applyEquippedWeapon(): void {
    const state = GameState.get();
    const weaponType = state.getEquippedWeaponType();
    const weaponItem = ITEM_CONFIGS[weaponType];
    const behavior = state.getWeaponConfig(weaponType);
    this.currentWeaponType = weaponType;
    this.weaponConfig = behavior;
    this.player.setWeapon(weaponItem, behavior, weaponType);
  }

  private spawnItems(): void {
    for (const chest of this.maze.chestSpawns) {
      const isGolden = Math.random() < 0.25;
      const config = isGolden ? ITEM_CONFIGS[ItemType.GoldenChest] : ITEM_CONFIGS[ItemType.Chest];
      ItemFactory.spawnItem(
        this,
        config,
        chest.x * TILE_SIZE + 8,
        chest.y * TILE_SIZE + 8,
        this.items,
        true
      );
    }

    for (const spawn of this.maze.itemSpawns) {
      const config = LootSystem.rollDrop();
      const manual = config.type.startsWith('w_');
      ItemFactory.spawnItem(this, config, spawn.x * TILE_SIZE + 8, spawn.y * TILE_SIZE + 8, this.items, manual);
    }
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.bossGroup, this.walls);

    this.physics.add.collider(this.playerProjectiles, this.walls, (obj) =>
      this.handleProjectileWallHit(obj as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.collider(this.enemyProjectiles, this.walls, (obj) => obj.destroy());

    this.physics.add.overlap(this.playerProjectiles, this.enemies, (proj, enemy) => {
      this.handleEnemyHit(proj as Phaser.Physics.Arcade.Sprite, enemy as Enemy);
    });

    this.physics.add.overlap(this.playerProjectiles, this.bossGroup, (proj, boss) => {
      this.handleBossHit(proj as Phaser.Physics.Arcade.Sprite, boss as BossEntity);
    });

    this.physics.add.overlap(this.enemyProjectiles, this.player, (proj) => {
      const dmg = (proj as Phaser.Physics.Arcade.Image).getData('damage') as number;
      proj.destroy();
      this.damagePlayer(dmg || 1, this.lastUpdateTime, 'projectile');
    });

    this.physics.add.overlap(this.player, this.enemies, (_playerObj, enemyObj) => {
      const enemy = enemyObj as Enemy | undefined;
      const damage = enemy?.config?.damage;
      if (typeof damage !== 'number') return;
      this.damagePlayer(damage, this.lastUpdateTime, 'melee');
    });

    this.physics.add.overlap(this.player, this.bossGroup, (_p, bossObj) => {
      const boss = bossObj as BossEntity;
      if (!boss.active) return;
      this.damagePlayer(2 + boss.phase, this.lastUpdateTime, 'melee');
    });

  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.maze.width * TILE_SIZE, this.maze.height * TILE_SIZE);
  }

  private createHUD(): void {
    const canvas = this.game.canvas;
    const parent = canvas?.parentElement;
    if (!parent || !canvas) throw new Error('LevelScene: canvas parentElement missing');
    this.hudOverlay = new LevelHUDOverlay(parent, canvas);
    this.journalOverlay?.destroy();
    this.journalOverlay = new JournalOverlay(parent, canvas);
    this.journalOverlay.onRequestClose(() => this.handleLoreCloseRequest());
    this.hudOverlay.onStoryVisibilityChange((visible) => {
      this.storyOverlayActive = visible;
      if (visible) {
        this.applyLorePause();
      } else if (!this.loreOverlayOpen) {
        this.resumeFromLorePause();
      }
    });
    const initKills = this.checkpointEnemiesKilled;
    const initThreshold = this.getKillThreshold();
    this.hudOverlay.updateStats({
      level: this.currentLevel,
      kills: initKills,
      killThreshold: initThreshold,
      lives: this.lives,
      coins: GameState.get().getData().coins,
      score: GameState.get().getData().score,
      weaponLabel: WEAPON_LABELS[this.currentWeaponType] ?? 'SWORD',
    });
    this.hudOverlay.setHint(null);
    this.hudOverlay.setDashCharges(GameState.get().getDashCharges());
    this.hudOverlay.setShieldReady(true);
    this.hudOverlay.setCompanionBadge(null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hudOverlay?.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.hudOverlay?.destroy());

    // Hearts + dash/shield bars
    const heartConfig = this.createHearts();

    const abilityW = 70;
    const abilityH = 8;
    const gap = 10;

    const dashRect = {
      x: heartConfig.endX + 8,
      y: INTERNAL_HEIGHT - 18,
      width: abilityW,
      height: abilityH,
    };
    const shieldRect = {
      x: Math.round(dashRect.x + abilityW + gap + 18),
      y: INTERNAL_HEIGHT - 18,
      width: abilityW,
      height: abilityH,
    };

    this.dashCooldownRect = dashRect;
    this.shieldBarRect = shieldRect;

    this.dashBarBg = this.add.graphics().setScrollFactor(0).setDepth(18);
    this.shieldBarBg = this.add.graphics().setScrollFactor(0).setDepth(18);
    this.dashBar = this.add.graphics().setScrollFactor(0).setDepth(19);
    this.shieldIndicator = this.add.graphics().setScrollFactor(0).setDepth(19);

    this.drawAbilityBackground(this.dashBarBg, dashRect);
    this.drawAbilityBackground(this.shieldBarBg, shieldRect);

    this.leftSeparator = this.add.graphics().setScrollFactor(0).setDepth(18);
    this.rightSeparator = this.add.graphics().setScrollFactor(0).setDepth(18);
    this.drawSeparators(heartConfig);
    this.updateDashChargesDisplay();

    // ── Clickable zones over dash and shield bars ──────────────────────────
    const hitPad = 6; // extra hit area above/below the bars
    this.add
      .rectangle(
        dashRect.x + dashRect.width / 2,
        dashRect.y + dashRect.height / 2,
        dashRect.width + 8,
        dashRect.height + hitPad * 2
      )
      .setScrollFactor(0)
      .setDepth(25)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tryDash(this.lastUpdateTime));

    this.add
      .rectangle(
        shieldRect.x + shieldRect.width / 2,
        shieldRect.y + shieldRect.height / 2,
        shieldRect.width + 8,
        shieldRect.height + hitPad * 2
      )
      .setScrollFactor(0)
      .setDepth(25)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tryShield());
  }

  private createHearts(): { maxHearts: number; endX: number } {
    this.heartSprites.forEach((heart) => heart.destroy());
    this.heartSprites = [];
    const maxHearts = Math.ceil(GameState.get().getData().playerMaxHP / 2);
    const startX = 6;
    const spacing = 18;
    const heartY = INTERNAL_HEIGHT - 12;
    for (let i = 0; i < maxHearts; i += 1) {
      const heart = this.add
        .image(startX + i * spacing, heartY, 'ui_heart_full')
        .setOrigin(0, 1)
        .setScale(1)
        .setScrollFactor(0)
        .setDepth(20);
      this.heartSprites.push(heart);
    }
    return { maxHearts, endX: startX + maxHearts * spacing };
  }

  private updateDashChargesDisplay(): void {
    this.hudOverlay?.setDashCharges(GameState.get().getDashCharges());
  }

  private drawAbilityBackground(
    graphics: Phaser.GameObjects.Graphics | undefined,
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    if (!graphics) return;
    graphics.clear();
    graphics.fillStyle(0x000000, 0.55);
    graphics.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 3);
    graphics.lineStyle(1, 0xffffff, 0.15);
    graphics.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 3);
  }

  private drawSeparators(heartConfig: { maxHearts: number; endX: number }): void {
    const sepHeight = 28;
    const sepTop = INTERNAL_HEIGHT - sepHeight - 10;
    const draw = (graphics: Phaser.GameObjects.Graphics | undefined, x: number) => {
      if (!graphics) return;
      graphics.clear();
      graphics.fillStyle(0xffffff, 0.15);
      graphics.fillRect(x, sepTop, 2, sepHeight);
      graphics.fillStyle(0xffffff, 0.05);
      graphics.fillRect(x + 2, sepTop, 1, sepHeight);
    };
    draw(this.leftSeparator, heartConfig.endX + 10);
    draw(this.rightSeparator, this.shieldBarRect.x + this.shieldBarRect.width + 10);
  }

  private flashDashWarning(): void {
    this.hudOverlay?.flashDashWarning();
    this.time.delayedCall(280, () => this.updateDashChargesDisplay());
  }

  private pulseDashIcon(): void {
    if (!this.dashBarBg) return;
    this.tweens.add({
      targets: this.dashBarBg,
      alpha: { from: 0.6, to: 1 },
      duration: 180,
    });
  }

  private updateHUD(time: number): void {
    const gs = GameState.get();
    const state = gs.getData();
    if (state.equippedWeapon !== this.currentWeaponType) {
      this.applyEquippedWeapon();
    }
    const totalKilled = this.checkpointEnemiesKilled + this.enemiesKilledThisLevel;
    this.hudOverlay?.updateStats({
      level: this.currentLevel,
      kills: totalKilled,
      killThreshold: this.getKillThreshold(),
      lives: this.lives,
      coins: state.coins,
      score: state.score,
      weaponLabel: WEAPON_LABELS[state.equippedWeapon] ?? 'SWORD',
    });

    if (state.playerHP !== this.lastHP) {
      this.lastHP = state.playerHP;
      this.updateHearts();
    }

    // ── Dash bar — segmented charge display ──────────────────────────────────
    const { x: dx, y: dy, width: dw, height: dh } = this.dashCooldownRect;
    if (this.dashBar && dw > 0) {
      this.dashBar.clear();
      const charges = GameState.get().getDashCharges();
      const dashRemaining = Math.max(0, this.player.dashCooldownUntil - time);
      const recharging = dashRemaining > 0;
      const segW = Math.floor((dw - (DASH_MAX_CHARGES - 1) * 2) / DASH_MAX_CHARGES);
      for (let i = 0; i < DASH_MAX_CHARGES; i += 1) {
        const segX = dx + i * (segW + 2);
        const filled = i < charges;
        const isRecharging = !filled && i === charges && recharging;
        if (filled) {
          this.dashBar.fillStyle(0x00e5ff, 0.9);
          this.dashBar.fillRoundedRect(segX, dy, segW, dh, 2);
        } else if (isRecharging) {
          const pct = 1 - dashRemaining / DASH_COOLDOWN_MS;
          this.dashBar.fillStyle(0x004455, 0.6);
          this.dashBar.fillRoundedRect(segX, dy, segW, dh, 2);
          this.dashBar.fillStyle(0x00b8cc, 0.85);
          this.dashBar.fillRoundedRect(segX, dy, Math.max(2, segW * pct), dh, 2);
        } else {
          this.dashBar.fillStyle(0x00304a, 0.5);
          this.dashBar.fillRoundedRect(segX, dy, segW, dh, 2);
        }
      }
    }

    // ── Shield bar — cooldown / active state ──────────────────────────────────
    const { x: sx, y: sy, width: sw, height: sh } = this.shieldBarRect;
    if (this.shieldIndicator && sw > 0) {
      this.shieldIndicator.clear();
      const shieldActive = this.player.isShieldActive(time) || GameState.get().getData().hasShield;
      if (shieldActive) {
        this.hudOverlay?.setShieldReady(true);
        // Pulsing full bar while shield is active
        const pulse = 0.7 + Math.sin(time / 150) * 0.3;
        this.shieldIndicator.fillStyle(0x7c4dff, pulse);
        this.shieldIndicator.fillRoundedRect(sx, sy, sw, sh, 2);
        this.shieldIndicator.lineStyle(1, 0xbb88ff, 0.9);
        this.shieldIndicator.strokeRoundedRect(sx, sy, sw, sh, 2);
      } else {
        const shieldRemaining = Math.max(0, this.player.shieldCooldownUntil - time);
        const pct = shieldRemaining > 0 ? 1 - shieldRemaining / SHIELD_COOLDOWN_MS : 1;
        this.hudOverlay?.setShieldReady(pct >= 1);
        // Background (empty)
        this.shieldIndicator.fillStyle(0x1a0a3a, 0.5);
        this.shieldIndicator.fillRoundedRect(sx, sy, sw, sh, 2);
        // Fill
        if (pct > 0) {
          const color = pct >= 1 ? 0x9966ff : 0x4422aa;
          this.shieldIndicator.fillStyle(color, 0.85);
          this.shieldIndicator.fillRoundedRect(sx, sy, sw * pct, sh, 2);
        }
        // Ready glow when fully recharged
        if (pct >= 1) {
          this.shieldIndicator.lineStyle(1, 0xaa77ff, 0.6);
          this.shieldIndicator.strokeRoundedRect(sx, sy, sw, sh, 2);
        }
      }
    }

    const connected = wsClient.isConnected;
    const since = this.lastTelemetrySentAt > 0 ? time - this.lastTelemetrySentAt : Infinity;
    const sinceText = Number.isFinite(since) ? `${(since / 1000).toFixed(1)}s` : '--';
    const status = this.telemetryActive ? 'ON' : 'OFF';
    const ws = connected ? 'OK' : 'OFF';
    let color = '#66ff99';
    if (!connected) color = '#ff6666';
    else if (since > 1000) color = '#ffcc66';
    this.hudOverlay?.setTelemetry(`TLM:${status} WS:${ws} ${sinceText}`, color);
  }

  private applyFogVisibility(): void {
    if (!this.lighting || !this.player) return;
    const px = this.player.x;
    const py = this.player.y;

    // Enemies / items should be fully obscured if outside any light source.
    this.enemies?.children?.iterate((child) => {
      const enemy = child as Enemy;
      if (!enemy?.active) return true;
      const f = this.lighting.getLightFactor(enemy.x, enemy.y, px, py);
      enemy.setAlpha(f);
      enemy.setVisible(f > 0.02);
      return true;
    });

    this.items?.children?.iterate((child) => {
      const item = child as Item;
      if (!item?.active) return true;
      const f = this.lighting.getLightFactor(item.x, item.y, px, py);
      item.setAlpha(f);
      item.setVisible(f > 0.02);
      return true;
    });

    this.enemyProjectiles?.children?.iterate((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj?.active) return true;
      const f = this.lighting.getLightFactor(proj.x, proj.y, px, py);
      proj.setAlpha(f);
      proj.setVisible(f > 0.02);
      return true;
    });

    this.playerProjectiles?.children?.iterate((child) => {
      const proj = child as Phaser.Physics.Arcade.Image;
      if (!proj?.active) return true;
      const f = this.lighting.getLightFactor(proj.x, proj.y, px, py);
      proj.setAlpha(f);
      proj.setVisible(f > 0.02);
      return true;
    });

    if (this.boss?.active) {
      const f = this.lighting.getLightFactor(this.boss.x, this.boss.y, px, py);
      this.boss.setAlpha(f);
      this.boss.setVisible(f > 0.02);
    }

    if (this.stairsSprite) {
      const f = this.lighting.getLightFactor(this.stairsSprite.x, this.stairsSprite.y, px, py);
      this.stairsSprite.setAlpha(f);
      // Only show the stairs once activated, but still allow fog-of-war to hide it when unlit.
      this.stairsSprite.setVisible(this.stairsActive && f > 0.02);
    }
  }

  private updateHearts(): void {
    const hp = GameState.get().getData().playerHP;
    for (let i = 0; i < this.heartSprites.length; i += 1) {
      const heartValue = Math.max(0, Math.min(2, hp - i * 2));
      const sprite = this.heartSprites[i];
      if (heartValue >= 2) sprite.setTexture('ui_heart_full');
      else if (heartValue === 1) sprite.setTexture('ui_heart_half');
      else sprite.setTexture('ui_heart_empty');
    }
  }

  private handleInput(time: number): void {
    if (this.loreOverlayOpen || this.storyOverlayActive) {
      this.player.setVelocity(0, 0);
      return;
    }

    if (!this.player.body) {
      this.physics.world.enable(this.player);
      this.player.initPhysics();
    }

    const move = new Phaser.Math.Vector2(0, 0);
    const moveIntent =
      !!this.cursors.left?.isDown ||
      this.keys.A.isDown ||
      !!this.cursors.right?.isDown ||
      this.keys.D.isDown ||
      !!this.cursors.up?.isDown ||
      this.keys.W.isDown ||
      !!this.cursors.down?.isDown ||
      this.keys.S.isDown;
    if (moveIntent && this.assistantChat?.isVisible()) {
      this.assistantChat.close();
    }
    if (this.cursors.left?.isDown || this.keys.A.isDown) move.x -= 1;
    if (this.cursors.right?.isDown || this.keys.D.isDown) move.x += 1;
    if (this.cursors.up?.isDown || this.keys.W.isDown) move.y -= 1;
    if (this.cursors.down?.isDown || this.keys.S.isDown) move.y += 1;

    const gs = GameState.get();
    const state = gs.getData();
    if (move.lengthSq() > 0) {
      move.normalize();
      this.player.setVelocity(move.x * state.playerSpeed, move.y * state.playerSpeed);
      this.player.updateFacing(move);
      if (move.x !== 0) this.player.setFlipX(move.x < 0);
      if (this.anims.exists(`${this.playerSpriteKey}_run`)) {
        this.player.anims?.play(`${this.playerSpriteKey}_run`, true);
      }
      if (time - this.lastFootstepAt > 200) {
        this.lastFootstepAt = time;
        AudioManager.playSFX(this, 'footstep');
      }
    } else {
      this.player.setVelocity(0, 0);
      if (this.anims.exists(`${this.playerSpriteKey}_idle`)) {
        this.player.anims?.play(`${this.playerSpriteKey}_idle`, true);
      }
    }

    const pointer = this.input.activePointer;
    // Aim using screen-space so the weapon stays visually synced to the cursor even with camera follow smoothing.
    const cam = this.cameras.main;
    const playerScreenX = this.player.x - cam.scrollX;
    const playerScreenY = this.player.y - cam.scrollY;
    const aimAngle = Phaser.Math.Angle.Between(playerScreenX, playerScreenY, pointer.x, pointer.y);
    this.player.setAimAngle(aimAngle);

    const primaryDown = pointer.isDown && (pointer.leftButtonDown() || pointer.primaryDown);
    const fireRate = gs.getEffectiveFireRate(state.playerFireRate, state.equippedWeapon);
    if (primaryDown && time - this.lastShotAt >= fireRate) {
      this.lastShotAt = time;
      this.shootProjectile();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryDash(time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) {
      this.tryShield();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      this.swapWeapon();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.usePotion();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.tryInteract();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) {
      if (!this.scene.isActive('InventoryScene')) {
        this.scene.launch('InventoryScene');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      if (!this.scene.isActive('PauseScene') && !this.scene.isActive('InventoryScene')) {
        this.scene.launch('PauseScene');
      }
    }

    if (this.keys.H && Phaser.Input.Keyboard.JustDown(this.keys.H)) {
      this.assistantChat?.toggle();
    }

    if (this.debugToggleKey && Phaser.Input.Keyboard.JustDown(this.debugToggleKey)) {
      this.debugEnabled = !this.debugEnabled;
      if (!this.debugEnabled) {
        this.debugText?.destroy();
        this.debugText = undefined;
        this.debugMarker?.destroy();
        this.debugMarker = undefined;
      }
    }

    if (this.keys.F3 && Phaser.Input.Keyboard.JustDown(this.keys.F3)) {
      if (this.audioOverlayOpen) {
        this.scene.stop('AudioDebugOverlay');
        this.audioOverlayOpen = false;
      } else {
        this.scene.launch('AudioDebugOverlay');
        this.audioOverlayOpen = true;
      }
    }

    if (this.keys.F9 && Phaser.Input.Keyboard.JustDown(this.keys.F9) && CoopState.get().isCoopMode) {
      if (this.companionDebugOverlayOpen) {
        this.scene.stop('AICompanionDebugOverlay');
        this.companionDebugOverlayOpen = false;
      } else {
        this.scene.launch('AICompanionDebugOverlay');
        this.companionDebugOverlayOpen = true;
      }
    }

    if (this.keys.F4 && Phaser.Input.Keyboard.JustDown(this.keys.F4)) {
      if (this.audioDebugText) {
        this.audioDebugText.destroy();
        this.audioDebugText = undefined;
      } else {
        this.audioDebugText = this.add
          .text(160, 4, '', {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '9px',
            color: '#00ffcc',
            backgroundColor: 'rgba(0,0,0,0.65)',
            padding: { x: 5, y: 3 },
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setDepth(9999);
      }
    }

    if (this.audioDebugText) {
      const dbg = AudioManager.get().getDebugInfo();
      const pKey = AudioManager.get().getActivePhaserKey();
      const sfxPs = AudioManager.get().getSFXPerSecond();
      this.audioDebugText.setText(
        `[F4 AUDIO] layer:${dbg.layer} | track:${pKey || dbg.musicTracks[0] || 'none'} | sfx/s:${sfxPs} | vol:${(dbg.masterVolume * 100).toFixed(0)}%`
      );
    }

    this.updatePickupHint();
    this.updateGatePrompts();
  }

  private updateDebug(time: number): void {
    if (!this.debugEnabled) return;
    if (!this.debugText) {
      this.debugText = this.add
        .text(6, 24, '', {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: '10px',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.45)',
          padding: { x: 6, y: 4 },
        })
        .setScrollFactor(0)
        .setDepth(9999);
    }
    if (!this.debugMarker) {
      this.debugMarker = this.add.graphics().setDepth(9998);
    }

    const cam = this.cameras.main;
    const p = this.player;
    const w = this.player.weaponSprite;
    const overlayDepth = this.lighting?.getOverlayDepth?.() ?? -1;
    const pInView = cam.worldView.contains(p.x, p.y);
    const pRenderFlags = (p as unknown as { renderFlags?: number }).renderFlags ?? -1;
    const wRenderFlags = (w as unknown as { renderFlags?: number }).renderFlags ?? -1;
    const pCameraFilter = (p as unknown as { cameraFilter?: number }).cameraFilter ?? -1;
    const wCameraFilter = (w as unknown as { cameraFilter?: number }).cameraFilter ?? -1;
    const pOnDisplayList = this.children.exists(p);
    const wOnDisplayList = this.children.exists(w);

    const warnings: string[] = [];
    if (overlayDepth >= 0 && (p.depth ?? 0) <= overlayDepth) warnings.push('PLAYER_BELOW_FOG');
    if (!pInView) warnings.push('PLAYER_OFF_CAMERA');
    if (!p.visible) warnings.push('PLAYER_VISIBLE_FALSE');
    if (p.alpha <= 0.02) warnings.push('PLAYER_ALPHA_LOW');
    if (pRenderFlags === 0) warnings.push('PLAYER_RENDERFLAGS_0');
    if (pCameraFilter !== 0) warnings.push('PLAYER_CAMERA_FILTER');
    if (!pOnDisplayList) warnings.push('PLAYER_NOT_IN_DISPLAYLIST');

    this.debugText.setText(
      [
        `t=${Math.floor(time)} camScroll=(${cam.scrollX.toFixed(1)},${cam.scrollY.toFixed(1)}) zoom=${cam.zoom.toFixed(2)}`,
        `player pos=(${p.x.toFixed(1)},${p.y.toFixed(1)}) inView=${pInView} vis=${p.visible} a=${p.alpha.toFixed(2)} d=${p.depth} rf=${pRenderFlags} cf=${pCameraFilter} dl=${pOnDisplayList}`,
        `weapon pos=(${w.x.toFixed(1)},${w.y.toFixed(1)}) vis=${w.visible} a=${w.alpha.toFixed(2)} d=${w.depth} rf=${wRenderFlags} cf=${wCameraFilter} dl=${wOnDisplayList}`,
        `fog depth=${overlayDepth}`,
        warnings.length ? `WARN: ${warnings.join(' ')}` : 'WARN: (none)',
      ].join('\n')
    );

    this.debugMarker.clear();
    this.debugMarker.lineStyle(1, 0x00ffcc, 1);
    this.debugMarker.strokeCircle(p.x, p.y, 8);
    this.debugMarker.lineStyle(1, 0xffcc00, 1);
    this.debugMarker.beginPath();
    this.debugMarker.moveTo(p.x - 10, p.y);
    this.debugMarker.lineTo(p.x + 10, p.y);
    this.debugMarker.moveTo(p.x, p.y - 10);
    this.debugMarker.lineTo(p.x, p.y + 10);
    this.debugMarker.strokePath();
  }

  private updateShieldRing(time: number): void {
    this.shieldRing.clear();
    if (this.player.isShieldActive(time)) {
      const pulse = 0.5 + Math.sin(time / 140) * 0.2;
      this.shieldRing.lineStyle(1, 0x33aaff, 0.9);
      this.shieldRing.strokeCircle(this.player.x, this.player.y, 11 + pulse * 2);
    }
  }

  private shootProjectile(): void {
    const gs = GameState.get();
    const state = gs.getData();
    const weaponType = state.equippedWeapon;
    const config = this.weaponConfig ?? gs.getWeaponConfig(weaponType);
    this.weaponConfig = config;
    const damageBase = gs.getEffectiveWeaponDamage(state.playerDamage, weaponType);
    const baseAngle = this.player.aimAngle;
    const muzzleX = this.player.x + Math.cos(baseAngle) * 10;
    const muzzleY = this.player.y + Math.sin(baseAngle) * 10;

    const angles = this.buildWeaponAngles(baseAngle, config);
    if (state.isMultiShot) {
      angles.push(baseAngle - 0.2, baseAngle + 0.2);
    }

    angles.forEach((angle) => {
      const hasTexture = this.textures.exists(config.projectileKey);
      const textureKey = hasTexture ? config.projectileKey : 'player_bullet';
      const proj = this.physics.add.sprite(muzzleX, muzzleY, textureKey);
      proj.setDepth(10);
      this.playerProjectiles.add(proj);
      if (this.telemetryActive) {
        this.telemetry.recordShotFired();
      }
      proj.setScale(config.projectileScale ?? 1);
      if (config.projectileSpinDegPerSec) {
        proj.setAngularVelocity(config.projectileSpinDegPerSec);
      } else {
        proj.setAngularVelocity(0);
      }
      if (!hasTexture && config.muzzleFlashColor) {
        proj.setTint(config.muzzleFlashColor);
      }

      const { damage, isCrit } = CritSystem.calculateDamage(
        damageBase,
        this.player.critChance,
        this.player.critMultiplier
      );
      proj.setData('damage', damage);
      proj.setData('isCrit', isCrit);
      proj.setData('knockback', config.knockback);
      proj.setData('weaponType', weaponType);
      proj.setData('pierce', config.pierce ?? 0);
      proj.setData('isBomb', !!config.explosion);
      proj.setRotation(angle + (config.projectileRotationOffset ?? 0));
      proj.setVelocity(Math.cos(angle) * config.projectileSpeed, Math.sin(angle) * config.projectileSpeed);

      if (config.holdAnimationKey && this.anims.exists(config.holdAnimationKey)) {
        proj.play(config.holdAnimationKey);
      } else if (proj.anims) {
        proj.anims.stop();
      }

      if (config.explosion) {
        proj.setData('explosion', config.explosion);
        const fuse = this.time.delayedCall(config.explosion.fuseMs, () => this.explodeBomb(proj));
        proj.setData('fuse', fuse);
      } else {
        this.time.delayedCall(PROJECTILE_LIFETIME_MS, () => {
          if (proj.active) proj.destroy();
        });
      }

      if (isCrit) {
        // Crit projectiles appear yellow
        if (!hasTexture) {
          proj.setTint(0xffff00);
        }
      }
    });

    this.player.playWeaponAttack(config, weaponType);
    this.spawnMuzzleFlash(muzzleX, muzzleY, config.muzzleFlashColor, config.muzzleFlashSize);
    this.shakeCamera(28, config.shakeIntensity);
    AudioManager.get().weaponShoot(weaponType);
  }

  private spawnEnemyProjectile(x: number, y: number, vx: number, vy: number, damage: number, color: number): void {
    const proj = this.physics.add.image(x, y, 'enemy_bullet');
    proj.setTint(color);
    proj.setData('damage', damage);
    this.enemyProjectiles.add(proj);
    proj.setVelocity(vx * ENEMY_PROJECTILE_SPEED, vy * ENEMY_PROJECTILE_SPEED);
    this.time.delayedCall(ENEMY_PROJECTILE_LIFETIME_MS, () => proj.destroy());
  }

  private spawnMuzzleFlash(x: number, y: number, color: number, size: number): void {
    const flash = this.add.circle(x, y, size, color, 1).setDepth(12);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 45,
      onComplete: () => flash.destroy(),
    });
  }

  private buildWeaponAngles(baseAngle: number, config: WeaponConfig): number[] {
    if (config.projectileCount <= 1 || config.spreadDeg <= 0) {
      return [baseAngle];
    }
    const spread = Phaser.Math.DegToRad(config.spreadDeg);
    const angles: number[] = [];
    for (let i = 0; i < config.projectileCount; i += 1) {
      const t = config.projectileCount === 1 ? 0.5 : i / (config.projectileCount - 1);
      angles.push(baseAngle - spread / 2 + spread * t);
    }
    return angles;
  }

  private computeProjectileDamage(baseDamage: number, config: WeaponConfig): { damage: number; crit: boolean } {
    if (config.critChance && Math.random() < config.critChance) {
      return { damage: baseDamage * 1.5, crit: true };
    }
    return { damage: baseDamage, crit: false };
  }

  private tryDash(time: number): void {
    if (time < this.player.dashCooldownUntil) return;
    if (this.player.invincibleUntil - time > 60) return;
    if (!GameState.get().spendDashCharge()) {
      this.flashDashWarning();
      return;
    }

    const dir = this.player.lastDir.clone();
    if (dir.lengthSq() === 0) dir.set(1, 0);
    const newX = Phaser.Math.Clamp(
      this.player.x + dir.x * DASH_DISTANCE,
      TILE_SIZE,
      this.maze.width * TILE_SIZE - TILE_SIZE
    );
    const newY = Phaser.Math.Clamp(
      this.player.y + dir.y * DASH_DISTANCE,
      TILE_SIZE,
      this.maze.height * TILE_SIZE - TILE_SIZE
    );
    this.spawnDashTrail(this.player.x, this.player.y, newX, newY);
    this.player.setPosition(newX, newY);
    this.player.dashCooldownUntil = time + DASH_COOLDOWN_MS;
    this.player.setInvincible(DASH_INVINCIBLE_MS, time);
    this.shakeCamera(28, 0.0025);
    AudioManager.playSFX(this, 'dash');
    this.updateDashChargesDisplay();
    if (this.telemetryActive) {
      this.telemetry.recordDash(dir);
    }
  }

  private spawnDashTrail(x1: number, y1: number, x2: number, y2: number): void {
    for (let i = 0; i < 8; i += 1) {
      const t = i / 7;
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      const ghost = this.add.circle(x, y, 4, 0x00ffe1, 0.6).setDepth(9);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: Phaser.Math.Between(160, 336),
        onComplete: () => ghost.destroy(),
      });
    }
  }

  private tryShield(): void {
    const time = this.lastUpdateTime;
    if (time < this.player.shieldCooldownUntil) return;
    this.player.setShieldActive(SHIELD_DURATION_MS, time);
    this.player.shieldCooldownUntil = time + SHIELD_COOLDOWN_MS;
    AudioManager.playSFX(this, 'shield');
  }

  private swapWeapon(): void {
    const state = GameState.get();
    const owned = new Set(state.inventory.map((slot) => slot.config.type));
    owned.add(ItemType.WeaponSword);
    const current = state.getData().equippedWeapon;
    const startIdx = WEAPON_ORDER.indexOf(current);
    for (let i = 1; i <= WEAPON_ORDER.length; i += 1) {
      const next = WEAPON_ORDER[(startIdx + i) % WEAPON_ORDER.length];
      if (owned.has(next)) {
        state.equipWeapon(next);
        this.applyEquippedWeapon();
        this.player.weaponSprite.setTint(0xffffff);
        this.time.delayedCall(80, () => this.player.weaponSprite.clearTint());
        this.shakeCamera(20, 0.002);
        AudioManager.get().playSFX('weapon_swap', 0.7);
        break;
      }
    }
  }

  private usePotion(): void {
    const state = GameState.get();
    const order = [ItemType.FlaskRed, ItemType.FlaskBigRed, ItemType.FlaskGreen];
    for (const type of order) {
      const slot = state.inventory.find((s) => s.config.type === type);
      if (slot) {
        if (type === ItemType.FlaskBigRed) {
          state.heal(3);
        } else {
          state.heal(1);
        }
        if (type === ItemType.FlaskGreen) {
          const duration = ITEM_CONFIGS[ItemType.FlaskGreen].duration ?? 8000;
          state.applyShield(duration);
        }
        state.removeItem(slot.config, 1);
        AudioManager.playSFX(this, 'potion_drink');
        this.spawnHealEffect();
        break;
      }
    }
  }

  private spawnHealEffect(): void {
    ScoreSystem.floatingText(this, this.player.x, this.player.y - 8, '+HP', '#33ff66');
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(this.player.x, this.player.y, 2, 0x33ff66, 0.8).setDepth(12);
      const dx = Math.cos(angle) * 12;
      const dy = Math.sin(angle) * 12;
      this.tweens.add({
        targets: particle,
        x: particle.x + dx,
        y: particle.y + dy,
        alpha: 0,
        duration: 350,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private tryInteract(): void {
    if (this.loreOverlayOpen) {
      this.handleLoreCloseRequest();
      return;
    }

    const gateLetter = this.getNearbyGateLetter();
    if (gateLetter) {
      this.handleGateLetterInteract(gateLetter);
      return;
    }

    if (this.isPlayerNearGateKey()) {
      this.collectGateKey();
      return;
    }

    const item = this.getInteractiveItem();
    if (item) {
      if (item.isChest) {
        this.openChest(item);
      } else {
        this.collectItem(item);
      }
      return;
    }

    const lore = this.getNearbyLoreInteractable();
    if (lore) {
      this.consumeLoreInteractable(lore);
    }
  }

  private getInteractiveItem(): Item | null {
    const bounds = this.player.getBounds();
    const playerRect = new Phaser.Geom.Rectangle(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    const items = this.items.getChildren() as Item[];
    for (const item of items) {
      if (!item.active || !item.isManual) continue;
      if (Phaser.Geom.Rectangle.Contains(playerRect, item.x, item.y)) {
        return item;
      }
    }
    return null;
  }

  private getNearbyGateLetter(): GateLetter | null {
    if (!this.gateLetter) return null;
    const bounds = this.player.getBounds();
    const playerRect = new Phaser.Geom.Rectangle(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    if (Phaser.Geom.Rectangle.Overlaps(playerRect, this.gateLetter.bounds)) {
      return this.gateLetter;
    }
    return null;
  }

  private isPlayerNearGateKey(): boolean {
    if (!this.player || !this.gateKey || !this.gateKey.active) return false;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gateKey.x, this.gateKey.y);
    return dist <= TILE_SIZE;
  }

  private updatePickupHint(): void {
    if (this.getNearbyGateLetter() || this.isPlayerNearGateKey()) {
      this.hudOverlay?.setHint(null);
      return;
    }
    const item = this.getInteractiveItem();
    if (item) {
      this.hudOverlay?.setHint('[E] Pick up');
      return;
    }
    const lore = this.getNearbyLoreInteractable();
    if (lore) {
      this.hudOverlay?.setHint('[E] Read');
      return;
    }
    this.hudOverlay?.setHint(null);
  }

  private updateGatePrompts(): void {
    if (this.gateLetter && this.player) {
      const dist = Phaser.Math.Distance.Between(
        this.gateLetter.sprite.x,
        this.gateLetter.sprite.y,
        this.player.x,
        this.player.y
      );
      this.gateLetter.prompt.setVisible(dist <= TILE_SIZE);
    }
    if (this.gateKey && this.gateKeyPrompt && this.player) {
      const dist = Phaser.Math.Distance.Between(this.gateKey.x, this.gateKey.y, this.player.x, this.player.y);
      this.gateKeyPrompt.setVisible(dist <= TILE_SIZE * 0.9);
    }
    if (this.gateDoor && this.gateDoorPrompt && this.player) {
      const dist = Phaser.Math.Distance.Between(this.gateDoor.x, this.gateDoor.y - 10, this.player.x, this.player.y);
      if (dist <= TILE_SIZE * 1.2) {
        this.gateDoorPrompt.setVisible(true);
        const locked = this.gateDoor.isLocked();
        const forced = !!this.doorPromptResetTimer;
        if (locked && !forced) {
          this.gateDoorPrompt.setText('LOCKED');
          this.gateDoorPrompt.setColor('#f87171');
        } else if (!locked) {
          this.gateDoorPrompt.setText('[E] ENTER');
          this.gateDoorPrompt.setColor('#fef3c7');
        }
      } else {
        this.gateDoorPrompt.setVisible(false);
      }
    }
  }

  private checkAutoCollect(): void {
    const bounds = this.player.getBounds();
    const playerRect = new Phaser.Geom.Rectangle(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    const items = this.items.getChildren() as Item[];
    for (const item of items) {
      if (!item.active || item.isManual) continue;
      if (Phaser.Geom.Rectangle.Contains(playerRect, item.x, item.y)) {
        this.collectItem(item);
      }
    }
  }

  private collectItem(item: Item): void {
    if (!item.active) return;
    const state = GameState.get();
    if (item.config.effect === ItemEffect.AddCoins) {
      state.addCoins(item.config.value);
      ScoreSystem.floatingText(this, item.x, item.y, `+${item.config.value}`, '#ffcc00');
    } else if (item.config.effect === ItemEffect.HealHP) {
      // Health potions heal directly — no inventory needed
      const amount = item.config.value || 1;
      state.heal(amount);
      AudioManager.playSFX(this, 'potion_drink');
      this.spawnHealEffect();
      ScoreSystem.floatingText(this, item.x, item.y, `+${amount} HP`, '#33ff66');
    } else if (item.config.effect === ItemEffect.Shield) {
      // Shield potions activate shield immediately
      const duration = item.config.duration ?? SHIELD_DURATION_MS;
      state.applyShield(duration);
      this.player.setShieldActive(duration, this.lastUpdateTime);
      AudioManager.playSFX(this, 'shield_activate');
      this.spawnShieldShatter();
      ScoreSystem.floatingText(this, item.x, item.y, 'SHIELDED!', '#7c4dff');
    } else if (item.config.effect === ItemEffect.RestoreDash) {
      const restored = state.restoreDashCharges(item.config.value || 1);
      this.updateDashChargesDisplay();
      this.pulseDashIcon();
      AudioManager.get().pickup();
      ScoreSystem.floatingText(this, item.x, item.y, `DASH ${restored}/${DASH_MAX_CHARGES}`, '#9c7bff');
    } else {
      state.addItem(item.config, item.qty);
      AudioManager.get().pickup();
      if (item.config.type.startsWith('w_')) {
        state.equipWeapon(item.config.type as ItemType);
        this.applyEquippedWeapon();
        ScoreSystem.floatingText(this, item.x, item.y, 'EQUIPPED', '#66ccff');
      }
    }
    item.destroy();
  }

  private openChest(item: Item): void {
    if (item.opened) return;
    item.openChest();
    AudioManager.playSFX(this, 'chest_open');
    const isGolden = item.config.type === ItemType.GoldenChest;
    GameState.get().addCoins(item.config.value);
    const drops = LootSystem.rollChestLoot(isGolden);
    drops.forEach((config) => {
      const offset = Phaser.Math.Between(-8, 8);
      const drop = ItemFactory.spawnItem(this, config, item.x + offset, item.y + offset, this.items, config.type.startsWith('w_'));
      this.tweens.add({
        targets: drop,
        x: drop.x + Phaser.Math.Between(-12, 12),
        y: drop.y + Phaser.Math.Between(-12, 12),
        duration: 280,
        ease: 'Sine.easeOut',
      });
    });
  }

  private updateEnemyAnim(enemy: Enemy): void {
    const hasRun = enemy.config.hasRunAnim && this.anims.exists(`${enemy.config.spriteKey}_run`);
    const moving = enemy.body ? enemy.body.velocity.lengthSq() > 2 : false;
    if (moving && hasRun) {
      enemy.play(`${enemy.config.spriteKey}_run`, true);
    } else if (this.anims.exists(`${enemy.config.spriteKey}_idle`)) {
      enemy.play(`${enemy.config.spriteKey}_idle`, true);
    }
    if (enemy.body && Math.abs(enemy.body.velocity.x) > 1) {
      enemy.setFlipX(enemy.body.velocity.x < 0);
    }
  }

  private handleEnemyHit(proj: Phaser.Physics.Arcade.Sprite, enemy: Enemy): void {
    if (!enemy.active) return;
    if (this.isBombProjectile(proj)) {
      this.recordTelemetryHit(proj);
      this.explodeBomb(proj);
      return;
    }
    const damage = (proj.getData('damage') as number) ?? 1;
    const knockback = (proj.getData('knockback') as number) ?? 0;
    const weaponType = (proj.getData('weaponType') as ItemType) ?? ItemType.WeaponSword;
    const isCrit = (proj.getData('isCrit') as boolean) ?? false;

    // NEW: Update hit counter for dynamic crit progression
    CritSystem.updateHitCounter(this.player);

    // NEW: Spawn crit effect if this was a critical hit
    if (isCrit) {
      CritSystem.spawnCritEffect(this, enemy.x, enemy.y);
    }

    this.processEnemyDamage(enemy, damage, weaponType, knockback, proj.x, proj.y);
    this.recordTelemetryHit(proj);
    this.shakeCamera(45, this.weaponConfig?.shakeIntensity ?? 0.003);
    this.applyPierce(proj);
  }

  private handleBossHit(proj: Phaser.Physics.Arcade.Sprite, boss: BossEntity): void {
    if (!boss.active) return;
    if (this.isBombProjectile(proj)) {
      this.recordTelemetryHit(proj);
      this.explodeBomb(proj);
      return;
    }
    const damage = (proj.getData('damage') as number) ?? 1;
    const weaponType = (proj.getData('weaponType') as ItemType) ?? ItemType.WeaponSword;
    const result = boss.applyDamage(damage);
    this.spawnHitParticles(boss.x, boss.y, this.getWeaponHitColor(weaponType));
    this.recordTelemetryHit(proj);
    if (weaponType === ItemType.WeaponHammer) {
      this.spawnHammerShockwave(boss.x, boss.y);
    }
    if (result.phaseChanged) {
      this.showPhaseText(boss.phase);
    }
    if (result.died) {
      this.handleBossDeath(boss);
    }
    this.applyPierce(proj);
  }

  private processEnemyDamage(
    enemy: Enemy,
    amount: number,
    weaponType: ItemType,
    knockback: number,
    originX: number,
    originY: number
  ): void {
    enemy.takeDamage(amount);
    const tint = this.getWeaponHitColor(weaponType);
    enemy.setTint(tint);
    this.spawnHitParticles(enemy.x, enemy.y, tint);
    if (weaponType === ItemType.WeaponHammer) {
      this.spawnHammerShockwave(enemy.x, enemy.y);
    }
    this.time.delayedCall(80, () => {
      if (!enemy.active) return;
      if (enemy.config.behavior === EnemyBehavior.Shielded && enemy.hp > enemy.maxHP * 0.5) {
        enemy.setTint(0x4488ff);
      } else {
        enemy.clearTint();
      }
    });

    if (enemy.hp <= 0) {
      this.handleEnemyDeath(enemy);
      return;
    }

    const angle = Phaser.Math.Angle.Between(originX, originY, enemy.x, enemy.y);
    enemy.setVelocity(Math.cos(angle) * knockback, Math.sin(angle) * knockback);
  }

  private handleEnemyDeath(enemy: Enemy): void {
    if (!enemy.active) return;
    this.enemiesKilledThisLevel += 1;
    enemy.die();
    AudioManager.playSFX(this, 'enemy_die');
    ScoreSystem.floatingText(this, enemy.x, enemy.y, `+${enemy.xp}`, '#ffdd44');
    GameState.get().addScore(enemy.xp);
    if (enemy.config.behavior === EnemyBehavior.Exploder) {
      this.triggerExploder(enemy);
    }
    this.spawnDeathParticles(enemy.x, enemy.y);
    this.maybeDropLoot(enemy.x, enemy.y);
    if (enemy.config.behavior === EnemyBehavior.SplitOnDeath) {
      this.spawnSummonedEnemy(enemy.config.type as EnemyType, enemy.x + 8, enemy.y + 8);
      this.spawnSummonedEnemy(enemy.config.type as EnemyType, enemy.x - 8, enemy.y - 8);
    }
    enemy.destroy();
    // After destroy, check if the kill threshold for this level has been reached.
    this.time.delayedCall(100, () => this.checkKillThreshold());
  }

  private applyPierce(proj: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBombProjectile(proj)) return;
    const pierce = proj.getData('pierce') as number | undefined;
    if (pierce && pierce > 0) {
      proj.setData('pierce', pierce - 1);
      this.nudgeProjectile(proj);
    } else {
      proj.destroy();
    }
  }

  private nudgeProjectile(proj: Phaser.Physics.Arcade.Sprite): void {
    const body = proj.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    const velocity = body.velocity.clone();
    if (velocity.lengthSq() === 0) return;
    velocity.normalize().scale(6);
    proj.x += velocity.x;
    proj.y += velocity.y;
  }

  private getWeaponHitColor(type: ItemType): number {
    switch (type) {
      case ItemType.WeaponDagger:
        return 0xb3f0ff;
      case ItemType.WeaponKatana:
        return 0xff5555;
      case ItemType.WeaponHammer:
        return 0xffaa55;
      case ItemType.WeaponBomb:
        return 0xaaffcc;
      case ItemType.WeaponSword:
      default:
        return 0x66ccff;
    }
  }

  private spawnHammerShockwave(x: number, y: number): void {
    const ring = this.add.circle(x, y, 6, 0xffaa55, 0.4).setDepth(11);
    this.tweens.add({
      targets: ring,
      radius: 24,
      alpha: 0,
      duration: 160,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private handleProjectileWallHit(obj: Phaser.GameObjects.GameObject): void {
    const proj = obj as Phaser.Physics.Arcade.Sprite;
    if (this.isBombProjectile(proj)) {
      this.explodeBomb(proj);
    } else {
      proj.destroy();
    }
  }

  private isBombProjectile(proj: Phaser.Physics.Arcade.Sprite): boolean {
    return !!proj.getData('isBomb');
  }

  private explodeBomb(proj: Phaser.Physics.Arcade.Sprite): void {
    if (!proj.active) return;
    const explosion = proj.getData('explosion') as WeaponExplosionConfig | undefined;
    const fuse = proj.getData('fuse') as Phaser.Time.TimerEvent | undefined;
    fuse?.remove(false);
    proj.setData('isBomb', false);
    proj.destroy();
    if (!explosion) return;
    const damage = (proj.getData('damage') as number) ?? 1;
    this.spawnBombFlash(proj.x, proj.y, explosion.flashColor, explosion.radius);
    this.shakeCamera(260, explosion.shake);
    AudioManager.get().weaponExplode();

    const enemies = this.enemies.getChildren() as Enemy[];
    enemies.forEach((enemy) => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(proj.x, proj.y, enemy.x, enemy.y) <= explosion.radius) {
        this.processEnemyDamage(enemy, damage, ItemType.WeaponBomb, 80, proj.x, proj.y);
      }
    });

    if (this.boss && this.boss.active) {
      if (Phaser.Math.Distance.Between(proj.x, proj.y, this.boss.x, this.boss.y) <= explosion.radius + 12) {
        const result = this.boss.applyDamage(damage);
        this.spawnHitParticles(this.boss.x, this.boss.y, this.getWeaponHitColor(ItemType.WeaponBomb));
        if (result.phaseChanged) {
          this.showPhaseText(this.boss.phase);
        }
        if (result.died) {
          this.handleBossDeath(this.boss);
        }
      }
    }
  }

  private spawnBombFlash(x: number, y: number, color: number, radius: number): void {
    const flash = this.add.circle(x, y, 4, color, 0.9).setDepth(12);
    const ring = this.add.circle(x, y, 2, color, 0.4).setDepth(12);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private triggerExploder(enemy: Enemy): void {
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    if (dist <= ENEMY_EXPLODE_RANGE) {
      this.damagePlayer(enemy.config.damage * 3, this.lastUpdateTime, 'hazard');
      this.shakeCamera(80, 0.008);
    }
  }

  private maybeDropLoot(x: number, y: number): void {
    if (Math.random() > 0.4) return;
    const config = LootSystem.rollDrop();
    const isManual = config.type.startsWith('w_');
    const drop = ItemFactory.spawnItem(this, config, x, y, this.items, isManual);
    if (config.type === ItemType.Coin && this.anims.exists('coin_spin')) {
      drop.play('coin_spin');
    }
    this.tweens.add({
      targets: drop,
      x: drop.x + Phaser.Math.Between(-12, 12),
      y: drop.y + Phaser.Math.Between(-12, 12),
      duration: 280,
      ease: 'Sine.easeOut',
    });
  }

  private handleBossDeath(boss: BossEntity): void {
    this.telemetry.setBossMaxHp(0);
    this.boss = undefined;
    boss.destroy();
    this.time.timeScale = 0.25;
    this.time.delayedCall(600, () => {
      this.tweens.add({
        targets: this.time,
        timeScale: 1,
        duration: 800,
      });
    });
    this.shakeCamera(400, 0.015);
    this.hideBossBar();
    GameState.get().addScore(50 + this.levelData.level * 20);
    AudioManager.get().bossDeath();
    AudioManager.get().stopHeartbeat();
    this.activeAudioLayer = 'ambient';
    AudioManager.playMusic(this, 'dungeon_ambient');
    this.spawnCoinExplosion(boss.x, boss.y);
    if (this.isGateLevel()) {
      this.stairsSprite?.setVisible(false);
      this.stairsActive = false;
    } else if (this.stairsSprite) {
      this.stairsSprite.setVisible(true);
      this.stairsActive = true;
    }
    const text = this.add
      .text(160, 90, 'BOSS DEFEATED!', {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffdd44',
        stroke: '#663300',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.time.delayedCall(1200, () => text.destroy());
    const gsSnapshot = GameState.get().getData();
    SaveSystem.save(gsSnapshot.character, gsSnapshot, GameState.getDiscoveredLoreIds());
    this.handleLoreAfterBoss();
    this.showBossAftermathCard();

    if (this.levelData.level === 5) {
      this.time.delayedCall(2500, () => {
        this.scene.start('VictoryScene');
      });
    }
  }

  private setupLoreHotspots(): void {
    this.clearLoreInteractables();
    if (!this.maze) return;
    if (this.currentLevel === 1) {
      const room = this.pickRoomNearStart(0);
      if (room) this.addLoreInteractable('day3_note', room, 'corner');
    } else if (this.currentLevel === 2) {
      const room = this.pickRoomNearStart(1) ?? this.pickRoomNearStart(0);
      if (room) this.addLoreInteractable('vael_page34', room, 'corner');
    } else if (this.currentLevel === 3) {
      const room = this.pickCentralRoom() ?? this.pickRoomNearStart(2);
      if (room) this.addLoreInteractable('forge_year22', room, 'center');
    }
  }

  private setupLevelGate(): void {
    if (!this.isGateLevel()) return;
    const config = this.getGateConfigForLevel(this.currentLevel);
    if (!config) return;
    const positions = this.findGatePositions(config);
    if (!positions) return;
    this.clearGateObjects();
    this.gateState = {
      active: true,
      letterRead: false,
      keyCollected: false,
      hintId: config.hintId,
    };
    this.spawnGateLetter(positions.letter, config);
    this.spawnGateKey(positions.key);
    this.spawnGateDoor(positions.door, config);
    this.stairsSprite?.setVisible(false);
  }

  private isGateLevel(level = this.currentLevel): boolean {
    return level >= 1 && level <= 4;
  }

  private getGateConfigForLevel(level: number): GateVisualConfig | null {
    return GATE_CONFIGS[level] ?? null;
  }

  private findGatePositions(config: GateVisualConfig): { letter: Phaser.Math.Vector2; key: Phaser.Math.Vector2; door: Phaser.Math.Vector2 } | null {
    if (!this.maze) return null;
    const letterPoint = this.resolveLetterPosition(config.letterStrategy);
    const keyPoint = this.resolveKeyPosition(config.keyStrategy) ?? letterPoint?.clone();
    if (!letterPoint || !keyPoint) return null;
    const doorPoint = this.tileToWorld(this.maze.stairs.x, this.maze.stairs.y, true);
    return { letter: letterPoint, key: keyPoint, door: doorPoint };
  }

  private resolveLetterPosition(strategy: GateVisualConfig['letterStrategy']): Phaser.Math.Vector2 | null {
    if (!this.maze) return null;
    if (strategy === 'startSide') {
      const room = this.pickRoomNearStart(0) ?? this.maze.startRoom;
      return this.tileToWorld(room.x + 1, room.y + 1);
    }
    if (strategy === 'wardDesk') {
      const room = this.pickRoomByDistance({ x: this.maze.startRoom.cx + 4, y: this.maze.startRoom.cy + 6 }, 1) ?? this.maze.startRoom;
      return this.tileToWorld(room.cx, room.y + 1);
    }
    if (strategy === 'forgeEdge') {
      const room = this.pickTreasureRoom() ?? this.pickCentralRoom() ?? this.maze.startRoom;
      return this.tileToWorld(room.cx - 1, room.y + 1);
    }
    const riftRoom = this.maze.bossRoom ?? this.pickFarRoom();
    return this.tileToWorld(riftRoom.cx, riftRoom.y + 1);
  }

  private resolveKeyPosition(strategy: GateVisualConfig['keyStrategy']): Phaser.Math.Vector2 | null {
    if (!this.maze) return null;
    if (strategy === 'northAlcove') {
      const room = this.getExtremeRoom('y', 'min');
      return this.tileToWorld(room.x + 1, Math.max(room.y + 1, 2));
    }
    if (strategy === 'floodedCrypt') {
      const room = this.pickSecretRoom() ?? this.getExtremeRoom('y', 'max');
      return this.tileToWorld(room.cx, room.y + room.h - 2);
    }
    if (strategy === 'collapsedBeam') {
      const room = this.getExtremeRoom('x', 'max');
      return this.tileToWorld(room.x + room.w - 2, room.cy);
    }
    const room = this.maze.bossRoom ?? this.getExtremeRoom('x', 'max');
    return this.tileToWorld(room.cx - 1, room.cy + 1);
  }

  private spawnGateLetter(position: Phaser.Math.Vector2, config: GateVisualConfig): void {
    this.gateLetter?.sprite.destroy();
    const texture = this.ensureLetterTexture();
    const sprite = this.add.sprite(position.x, position.y, texture).setDepth(6);
    sprite.setScale(0.25);
    const tint =
      config.hintId === 'level1_key_hint'
        ? 0xc08457
        : config.hintId === 'level2_key_hint'
          ? 0x9ca3af
          : config.hintId === 'level3_key_hint'
            ? 0xf97316
            : 0xc4b5fd;
    sprite.setTint(tint);
    this.tweens.killTweensOf(sprite);
    this.gateLetter = {
      id: config.hintId,
      sprite,
      bounds: new Phaser.Geom.Rectangle(position.x - 8, position.y - 8, 16, 16),
      prompt: this.add
        .text(position.x, position.y - 14, '[E] READ', {
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '6px',
          color: '#fef3c7',
        })
        .setOrigin(0.5, 1)
        .setDepth(7)
        .setVisible(false),
    };
  }

  private spawnGateKey(position: Phaser.Math.Vector2): void {
    this.gateKey?.destroy();
    this.gateKeyPrompt?.destroy();
    this.gateKey = new LevelKey(this, position.x, position.y);
    this.gateKeyPrompt = this.add
      .text(position.x, position.y - 14, '[E] TAKE KEY', {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '6px',
        color: '#fde68a',
      })
      .setOrigin(0.5, 1)
      .setDepth(7)
      .setVisible(false);
  }

  private spawnGateDoor(position: Phaser.Math.Vector2, config: GateVisualConfig): void {
    this.gateDoor?.destroy();
    this.gateDoorCollider?.destroy();
    this.gateDoorOverlap?.destroy();
    const doorTextures = this.resolveDoorTextures(config);
    this.gateDoor = new LevelDoor(this, position.x, position.y, doorTextures);
    this.gateDoorCollider = this.physics.add.collider(this.player, this.gateDoor, () => {
      if (this.gateDoor?.isLocked()) this.showDoorLockedHint();
    });
    this.gateDoorOverlap = this.physics.add.overlap(this.player, this.gateDoor, () => this.handleGateDoorOverlap());
    if (config.glow) {
      const glow = this.add.rectangle(
        position.x,
        position.y - 18,
        config.glow.width,
        config.glow.height,
        config.glow.color,
        config.glow.alpha
      );
      glow.setDepth(5);
      this.tweens.add({
        targets: glow,
        alpha: config.glow.alpha * 1.4,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.gateDecor.push(glow);
    }
    this.gateDoorPrompt?.destroy();
    this.gateDoorPrompt = this.add
      .text(position.x, position.y - 30, 'LOCKED', {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '7px',
        color: '#f87171',
      })
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setVisible(false);
  }

  private resolveDoorTextures(config: GateVisualConfig): LevelDoorOptions {
    const closed = this.textures.exists(config.doorTextures.closed) ? config.doorTextures.closed : 'door_closed';
    const open = this.textures.exists(config.doorTextures.open) ? config.doorTextures.open : 'door_open';
    return {
      closedTexture: closed,
      openTexture: open,
      tint: config.doorTextures.tint,
    };
  }

  private ensureLetterTexture(): string {
    const key = 'ui_letter_envelope';
    if (this.textures.exists(key)) return key;
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.setVisible(false);
    const w = 96;
    const h = 64;
    const border = 4;

    // Base envelope body
    gfx.fillStyle(0xb8934a, 1);
    gfx.fillRoundedRect(border, border, w - border * 2, h - border * 2, 6);

    // Surface gradient (simple bands to mimic CSS gradient)
    gfx.fillStyle(0xc9a35a, 0.35);
    gfx.fillRect(border + 2, border + 2, w - border * 4, (h - border * 2) / 2);
    gfx.fillStyle(0x8a5f2c, 0.2);
    gfx.fillRect(border + 2, border + (h - border * 2) / 2, w - border * 4, (h - border * 2) / 2);

    // Outline
    gfx.lineStyle(2, 0x4a3418, 1);
    gfx.strokeRoundedRect(border, border, w - border * 2, h - border * 2, 6);

    const midX = w / 2;
    const midY = h / 2 + 2;

    // Top flap
    gfx.fillStyle(0x9e7432, 1);
    gfx.beginPath();
    gfx.moveTo(border, border);
    gfx.lineTo(midX, midY);
    gfx.lineTo(w - border, border);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(1.5, 0x4a3418, 0.9);
    gfx.strokePath();

    // Bottom flap
    gfx.fillStyle(0xa47835, 1);
    gfx.beginPath();
    gfx.moveTo(border, h - border);
    gfx.lineTo(midX, midY + 6);
    gfx.lineTo(w - border, h - border);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(1.5, 0x4a3418, 0.85);
    gfx.strokePath();

    // Left flap
    gfx.fillStyle(0xa88040, 1);
    gfx.beginPath();
    gfx.moveTo(border, border);
    gfx.lineTo(midX, midY);
    gfx.lineTo(border, h - border);
    gfx.closePath();
    gfx.fillPath();

    // Right flap
    gfx.beginPath();
    gfx.moveTo(w - border, border);
    gfx.lineTo(midX, midY);
    gfx.lineTo(w - border, h - border);
    gfx.closePath();
    gfx.fillPath();

    // Crease lines
    gfx.lineStyle(2, 0x7a5a24, 0.6);
    gfx.beginPath();
    gfx.moveTo(border + 10, border + 8);
    gfx.lineTo(midX, midY);
    gfx.lineTo(w - border - 10, border + 8);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(border + 10, h - border - 8);
    gfx.lineTo(midX, midY);
    gfx.lineTo(w - border - 10, h - border - 8);
    gfx.strokePath();

    // Seal
    gfx.fillStyle(0x8b1a1a, 1);
    gfx.fillCircle(midX, midY + 2, 6);
    gfx.lineStyle(2, 0x4a0e0e, 1);
    gfx.strokeCircle(midX, midY + 2, 6);

    // Checkerboard highlight
    gfx.fillStyle(0xc9a35a, 0.35);
    for (let y = border + 4; y < border + 20; y += 4) {
      for (let x = border + 4; x < border + 30; x += 8) {
        gfx.fillRect(x, y, 4, 4);
      }
    }

    gfx.generateTexture(key, w, h);
    gfx.destroy();
    return key;
  }

  private handleGateLetterInteract(letter: GateLetter): void {
    if (!this.gateState.active) return;
    this.triggerLoreEntry(letter.id);
    this.gateState.letterRead = true;
    letter.prompt.destroy();
    letter.sprite.destroy();
    this.gateLetter = undefined;
  }

  private collectGateKey(): void {
    if (!this.gateState.active || !this.gateKey || this.gateState.keyCollected) return;
    if (!this.gateState.letterRead) {
      ScoreSystem.floatingText(this, this.gateKey.x, this.gateKey.y - 10, 'READ THE NOTE', '#f87171');
      return;
    }
    this.gateKey.collect();
    this.gateState.keyCollected = true;
    ScoreSystem.floatingText(this, this.gateKey.x, this.gateKey.y - 10, 'KEY RECOVERED', '#fef3c7');
    AudioManager.get().pickup();
    this.gateKeyPrompt?.destroy();
    this.gateKeyPrompt = undefined;
    this.gateKey = undefined;
    this.unlockGateDoor();
  }

  private unlockGateDoor(): void {
    if (!this.gateDoor) return;
    this.gateDoor.open();
    this.gateDoorCollider?.destroy();
    this.gateDoorCollider = undefined;
    AudioManager.playSFX(this, 'door_open');
    ScoreSystem.floatingText(this, this.gateDoor.x, this.gateDoor.y - 18, 'GATE OPEN', '#fde68a');
    this.gateDoorPrompt?.setText('[E] ENTER');
    this.gateDoorPrompt?.setColor('#fef3c7');
  }

  private handleGateDoorOverlap(): void {
    if (!this.gateState.active || !this.gateDoor || this.gateDoor.isLocked()) return;
    if (this.levelCompleting) return;
    this.handleLevelComplete();
  }

  private showDoorLockedHint(): void {
    if (!this.gateDoorPrompt) return;
    this.gateDoorPrompt.setText('LOCKED — FIND KEY');
    this.gateDoorPrompt.setColor('#f87171');
    this.gateDoorPrompt.setVisible(true);
    this.doorPromptResetTimer?.remove(false);
    this.doorPromptResetTimer = this.time.delayedCall(2000, () => {
      if (!this.gateDoorPrompt) return;
      this.gateDoorPrompt.setText('LOCKED');
      this.gateDoorPrompt.setColor('#f87171');
      this.doorPromptResetTimer = undefined;
    });
  }

  private clearGateObjects(): void {
    this.gateLetter?.sprite.destroy();
    this.gateLetter?.prompt.destroy();
    this.gateLetter = undefined;
    this.gateKey?.destroy();
    this.gateKey = undefined;
    this.gateDoorCollider?.destroy();
    this.gateDoorCollider = undefined;
    this.gateDoorOverlap?.destroy();
    this.gateDoorOverlap = undefined;
    this.gateDoor?.destroy();
    this.gateDoor = undefined;
    this.gateDecor.forEach((obj) => obj.destroy());
    this.gateDecor = [];
    this.gateDoorPrompt?.destroy();
    this.gateDoorPrompt = undefined;
    this.gateKeyPrompt?.destroy();
    this.gateKeyPrompt = undefined;
    this.doorPromptResetTimer?.remove(false);
    this.doorPromptResetTimer = undefined;
  }

  private resetGateState(): void {
    this.clearGateObjects();
    this.gateState = {
      active: false,
      letterRead: false,
      keyCollected: false,
      hintId: null,
    };
  }

  private pickRoomNearStart(skip: number): Room | null {
    const anchor = { x: this.maze.startRoom.cx, y: this.maze.startRoom.cy };
    return this.pickRoomByDistance(anchor, skip);
  }

  private pickCentralRoom(): Room | null {
    const anchor = { x: this.maze.width / 2, y: this.maze.height / 2 };
    return this.pickRoomByDistance(anchor, 0);
  }

  private pickRoomByDistance(anchor: { x: number; y: number }, skip: number): Room | null {
    const rooms = this.maze.rooms
      .filter((room) => (room.type === RoomType.Normal || room.type === RoomType.Secret) && room !== this.maze.startRoom)
      .sort(
        (a, b) =>
          this.distanceSq(a.cx, a.cy, anchor.x, anchor.y) - this.distanceSq(b.cx, b.cy, anchor.x, anchor.y)
      );
    return rooms[skip] ?? null;
  }

  private pickSecretRoom(): Room | null {
    return this.maze.rooms.find((room) => room.type === RoomType.Secret) ?? null;
  }

  private pickTreasureRoom(): Room | null {
    return this.maze.rooms.find((room) => room.type === RoomType.Treasure) ?? null;
  }

  private pickFarRoom(): Room | null {
    const origin = this.maze.startRoom;
    const rooms = this.maze.rooms
      .filter((room) => room !== origin)
      .sort(
        (a, b) =>
          this.distanceSq(b.cx, b.cy, origin.cx, origin.cy) -
          this.distanceSq(a.cx, a.cy, origin.cx, origin.cy)
      );
    return rooms[0] ?? null;
  }

  private getExtremeRoom(axis: 'x' | 'y', dir: 'min' | 'max'): Room {
    const rooms = this.maze.rooms.filter((room) => room.type !== RoomType.Boss);
    let chosen = rooms[0] ?? this.maze.startRoom;
    let best = chosen ? chosen[axis === 'x' ? 'cx' : 'cy'] : 0;
    rooms.forEach((room) => {
      const value = room[axis === 'x' ? 'cx' : 'cy'];
      if (dir === 'min' ? value < best : value > best) {
        best = value;
        chosen = room;
      }
    });
    return chosen;
  }

  private tileToWorld(tileX: number, tileY: number, alignBottom = false): Phaser.Math.Vector2 {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + (alignBottom ? TILE_SIZE : TILE_SIZE / 2);
    return new Phaser.Math.Vector2(x, y);
  }

  private distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  private addLoreInteractable(id: LoreEntryId, room: Room, preference: 'corner' | 'center'): void {
    const tileX = preference === 'corner' ? room.x + 1 : room.cx;
    const tileY = preference === 'corner' ? room.y + 1 : room.cy;
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;
    const marker = this.add.rectangle(x, y, 14, 10, 0xf6e6c6, 0.95).setDepth(6);
    marker.setStrokeStyle(1, 0x2a1c18, 0.85);
    const pulse = this.tweens.add({
      targets: marker,
      alpha: { from: 0.6, to: 1 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const bounds = new Phaser.Geom.Rectangle(x - 14, y - 10, 28, 20);
    this.loreInteractables.push({ id, marker, bounds, pulse });
  }

  private clearLoreInteractables(): void {
    this.loreInteractables.forEach((entry) => {
      entry.pulse.stop();
      entry.marker.destroy();
    });
    this.loreInteractables = [];
  }

  private getNearbyLoreInteractable(): LoreInteractable | null {
    if (!this.player) return null;
    const bounds = this.player.getBounds();
    const playerRect = new Phaser.Geom.Rectangle(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);
    for (const entry of this.loreInteractables) {
      if (Phaser.Geom.Rectangle.Overlaps(playerRect, entry.bounds)) {
        return entry;
      }
    }
    return null;
  }

  private consumeLoreInteractable(entry: LoreInteractable): void {
    this.triggerLoreEntry(entry.id);
    entry.pulse.stop();
    entry.marker.destroy();
    this.loreInteractables = this.loreInteractables.filter((candidate) => candidate !== entry);
  }

  private triggerLoreEntry(id: LoreEntryId): void {
    if (this.loreTriggered.has(id)) return;
    const entry = getLoreEntry(id);
    if (!entry) return;
    this.loreTriggered.add(id);
    this.pendingLoreEntries.push(entry);
    if (!this.loreOverlayOpen) {
      this.openNextLoreEntry();
    }
  }

  private openNextLoreEntry(): void {
    if (this.loreOverlayOpen) return;
    const next = this.pendingLoreEntries.shift();
    if (!next || !this.journalOverlay) return;
    this.applyLorePause();
    this.loreOverlayOpen = true;
    this.journalOverlay.show(next);
  }

  private handleLoreCloseRequest(): void {
    if (!this.loreOverlayOpen) return;
    this.journalOverlay?.hide();
    this.loreOverlayOpen = false;
    if (this.pendingLoreEntries.length > 0) {
      this.openNextLoreEntry();
    } else {
      this.resumeFromLorePause();
    }
  }

  private applyLorePause(): void {
    if (this.lorePauseActive) return;
    this.lorePauseActive = true;
    this.pausedTimeScale = this.time.timeScale;
    this.time.timeScale = 0;
    if (!this.physics.world.isPaused) {
      this.physics.world.pause();
      this.physicsPausedForLore = true;
    }
    if (!this.tweensPausedForLore) {
      this.tweens.pauseAll();
      this.tweensPausedForLore = true;
    }
    if (!this.animsPausedForLore) {
      this.anims.pauseAll();
      this.animsPausedForLore = true;
    }
    if (this.input.keyboard) {
      this.input.keyboard.enabled = false;
    }
    if (this.player) {
      this.player.setVelocity(0, 0);
    }
  }

  private resumeFromLorePause(force = false): void {
    if (!this.lorePauseActive && !force && !this.physicsPausedForLore && !this.tweensPausedForLore && !this.animsPausedForLore) {
      return;
    }
    this.lorePauseActive = false;
    if (this.physicsPausedForLore) {
      this.physics.world.resume();
      this.physicsPausedForLore = false;
    }
    if (this.tweensPausedForLore) {
      this.tweens.resumeAll();
      this.tweensPausedForLore = false;
    }
    if (this.animsPausedForLore) {
      this.anims.resumeAll();
      this.animsPausedForLore = false;
    }
    this.time.timeScale = this.pausedTimeScale || 1;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }
  }

  private handleLoreAfterBoss(): void {
    if (this.currentLevel === 3 && !GameState.get().isLoreDiscovered('cobb_locket')) {
      this.triggerLoreEntry('cobb_locket');
      this.showStoryCardById('discovery_locket');
    } else if (this.currentLevel === 4 && !GameState.get().isLoreDiscovered('mael_name')) {
      this.triggerLoreEntry('mael_name');
      this.showStoryCardById('discovery_her_name');
    }
  }

  private spawnCoinExplosion(x: number, y: number): void {
    for (let i = 0; i < 12; i += 1) {
      const coin = ItemFactory.spawnItem(this, ITEM_CONFIGS[ItemType.Coin], x, y, this.items, false);
      if (this.anims.exists('coin_spin')) coin.play('coin_spin');
      this.tweens.add({
        targets: coin,
        x: coin.x + Phaser.Math.Between(-40, 40),
        y: coin.y + Phaser.Math.Between(-40, 40),
        duration: 280,
        ease: 'Sine.easeOut',
      });
    }
  }

  private spawnSummonedEnemy(type: EnemyType, x: number, y: number): void {
    const base = ENEMY_CONFIGS[type];
    const config = {
      ...base,
      hp: Math.round(base.hp * this.levelData.enemyHPMult),
      speed: base.speed * this.levelData.enemySpdMult,
    };
    const enemy = new Enemy(this, x, y, config);
    this.add.existing(enemy);
    this.physics.add.existing(enemy);
    enemy.setCollideWorldBounds(true);
    this.enemies.add(enemy);
    AudioManager.get().playSFXAt('elemental_magic', x, y, this.player.x, this.player.y, 0.6);
  }

  /** Spawn exactly the enemies defined for the current level and return them for checkpoint saving. */
  private spawnLevelEnemies(): Enemy[] {
    if (this.currentLevel === 1) {
      // Level 1 — 8 basic enemies (kill 5 to progress)
      return this.spawnEnemiesCustom(8, [EnemyType.Goblin, EnemyType.Imp]);
    }
    if (this.currentLevel === 2) {
      // Level 2 — 10 mixed enemies (kill 5 to progress)
      return this.spawnEnemiesCustom(10, [EnemyType.Chort, EnemyType.BigZombie, EnemyType.Skelet]);
    }
    if (this.currentLevel === 3) {
      // Level 3 — 14 elite enemies (kill 7 to progress)
      return this.spawnEnemiesCustom(14, [EnemyType.Chort, EnemyType.BigZombie, EnemyType.Skelet, EnemyType.IceZombie]);
    }
    if (this.currentLevel === 4) {
      // Level 4 — 14 heavy enemies (kill 7 to progress → Arena)
      return this.spawnEnemiesCustom(14, [EnemyType.Skelet, EnemyType.MaskedOrc, EnemyType.BigZombie, EnemyType.BigDemon]);
    }
    return [];
  }

  /** Spawn `count` enemies chosen round-robin from `types`, placed in maze rooms. */
  private spawnEnemiesCustom(count: number, types: EnemyType[]): Enemy[] {
    const rooms = this.maze.rooms.filter(
      (r) => r.type === RoomType.Normal || r.type === RoomType.Secret
    );
    if (rooms.length === 0 || types.length === 0) return [];
    const result: Enemy[] = [];
    for (let i = 0; i < count; i += 1) {
      const room = rooms[i % rooms.length];
      const type = types[i % types.length];
      const base = ENEMY_CONFIGS[type];
      const diffMgr  = DifficultyManager.get();
      const diff     = diffMgr.getSettings();

      // Easy mode: normal enemies die in 1 hit, strong enemies in 2 hits.
      // "Strong" = base HP >= 7 (BigZombie 14, IceZombie 8, MaskedOrc 16, BigDemon 22).
      let enemyHp: number;
      if (diffMgr.getDifficulty() === 'easy') {
        const gs     = GameState.get();
        const state  = gs.getData();
        const pDmg   = Math.max(1, Math.round(
          gs.getEffectiveWeaponDamage(state.playerDamage, state.equippedWeapon) * diff.playerDamageMult
        ));
        enemyHp = base.hp >= 7 ? pDmg * 2 : pDmg;
      } else {
        enemyHp = Math.round(base.hp * this.levelData.enemyHPMult * diff.enemyHpMult);
      }

      const config: EnemyConfig = {
        ...base,
        hp: enemyHp,
        speed: base.speed * this.levelData.enemySpdMult * diff.enemySpeedMult,
      };
      const rx = Phaser.Math.Between(room.x + 1, room.x + room.w - 2);
      const ry = Phaser.Math.Between(room.y + 1, room.y + room.h - 2);
      const worldX = rx * TILE_SIZE + TILE_SIZE / 2;
      const worldY = ry * TILE_SIZE + TILE_SIZE / 2;
      const enemy = new Enemy(this, worldX, worldY, config);
      this.add.existing(enemy);
      this.physics.add.existing(enemy);
      enemy.setCollideWorldBounds(true);
      this.enemies.add(enemy);
      result.push(enemy);
    }
    return result;
  }

  private checkBossTrigger(): void {
    // ArenaScene is launched exclusively via handleLevelComplete after the kill threshold is met.
    // Boss room entry is disabled — do nothing here.
  }

  private updateProximityAlert(time: number): void {
    if (!this.assistantChat) return;
    if (time - this.lastProximityCheck < 3000) return;
    this.lastProximityCheck = time;

    let closestDist = Infinity;
    this.enemies.children.iterate((child) => {
      const e = child as Enemy;
      if (!e.active) return true;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < closestDist) closestDist = d;
      return true;
    });

    if (closestDist < 80) {
      this.assistantChat.addAutoAlert('⚠ Enemy very close — watch out!');
    }
  }

  private spawnBoss(): void {
    const posX = this.maze.bossRoom.cx * TILE_SIZE + 8;
    const posY = (this.maze.bossRoom.cy - 2) * TILE_SIZE + 8;
    this.boss = BossFactory.spawnBoss(this, this.levelData.bossType, posX, posY, this.bossGroup);
    this.telemetry.setBossMaxHp(this.boss.maxHP);
    if (this.anims.exists(`${this.boss.config.spriteKey}_idle`)) {
      this.boss.play(`${this.boss.config.spriteKey}_idle`);
    }
    this.bossNameText = this.add
      .text(160, 20, this.boss.config.name, {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: '#ff6666',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.time.delayedCall(3000, () => this.bossNameText?.destroy());
    this.shakeCamera(300, 0.01);
    this.showBossIntroCard();
    this.showBossBar();
    this.activeAudioLayer = 'boss';
    AudioManager.playMusic(this, 'boss_music');
    AudioManager.get().startHeartbeat();
  }

  private showBossBar(): void {
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(20);
  }

  private hideBossBar(): void {
    this.bossBar?.destroy();
  }

  private updateBossBar(): void {
    if (!this.boss || !this.bossBar) return;
    const maxW = 200;
    const hpPct = Phaser.Math.Clamp(this.boss.hp / this.boss.maxHP, 0, 1);
    this.bossBar.clear();
    this.bossBar.fillStyle(0x220000, 0.85);
    this.bossBar.fillRect(60, 12, maxW, 7);
    this.bossBar.lineStyle(1, 0x660000, 1);
    this.bossBar.strokeRect(60, 12, maxW, 7);
    const fillColor = hpPct < 0.4 ? 0xff8800 : 0xff3333;
    this.bossBar.fillStyle(fillColor, 1);
    this.bossBar.fillRect(60, 12, maxW * hpPct, 7);
  }

  private showPhaseText(phase: number): void {
    const text = this.add
      .text(160, 70, `PHASE ${phase}!`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 300,
      yoyo: true,
      hold: 600,
      onComplete: () => text.destroy(),
    });
  }

  private checkStairs(): void {
    if (!this.stairsActive || !this.stairsSprite) return;
    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.stairsSprite.x,
      this.stairsSprite.y
    );
    if (dist <= TILE_SIZE * 1.5) {
      AudioManager.get().playSFX('stairs_descend', 0.9);
      const gsSnapshot = GameState.get().getData();
      SaveSystem.save(gsSnapshot.character, gsSnapshot, GameState.getDiscoveredLoreIds());
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        GameState.get().nextLevel();
        this.scene.start('LevelScene', { level: GameState.get().getData().level });
      });
    }
  }

  private spawnHitParticles(x: number, y: number, color: number): void {
    for (let i = 0; i < 5; i += 1) {
      const particle = this.add.circle(x, y, 2, color, 0.8).setDepth(12);
      const dx = Phaser.Math.Between(-10, 10);
      const dy = Phaser.Math.Between(-10, 10);
      this.tweens.add({
        targets: particle,
        x: x + dx,
        y: y + dy,
        alpha: 0,
        duration: 200,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private spawnDeathParticles(x: number, y: number): void {
    const colors = [0xff4444, 0xffff44, 0x44ff88, 0x44aaff];
    for (let i = 0; i < 10; i += 1) {
      const particle = this.add.circle(x, y, 2, Phaser.Utils.Array.GetRandom(colors), 0.9).setDepth(12);
      const dx = Phaser.Math.Between(-12, 12);
      const dy = Phaser.Math.Between(-12, 12);
      this.tweens.add({
        targets: particle,
        x: x + dx,
        y: y + dy,
        alpha: 0,
        duration: Phaser.Math.Between(380, 500),
        onComplete: () => particle.destroy(),
      });
    }
  }

  private damagePlayer(amount: number, time: number, source: 'melee' | 'projectile' | 'hazard' = 'melee'): void {
    if (this.player.isShieldActive(time)) {
      this.player.shieldActiveUntil = 0;
      this.player.shieldCooldownUntil = time + SHIELD_COOLDOWN_MS;
      this.spawnShieldShatter();
      return;
    }
    if (GameState.get().getData().hasShield) {
      GameState.get().takeDamage(0);
      this.spawnShieldShatter();
      return;
    }
    if (this.player.isInvincible(time)) return;

    GameState.get().takeDamage(amount);
    if (this.telemetryActive) {
      this.telemetry.recordDamage(source, amount);
    }
    this.player.setInvincible(INVINCIBLE_MS, time);
    this.damageLog.push({ amount, time });
    const hpPct = GameState.get().getData().playerHP / GameState.get().getData().playerMaxHP;
    if (hpPct <= 0.3) {
      AudioManager.get().startHeartbeat();
    }
    this.spawnPlayerHitEffects();

    if (GameState.get().isDead()) {
      if (this.retrying) return;
      this.retrying = true;
      this.lives -= 1;
      if (this.lives <= 0) {
        AudioManager.get().stopHeartbeat();
        AudioManager.stopAll(this);
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameOverScene');
        });
      } else {
        this.showRetryOverlay();
      }
    }
  }

  private spawnPlayerHitEffects(): void {
    AudioManager.playSFX(this, 'enemy_hit');
    this.shakeCamera(200, 0.01);
    this.cameras.main.flash(80, 255, 0, 0);
    for (let i = 0; i < 8; i += 1) {
      const particle = this.add.circle(this.player.x, this.player.y, 2, 0xff3333, 0.9).setDepth(12);
      const dx = Phaser.Math.Between(-14, 14);
      const dy = Phaser.Math.Between(-14, 14);
      this.tweens.add({
        targets: particle,
        x: particle.x + dx,
        y: particle.y + dy,
        alpha: 0,
        duration: Phaser.Math.Between(380, 500),
        onComplete: () => particle.destroy(),
      });
    }
  }

  private spawnShieldShatter(): void {
    this.shakeCamera(60, 0.004);
    for (let i = 0; i < 10; i += 1) {
      const particle = this.add.circle(this.player.x, this.player.y, 2, 0x3399ff, 0.9).setDepth(12);
      const dx = Phaser.Math.Between(-12, 12);
      const dy = Phaser.Math.Between(-12, 12);
      this.tweens.add({
        targets: particle,
        x: particle.x + dx,
        y: particle.y + dy,
        alpha: 0,
        duration: 280,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private shakeCamera(duration: number, intensity: number): void {
    if (!this.options.screenShake) return;
    this.cameras.main.shake(duration, intensity);
  }

  private updateCombatMusic(time: number): void {
    if (this.activeAudioLayer === 'boss') return;

    const enemyCount = this.enemies.countActive();
    if (enemyCount > 0) {
      this.enemyQuietStart = 0;
      if (!this.combatMusicActive) {
        this.combatMusicActive = true;
        this.activeAudioLayer = 'combat';
        AudioManager.playMusic(this, 'combat_music');
      }
    } else if (this.combatMusicActive) {
      if (this.enemyQuietStart === 0) {
        this.enemyQuietStart = time;
      } else if (time - this.enemyQuietStart > 5_000) {
        this.combatMusicActive = false;
        this.enemyQuietStart = 0;
        this.activeAudioLayer = 'ambient';
        AudioManager.playMusic(this, 'dungeon_ambient');
        if (GameState.get().getData().playerHP / GameState.get().getData().playerMaxHP > 0.3) {
          AudioManager.get().stopHeartbeat();
        }
      }
    }
  }

  private showRetryOverlay(): void {
    // Restore HP so the player can fight again.
    const gs = GameState.get();
    gs.setHP(gs.getData().playerMaxHP);
    // Stop all audio cleanly — it will reinitialise when the scene restarts.
    AudioManager.get().stopHeartbeat();
    AudioManager.stopAll(this);
    this.combatMusicActive = false;
    this.activeAudioLayer = 'ambient';

    const totalKilled = this.checkpointEnemiesKilled + this.enemiesKilledThisLevel;
    const threshold = this.getKillThreshold();
    const remaining = Math.max(0, threshold - totalKilled);

    this.add.rectangle(160, 90, 230, 80, 0x000000, 0.8).setScrollFactor(0).setDepth(50);

    this.add.text(160, 64, 'YOU DIED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#ff5555',
      stroke: '#0b0f1d',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

    const livesLabel = this.lives === 1 ? '1 LIFE REMAINING' : `${this.lives} LIVES REMAINING`;
    this.add.text(160, 80, livesLabel, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#8ef6ff',
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

    const killsLabel = `KILLS: ${totalKilled} / ${threshold}  (${remaining} TO GO)`;
    this.add.text(160, 94, killsLabel, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ffd76a',
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

    this.add.text(160, 108, 'RESTARTING LEVEL...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#94a3b8',
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({
          level: this.currentLevel,
          lives: this.lives,
          enemiesKilled: this.checkpointEnemiesKilled + this.enemiesKilledThisLevel,
          isRetry: true,
        });
      });
    });
  }

  private getKillThreshold(): number {
    if (this.isGateLevel()) return 0;
    if (this.currentLevel === 1) return 5;
    if (this.currentLevel === 2) return 5;
    if (this.currentLevel === 3) return 7;
    if (this.currentLevel === 4) return 7;
    return 0;
  }

  private checkKillThreshold(): void {
    if (this.levelCompleting) return;
    const threshold = this.getKillThreshold();
    if (threshold <= 0) return;
    const totalKilled = this.checkpointEnemiesKilled + this.enemiesKilledThisLevel;
    if (totalKilled >= threshold) {
      this.handleLevelComplete();
    }
  }

  private handleLevelComplete(): void {
    if (this.levelCompleting) return;
    this.levelCompleting = true;

    AudioManager.playMusic(this, 'none');

    if (this.currentLevel < 4) {
      // NEW: Launch LevelUpScene instead of directly restarting
      this.scene.pause();
      this.scene.launch('LevelUpScene', { level: this.currentLevel, player: this.player });
    } else {
      // Level 4 complete → launch the final boss arena.
      GameState.get().setLives(this.lives);
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('ArenaScene');
      });
    }
  }

  private setupSuspenseMode(): void {
    // Subtle red pulse overlay for Level 4 atmosphere
    const redOverlay = this.add
      .rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0xff0000, 0)
      .setScrollFactor(0)
      .setDepth(15);

    this.time.addEvent({
      delay: 2200,
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: redOverlay,
          alpha: 0.05,
          duration: 300,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // Brief camera shake to signal danger
    this.shakeCamera(180, 0.004);
  }

  private showLevelIntro(): void {
    const cardId = this.getLevelIntroCardId(this.currentLevel);
    if (!cardId) return;
    this.showStoryCardById(cardId);
  }

  private showBossIntroCard(): void {
    const cardId = this.getBossIntroCardId();
    if (!cardId) return;
    this.showStoryCardById(cardId);
  }

  private showBossAftermathCard(): void {
    const cardId = this.getBossAftermathCardId();
    if (!cardId) return;
    this.showStoryCardById(cardId);
  }

  private showStoryCardById(id: StoryCardId): void {
    if (!this.hudOverlay) return;
    const payload = getStoryCard(id);
    if (!payload) return;
    this.hudOverlay.showStoryCard(payload);
  }

  private getLevelIntroCardId(level: number): StoryCardId | null {
    switch (level) {
      case 1:
        return 'level1_threshold';
      case 2:
        return 'level2_hospice';
      case 3:
        return 'level3_forge';
      case 4:
        return 'level4_rift';
      case 5:
        return 'sanctum_home';
      default:
        return null;
    }
  }

  private getBossIntroCardId(): StoryCardId | null {
    switch (this.currentLevel) {
      case 1:
        return 'boss_aldric';
      case 2:
        return 'boss_vael';
      case 3:
        return 'boss_cobb';
      case 4:
        return 'boss_witness';
      case 5:
        return 'boss_elias';
      default:
        return null;
    }
  }

  private getBossAftermathCardId(): StoryCardId | null {
    switch (this.currentLevel) {
      case 1:
        return 'aftermath_aldric';
      case 2:
        return 'aftermath_vael';
      case 3:
        return 'aftermath_cobb';
      case 4:
        return 'aftermath_mael';
      case 5:
        return 'aftermath_watcher';
      default:
        return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AI CO-OP COMPANION METHODS
  // ════════════════════════════════════════════════════════════════════════════

  /** Spawn the AI companion near the player spawn and initialise its groups. */
  private createCompanion(): void {
    const coop = CoopState.get();
    const spawnX = this.maze.playerSpawn.x * TILE_SIZE + 8 + 20;
    const spawnY = this.maze.playerSpawn.y * TILE_SIZE + 8;
    const spriteKey = `${coop.companionSpriteKey}_idle_anim_f0`;
    const resolvedKey = this.textures.exists(spriteKey) ? spriteKey : 'knight_m_idle_anim_f0';

    this.companion = new AICompanion(this, spawnX, spawnY, resolvedKey, coop.companionPersonality, 6);
    this.add.existing(this.companion);
    this.physics.add.existing(this.companion);
    this.companion.initPhysics();

    const animKey = `${coop.companionSpriteKey}_idle`;
    if (this.anims.exists(animKey)) this.companion.play(animKey);

    // Projectile group
    this.companionProjectiles = this.physics.add.group();

    // Callback so companion can fire bullets managed by LevelScene
    this.companion.onShoot = (x, y, vx, vy, damage) => {
      this.fireCompanionProjectile(x, y, vx, vy, damage);
    };

    // Decision loop — call Mistral every 500ms
    this.companionDecisionTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: this.requestCompanionDecision,
      callbackScope: this,
    });
  }

  /** Register companion↔wall and companion-projectile↔enemy collisions. */
  private setupCompanionCollisions(): void {
    if (!this.companion || !this.companionProjectiles) return;

    this.physics.add.collider(this.companion, this.walls);
    this.physics.add.collider(this.companionProjectiles, this.walls, (proj) => {
      (proj as Phaser.Physics.Arcade.Sprite).destroy();
    });
    this.physics.add.overlap(this.companionProjectiles, this.enemies, (proj, enemy) => {
      this.handleCompanionProjectileHit(
        proj as Phaser.Physics.Arcade.Sprite,
        enemy as Enemy
      );
    });
  }

  /** Called each frame when companion is alive. */
  private updateCompanion(time: number): void {
    if (!this.companion) return;

    // Keep companion sprite above fog overlay
    if (this.lighting) {
      const fogDepth = this.lighting.getOverlayDepth();
      if (this.companion.depth <= fogDepth) this.companion.setDepth(fogDepth + 1);
    }

    // Core autonomous tick — always hunts + attacks enemies.
    // Mistral decision refines priority/dash/speak; null when fallback is active.
    this.companion.tick(
      this.companionFallbackActive ? null : this.lastCompanionDecision,
      this.player.x,
      this.player.y,
      this.enemies,
      time
    );

    // Push debug data to registry for F9 overlay
    if (this.companionDebugOverlayOpen) {
      const debugData: CompanionDebugData = {
        personality: CoopState.get().companionPersonality,
        lastMovement: this.lastCompanionDecision?.movement ?? 'fallback',
        lastAttack: this.lastCompanionDecision?.attack ?? false,
        lastDash: this.lastCompanionDecision?.dash ?? false,
        lastProtect: this.lastCompanionDecision?.protect ?? false,
        lastSpeak: this.lastCompanionDecision?.speak ?? null,
        decisionLatencyMs: this.companionDecisionLatencyMs,
        fallbackActive: this.companionFallbackActive,
        companionHp: this.companion ? `${this.companion.hp}/${this.companion.maxHp}` : 'N/A',
        requestCount: this.companionRequestCount,
      };
      this.registry.set('companion_debug', debugData);
    }
  }

  /** POST context to server → apply returned decision (non-blocking). */
  private requestCompanionDecision(): void {
    if (!this.companion || this.companionDecisionPending) return;

    const context = this.buildCompanionContext();
    const personality = CoopState.get().companionPersonality;
    const start = performance.now();
    this.companionDecisionPending = true;
    this.companionRequestCount += 1;

    const serverUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SERVER_URL
      ?? 'http://localhost:8787';

    fetch(`${serverUrl}/api/companion/combat-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, personality }),
      signal: AbortSignal.timeout(3500),
    })
      .then((r) => r.json())
      .then((data: { decision: CompanionDecision }) => {
        this.lastCompanionDecision = data.decision;
        this.companionDecisionLatencyMs = Math.round(performance.now() - start);
        this.companionFallbackActive = false;
        this.showCompanionSpeak(data.decision.speak);
      })
      .catch(() => {
        this.companionFallbackActive = true;
        this.lastCompanionDecision = null;
      })
      .finally(() => {
        this.companionDecisionPending = false;
      });
  }

  /** Build the payload sent to the server each decision cycle. */
  private buildCompanionContext(): object {
    const activeEnemies = (this.enemies.getChildren() as Enemy[])
      .filter((e) => e.active)
      .map((e, i) => ({ id: i, hp: e.hp, x: e.x, y: e.y }));

    const bossState = this.boss?.active
      ? { hp: this.boss.hp, maxHp: this.boss.maxHP, x: this.boss.x, y: this.boss.y }
      : null;

    const treasure = (this.items.getChildren() as Item[])
      .filter((i) => i.active)
      .slice(0, 4)
      .map((i) => ({ x: i.x, y: i.y }));

    const gs = GameState.get().getData();
    const companionHpRatio = this.companion ? this.companion.hp / this.companion.maxHp : 1;

    return {
      player_position: { x: this.player.x, y: this.player.y },
      companion_position: { x: this.companion!.x, y: this.companion!.y },
      enemies: activeEnemies,
      boss_state: bossState,
      player_hp_ratio: gs.playerHP / gs.playerMaxHP,
      companion_hp_ratio: companionHpRatio,
      nearby_treasure: treasure,
      difficulty: this.levelData.level,
    };
  }

  /** Spawn a companion bullet (tinted purple) in the LevelScene physics world. */
  private fireCompanionProjectile(x: number, y: number, vx: number, vy: number, damage: number): void {
    if (!this.companionProjectiles) return;
    const proj = this.physics.add.sprite(x, y, 'player_bullet');
    proj.setTint(0xaa44ff);
    proj.setDepth(10);
    proj.setData('damage', damage);
    this.companionProjectiles.add(proj);
    proj.setVelocity(vx, vy);
    this.time.delayedCall(PROJECTILE_LIFETIME_MS, () => { if (proj.active) proj.destroy(); });
  }

  /** Handle companion projectile hitting an enemy. */
  private handleCompanionProjectileHit(proj: Phaser.Physics.Arcade.Sprite, enemy: Enemy): void {
    if (!proj.active || !enemy.active) return;
    const damage = (proj.getData('damage') as number) ?? 1;
    proj.destroy();
    this.processEnemyDamage(enemy, damage, ItemType.WeaponSword, 40, proj.x, proj.y);
  }

  /** Display a companion speech bubble above the companion sprite. */
  private showCompanionSpeak(speak: string | null): void {
    if (!speak || !this.companion) return;

    this.companionSpeakBubble?.destroy();
    this.companionSpeakBubble = undefined;
    this.companionSpeakTimer?.remove(false);

    const tailHeight = 5;
    const paddingX = 6;
    const paddingY = 4;
    const wrapWidth = 120;

    const text = this.add
      .text(0, 0, speak.toUpperCase(), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#020617',
        align: 'center',
        wordWrap: { width: wrapWidth },
        lineSpacing: 1,
        resolution: 3,
      })
      .setOrigin(0.5, 0.5);

    const bubbleWidth = Math.min(wrapWidth, text.displayWidth) + paddingX * 2;
    const bubbleHeight = text.displayHeight + paddingY * 2;
    const rectX = -bubbleWidth / 2;
    const rectY = -bubbleHeight - tailHeight;

    const bubbleGfx = this.add.graphics();
    bubbleGfx.lineStyle(2, 0x111111, 1);
    bubbleGfx.fillStyle(0xffffff, 1);
    bubbleGfx.fillRoundedRect(rectX, rectY, bubbleWidth, bubbleHeight, 6);
    bubbleGfx.strokeRoundedRect(rectX, rectY, bubbleWidth, bubbleHeight, 6);
    const tailY = rectY + bubbleHeight;
    bubbleGfx.fillTriangle(-8, tailY, 8, tailY, 0, tailY + tailHeight);
    bubbleGfx.strokeTriangle(-8, tailY, 8, tailY, 0, tailY + tailHeight);

    text.setPosition(0, rectY + bubbleHeight / 2);

    const container = this.add.container(this.companion.x, this.companion.y - 42);
    container.setDepth(25);
    container.add([bubbleGfx, text]);
    this.companionSpeakBubble = container;

    this.companionSpeakTimer = this.time.delayedCall(2800, () => {
      this.companionSpeakBubble?.destroy();
      this.companionSpeakBubble = undefined;
    });
  }
}
