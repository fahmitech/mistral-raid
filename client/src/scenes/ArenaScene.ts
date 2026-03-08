import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, DASH_COOLDOWN_MS, DASH_DISTANCE, DASH_INVINCIBLE_MS, INVINCIBLE_MS, TILE_SIZE } from '../config/constants';
import { LightingSystem } from '../systems/LightingSystem';
import { DifficultyManager } from '../systems/DifficultyManager';
import { Player } from '../entities/Player';
import { GameState } from '../core/GameState';
import { CHARACTER_CONFIGS } from '../config/characters';
import { ITEM_CONFIGS } from '../config/items';
import { BOSS_CONFIGS } from '../config/bosses';
import { BossType, ItemType } from '../config/types';
import { BossEntity } from '../entities/BossEntity';
import { AudioManager } from '../systems/AudioManager';
import { CoopState } from '../systems/CoopState';
import { SaveSystem } from '../systems/SaveSystem';
import { wsClient } from '../network/WebSocketClient';
import { micCapture } from '../systems/MicCapture';
import { bossVoicePlayer } from '../systems/BossVoicePlayer';
import { TelemetryTracker } from '../systems/TelemetryTracker';
import { MechanicInterpreter } from '../systems/MechanicInterpreter';
import { ArenaHUD } from '../ui/ArenaHUD';
import { TauntText } from '../ui/TauntText';
import { AnalyzingOverlay } from '../ui/AnalyzingOverlay';
import { DevConsole } from '../ui/DevConsole';
import { DirectorPanel } from '../ui/DirectorPanel';
import type { AIState, ArenaPhase, BossResponse, ServerMessage } from '../types/arena';

interface SimpleProjectile {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  damage: number;
  createdAt: number;
}

export class ArenaScene extends Phaser.Scene {
  private player!: Player;
  private boss!: BossEntity;
  private playerSpriteKey = 'knight_m';
  private bossHp = 100;
  private bossMaxHp = 100;
  private arenaPhase: ArenaPhase = 'INTRO';
  private aiState: AIState = 'listening';
  private options = SaveSystem.loadOptions();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastShotAt = 0;
  private lastFootstepAt = 0;
  private phaseStartTime = 0;

  private playerProjectiles: SimpleProjectile[] = [];
  private bossProjectiles: SimpleProjectile[] = [];

  private telemetry = new TelemetryTracker();
  private mechanicInterpreter!: MechanicInterpreter;
  private hud!: ArenaHUD;
  private tauntText!: TauntText;
  private analyzingOverlay!: AnalyzingOverlay;
  private devConsole!: DevConsole;
  private directorPanel!: DirectorPanel;
  private telemetryTimer: Phaser.Time.TimerEvent | null = null;
  private liveTelemetryTimer: Phaser.Time.TimerEvent | null = null;
  private introTauntTimer: Phaser.Time.TimerEvent | null = null;
  private introTauntSent = false;
  private introAudioPlayed = false;
  private ttsFallbackTimer: Phaser.Time.TimerEvent | null = null;
  private waitingForTTS = false;
  private micRetryHandler: (() => void) | null = null;
  private pttActive = false;
  private pttKeyDownHandler: (() => void) | null = null;
  private pttKeyUpHandler: (() => void) | null = null;
  private micIndicator!: Phaser.GameObjects.Text;
  private micIndicatorBg!: Phaser.GameObjects.Rectangle;
  private micError = false;
  private transcriptText!: Phaser.GameObjects.Text;
  private transcriptBg!: Phaser.GameObjects.Rectangle;
  private transcriptTimer: Phaser.Time.TimerEvent | null = null;
  private wsDebugText!: Phaser.GameObjects.Text;
  private wsDebugBg!: Phaser.GameObjects.Rectangle;
  private audioUnlockHandler: (() => void) | null = null;
  private toggleHandler: ((event: KeyboardEvent) => void) | null = null;
  private lastDamageSource: 'melee' | 'projectile' | 'hazard' | undefined;

  private wsUnsub: (() => void) | null = null;
  private wsStatusUnsub: (() => void) | null = null;

  private lives = 3;
  private livesText?: Phaser.GameObjects.Text;
  private arenaDefeated = false;

  private lighting!: LightingSystem;
  private arenaEmbers: { sprite: Phaser.GameObjects.Ellipse; speed: number; drift: number }[] = [];

  private bossGlow!: Phaser.GameObjects.Arc;
  private bossThinkingText!: Phaser.GameObjects.Text;
  private bossThinkingPulseTween: Phaser.Tweens.Tween | null = null;
  private shieldGlow!: Phaser.GameObjects.Arc;
  private lastBossAiAt = 0;

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    CoopState.reset(); // Arena Demo is always solo — no AI companion
    this.buildArenaEnvironment();
    // Combat zone: between wall rows (y 32-160) and wall cols (x 16-304)
    this.physics.world.setBounds(TILE_SIZE, TILE_SIZE * 2, INTERNAL_WIDTH - TILE_SIZE * 2, TILE_SIZE * 8);
    this.cameras.main.setBounds(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
    this.setupAudio();

    // Lighting — player spotlight with 4 torches (2 top, 2 bottom)
    this.lighting = new LightingSystem(this, 0.68);
    const TILE_ROWS = Math.ceil(INTERNAL_HEIGHT / TILE_SIZE);
    this.lighting.setTorches([
      { x: 2 * TILE_SIZE + 8, y: TILE_SIZE + 4 },          // top-left
      { x: 17 * TILE_SIZE + 8, y: TILE_SIZE + 4 },         // top-right
      { x: 2 * TILE_SIZE + 8, y: (TILE_ROWS - 2) * TILE_SIZE + 4 },     // bottom-left
      { x: 17 * TILE_SIZE + 8, y: (TILE_ROWS - 2) * TILE_SIZE + 4 },    // bottom-right
    ]);

    const gs = GameState.get();
    const state = gs.getData();
    gs.setHP(state.playerMaxHP);
    this.lives = gs.getLives();
    this.arenaDefeated = false;
    const charConfig = CHARACTER_CONFIGS[state.character];
    this.playerSpriteKey = charConfig.spriteKey;
    const weaponType = state.equippedWeapon;
    const weaponItem = ITEM_CONFIGS[weaponType];
    const weaponConfig = gs.getWeaponConfig(weaponType);

    const playerIdleKey = `${this.playerSpriteKey}_idle_anim_f0`;
    const playerTexture = this.textures.exists(playerIdleKey) ? playerIdleKey : this.playerSpriteKey;
    this.player = new Player(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 40, playerTexture, weaponItem, weaponConfig);
    this.add.existing(this.player);
    this.physics.add.existing(this.player);
    this.player.initPhysics();
    if (this.anims.exists(`${this.playerSpriteKey}_idle`)) {
      this.player.play(`${this.playerSpriteKey}_idle`);
    }

    const bossConfig = BOSS_CONFIGS[BossType.BigDemon];
    this.boss = new BossEntity(this, INTERNAL_WIDTH / 2, 40, bossConfig);
    this.add.existing(this.boss);
    this.physics.add.existing(this.boss);
    this.boss.setCollideWorldBounds(true);
    const bossIdleKey = `${bossConfig.spriteKey}_idle_anim_f0`;
    if (this.textures.exists(bossIdleKey)) {
      this.boss.setTexture(bossIdleKey);
    }
    if (this.anims.exists(`${bossConfig.spriteKey}_idle`)) {
      this.boss.play(`${bossConfig.spriteKey}_idle`);
    }
    // Apply difficulty scaling to boss HP — applied once at spawn time
    const diffSettings = DifficultyManager.get().getSettings();
    this.bossHp = Math.round(bossConfig.hp * diffSettings.bossHpMult);
    this.bossMaxHp = this.bossHp;

    // ── Cinematic boss intro ──────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.boss.setAlpha(0);
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: this.boss,
        alpha: 1,
        duration: 700,
        ease: 'Power2.easeIn',
        onComplete: () => {
          this.cameras.main.shake(220, 0.007);
        },
      });
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
      T: this.input.keyboard!.addKey('T'),
      I: this.input.keyboard!.addKey('I'),
      R: this.input.keyboard!.addKey('R'),
      SPACE: this.input.keyboard!.addKey('SPACE'),
      SHIFT: this.input.keyboard!.addKey('SHIFT'),
      F2: this.input.keyboard!.addKey('F2'),
      F5: this.input.keyboard!.addKey('F5'),
      ESC: this.input.keyboard!.addKey('ESC'),
    };

    this.hud = new ArenaHUD(this);
    this.tauntText = new TauntText(this);
    this.analyzingOverlay = new AnalyzingOverlay(this);

    // Boss red atmosphere glow (pulsing, ADD blend, depth below lighting)
    this.bossGlow = this.add
      .arc(this.boss.x, this.boss.y, 26, 0, 360, false, 0xcc1122, 0)
      .setDepth(5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.bossGlow,
      alpha: 0.18,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Shield glow around player (only visible when shield active)
    this.shieldGlow = this.add
      .arc(this.player.x, this.player.y, 12, 0, 360, false, 0x33aaff, 0)
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.createBossThinkingIndicator();
    this.livesText = this.add.text(INTERNAL_WIDTH - 4, 4, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffdd44',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(22);
    this.createMicIndicator();
    this.createTranscriptOverlay();
    this.createWsDebugOverlay();

    this.devConsole = new DevConsole('app');
    this.directorPanel = new DirectorPanel('app');

    this.mechanicInterpreter = new MechanicInterpreter({
      scene: this,
      player: this.player,
      boss: this.boss,
      onDamage: (amount, source) => this.damagePlayer(amount, source),
      onOrbDestroyed: () => this.telemetry.recordOrbDestroyed(),
      onMinionKilled: () => {},
    });

    this.setupNetworking();
    this.startMicCapture();

    this.startPhase1();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.toggleHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      this.directorPanel.toggle();
    };
    this.input.keyboard?.on('keydown-P', this.toggleHandler);

    this.pttKeyDownHandler = () => this.startPushToTalk();
    this.pttKeyUpHandler = () => this.stopPushToTalk();
    this.input.keyboard?.on('keydown-T', this.pttKeyDownHandler);
    this.input.keyboard?.on('keyup-T', this.pttKeyUpHandler);
  }

  private setupAudio(): void {
    const audio = AudioManager.get();
    audio.setOptions(this.options);
    audio.init(this);

    const unlockAndPlay = () => {
      audio.unlockAudio();
      this.playArenaIntroAudio();
    };

    if (!audio.isUnlocked() && !this.sound.locked) {
      unlockAndPlay();
      return;
    }

    if (audio.isUnlocked()) {
      this.playArenaIntroAudio();
      return;
    }

    this.audioUnlockHandler = () => {
      unlockAndPlay();
      this.audioUnlockHandler = null;
    };
    this.input.once('pointerdown', this.audioUnlockHandler);
    this.input.keyboard?.once('keydown', this.audioUnlockHandler);
  }

  private playArenaIntroAudio(): void {
    if (this.introAudioPlayed) return;
    this.introAudioPlayed = true;
    AudioManager.stopMusic(this);
    AudioManager.get().playSFX('suspense_build', 0.8);
    AudioManager.get().playSFX('low_rumble', 0.6);
    AudioManager.get().playSFX('boss_intro', 0.75);
    AudioManager.get().playMusic('boss');
  }

  private createMicIndicator(): void {
    const y = INTERNAL_HEIGHT - 22;
    this.micIndicatorBg = this.add.rectangle(70, y + 2, 130, 18, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(21);
    this.micIndicator = this.add.text(8, y - 4, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ff6677',
    }).setScrollFactor(0).setDepth(22);
    this.updateMicIndicator();
  }

  private createTranscriptOverlay(): void {
    const y = INTERNAL_HEIGHT - 50;
    this.transcriptBg = this.add.rectangle(INTERNAL_WIDTH / 2, y, INTERNAL_WIDTH - 12, 22, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    this.transcriptText = this.add.text(INTERNAL_WIDTH / 2, y - 8, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#cceeff',
      align: 'center',
      wordWrap: { width: INTERNAL_WIDTH - 20 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(22).setVisible(false);
  }

  private createWsDebugOverlay(): void {
    this.wsDebugBg = this.add.rectangle(70, 16, 130, 18, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(21);
    this.wsDebugText = this.add.text(8, 8, 'WS: --', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#99aadd',
    }).setScrollFactor(0).setDepth(22);
  }

  private updateWsDebug(label: string): void {
    this.wsDebugText.setText(`WS: ${label}`);
  }

  private showTranscript(text: string, isFinal: boolean): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.transcriptBg.setVisible(true);
    this.transcriptText.setVisible(true);
    this.transcriptText.setText(`YOU: ${trimmed}`);
    this.transcriptText.setColor(isFinal ? '#a6ffdd' : '#cceeff');

    this.transcriptTimer?.remove(false);
    if (isFinal) {
      this.transcriptTimer = this.time.delayedCall(3200, () => {
        this.transcriptBg.setVisible(false);
        this.transcriptText.setVisible(false);
        this.transcriptText.setText('');
      });
    }
  }

  private buildArenaEnvironment(): void {
    const TILE_COLS = Math.ceil(INTERNAL_WIDTH  / TILE_SIZE); // 20
    const TILE_ROWS = Math.ceil(INTERNAL_HEIGHT / TILE_SIZE); // 12

    // ── Resolve tile keys with fallbacks ──────────────────────────────────
    const floorKeys = ['floor_1', 'floor_2', 'floor_3', 'floor_4', 'floor_5', 'floor_6', 'floor_7', 'floor_8'];
    const stainKeys = ['floor_stain_1', 'floor_stain_2'];
    const wallKey     = this.textures.exists('wall_mid')                 ? 'wall_mid'                 : 'floor_1';
    const wallTopKey  = this.textures.exists('wall_top_mid')             ? 'wall_top_mid'             : wallKey;
    const cornerTLKey = this.textures.exists('wall_corner_top_left')     ? 'wall_corner_top_left'     : wallTopKey;
    const cornerTRKey = this.textures.exists('wall_corner_top_right')    ? 'wall_corner_top_right'    : wallTopKey;
    const cornerBLKey = this.textures.exists('wall_corner_front_left')   ? 'wall_corner_front_left'   : wallKey;
    const cornerBRKey = this.textures.exists('wall_corner_front_right')  ? 'wall_corner_front_right'  : wallKey;

    // ── Full grid coverage using individual images (no RenderTexture) ─────
    // Every cell is drawn as a plain add.image — 100% reliable, no RT batching issues.
    for (let row = 0; row < TILE_ROWS; row++) {
      for (let col = 0; col < TILE_COLS; col++) {
        const px = col * TILE_SIZE;
        const py = row * TILE_SIZE;

        const isTopHeader  = row === 0;
        const isTopWall    = row === 1;
        const isBottomWall = row >= TILE_ROWS - 2;
        const isLeftWall   = col === 0;
        const isRightWall  = col === TILE_COLS - 1;

        let key: string;
        if (isTopHeader) {
          if      (isLeftWall)  key = cornerTLKey;
          else if (isRightWall) key = cornerTRKey;
          else                  key = wallTopKey;
        } else if (isBottomWall) {
          if      (isLeftWall)  key = cornerBLKey;
          else if (isRightWall) key = cornerBRKey;
          else                  key = wallKey;
        } else if (isLeftWall || isRightWall || isTopWall) {
          key = wallKey;
        } else {
          // Interior floor — varied tiles with occasional stains
          if (Math.random() < 0.06) {
            const sk = stainKeys[Math.floor(Math.random() * stainKeys.length)];
            key = this.textures.exists(sk) ? sk : 'floor_1';
          } else {
            const fk = floorKeys[Math.floor(Math.random() * floorKeys.length)];
            key = this.textures.exists(fk) ? fk : 'floor_1';
          }
        }

        this.add.image(px, py, key).setOrigin(0, 0).setDepth(0);
      }
    }

    // ── Banners (2 on top wall) ────────────────────────────────────────────
    const bannerKeys = ['wall_banner_red', 'wall_banner_blue', 'wall_banner_green', 'wall_banner_yellow'];
    const bannerKey  = bannerKeys.find((k) => this.textures.exists(k));
    const bannerCols = [5, 14];
    if (bannerKey) {
      bannerCols.forEach((col) =>
        this.add.image(col * TILE_SIZE, TILE_SIZE, bannerKey).setOrigin(0, 0).setDepth(1)
      );
    } else {
      const bannerGfx = this.add.graphics().setDepth(1);
      bannerCols.forEach((col) => {
        bannerGfx.fillStyle(0x991111, 0.85);
        bannerGfx.fillRect(col * TILE_SIZE + 3, TILE_SIZE + 2, 10, 13);
      });
    }

    // ── Crates near 4 corners of the arena interior ───────────────────────
    const crateKeys = ['chest_empty_open_anim_f0', 'chest_empty', 'chest_full', 'chest_full_open_anim_f0'];
    const crateKey  = crateKeys.find((k) => this.textures.exists(k));
    const cratePositions: [number, number][] = [
      [2, 2], [TILE_COLS - 3, 2], [2, TILE_ROWS - 3], [TILE_COLS - 3, TILE_ROWS - 3],
    ];
    cratePositions.forEach(([col, row]) => {
      const cx = col * TILE_SIZE + 8;
      const cy = row * TILE_SIZE + 8;
      if (crateKey) {
        this.add.sprite(cx, cy, crateKey).setDepth(2);
      } else {
        const cg = this.add.graphics().setDepth(2);
        cg.fillStyle(0x554433, 1);
        cg.fillRect(cx - 6, cy - 6, 12, 12);
        cg.lineStyle(1, 0x776655, 1);
        cg.strokeRect(cx - 6, cy - 6, 12, 12);
      }
    });

    // ── 4 torches — 2 on top wall, 2 on bottom wall ───────────────────────
    const torchPositions = [
      { x: 2  * TILE_SIZE + 8, y: TILE_SIZE + 4                     }, // top-left
      { x: 17 * TILE_SIZE + 8, y: TILE_SIZE + 4                     }, // top-right
      { x: 2  * TILE_SIZE + 8, y: (TILE_ROWS - 2) * TILE_SIZE + 4   }, // bottom-left
      { x: 17 * TILE_SIZE + 8, y: (TILE_ROWS - 2) * TILE_SIZE + 4   }, // bottom-right
    ];
    torchPositions.forEach(({ x, y }) => {
      const torch = this.add.sprite(x, y, 'torch_1').setDepth(2);
      if (this.anims.exists('torch')) torch.play('torch');
    });

    // ── Ambient embers — 6 per torch ──────────────────────────────────────
    this.arenaEmbers = [];
    torchPositions.forEach(({ x, y }) => {
      for (let i = 0; i < 6; i++) {
        const size  = Phaser.Math.FloatBetween(1, 2);
        const color = Math.random() > 0.5 ? 0xff6633 : 0xff3300;
        const sprite = this.add
          .ellipse(
            x + Phaser.Math.Between(-8, 8),
            y + Phaser.Math.Between(-4, 10),
            size, size, color, Phaser.Math.FloatBetween(0.1, 0.4),
          )
          .setDepth(3);
        this.arenaEmbers.push({ sprite, speed: Phaser.Math.FloatBetween(0.1, 0.35), drift: Phaser.Math.FloatBetween(0.1, 0.4) });
      }
    });

    // ── Vignette — dark edges, keeps focus on interior ────────────────────
    const vfx = this.add.graphics().setDepth(4);
    vfx.fillStyle(0x000000, 0.45);
    vfx.fillRect(0, 0, INTERNAL_WIDTH, TILE_SIZE * 2);
    vfx.fillRect(0, INTERNAL_HEIGHT - TILE_SIZE * 2, INTERNAL_WIDTH, TILE_SIZE * 2);
    vfx.fillRect(0, 0, TILE_SIZE, INTERNAL_HEIGHT);
    vfx.fillRect(INTERNAL_WIDTH - TILE_SIZE, 0, TILE_SIZE, INTERNAL_HEIGHT);
  }

  private updateMicIndicator(): void {
    let label = 'MIC: OFF';
    let color = '#ff6677';
    if (this.micError) {
      label = 'MIC: BLOCKED';
      color = '#ffaa55';
    } else if (this.pttActive) {
      label = 'MIC: LISTENING';
      color = '#66ffcc';
    }
    this.micIndicator.setText(label);
    this.micIndicator.setColor(color);
  }

  private createBossThinkingIndicator(): void {
    this.bossThinkingText = this.add.text(this.boss.x, this.boss.y - 20, '...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffee88',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(19).setVisible(false);

    this.bossThinkingPulseTween = this.tweens.add({
      targets: this.bossThinkingText,
      alpha: { from: 0.35, to: 1 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      paused: true,
    });
  }

  private syncBossThinkingIndicator(): void {
    const shouldShow = this.aiState === 'thinking';

    if (shouldShow !== this.bossThinkingText.visible) {
      this.bossThinkingText.setVisible(shouldShow);
      if (shouldShow) {
        this.bossThinkingPulseTween?.play();
      } else {
        this.bossThinkingPulseTween?.pause();
        this.bossThinkingText.setAlpha(1);
      }
    }

    if (shouldShow) {
      const bossTopY = this.boss.y - this.boss.displayHeight * 0.55;
      this.bossThinkingText.setPosition(this.boss.x, bossTopY);
    }
  }

  update(time: number, delta: number): void {
    this.lighting.update(this.player.x, this.player.y);

    // Boss red glow tracks boss position
    this.bossGlow.setPosition(this.boss.x, this.boss.y);
    this.syncBossThinkingIndicator();

    // Shield glow — visible only while shield is active
    const shieldOn = this.player.isShieldActive(time) || GameState.get().getData().hasShield;
    this.shieldGlow.setPosition(this.player.x, this.player.y);
    this.shieldGlow.setAlpha(shieldOn ? 0.45 : 0);

    // Drift embers upward
    this.arenaEmbers.forEach((p) => {
      p.sprite.y -= p.speed;
      p.sprite.x += Math.sin(p.sprite.y * 0.04) * p.drift;
      if (p.sprite.y < -4) {
        p.sprite.y = INTERNAL_HEIGHT + 4;
        p.sprite.x = Phaser.Math.Between(0, INTERNAL_WIDTH);
      }
    });

    this.handleInput(time);
    this.player.updateBlink(time);
    this.player.updateWeaponPosition();

    if (this.arenaPhase === 'PHASE_1') {
      this.updateBossAI(time);
      if (time - this.phaseStartTime > 30000 || this.bossHp <= this.bossMaxHp * 0.6) {
        this.beginTransition(time - this.phaseStartTime > 30000);
      }
    }

    if (this.arenaPhase === 'PHASE_2') {
      this.updateBossAI(time);
      this.mechanicInterpreter.update(time, delta);
    }

    this.updateProjectiles(time, delta);
    this.telemetry.update(this.player, this.boss, delta);

    this.hud.update(
      GameState.get().getData().playerHP,
      GameState.get().getData().playerMaxHP,
      this.bossHp,
      this.bossMaxHp,
      this.arenaPhase,
      this.aiState
    );

    if (this.keys.F2 && Phaser.Input.Keyboard.JustDown(this.keys.F2)) {
      this.devConsole.toggle();
    }
    if (GameState.get().isDead() && this.arenaPhase !== 'DEFEAT' && !this.arenaDefeated) {
      this.arenaPhase = 'DEFEAT';
      this.arenaDefeated = true;
      this.lives -= 1;
      GameState.get().setLives(this.lives);
      if (this.lives <= 0) {
        AudioManager.get().stopHeartbeat();
        AudioManager.stopAll(this);
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameOverScene');
        });
      } else {
        this.showArenaRetryOverlay();
      }
    }

    if (this.bossHp <= 0 && this.arenaPhase !== 'VICTORY') {
      this.arenaPhase = 'VICTORY';
      this.scene.start('VictoryScene');
    }
  }

  private setupNetworking(): void {
    const url = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:8787';
    wsClient.connect(url);

    this.wsUnsub = wsClient.onMessage((msg) => this.handleServerMessage(msg));
    this.wsStatusUnsub = wsClient.onStatus((connected) => {
      this.devConsole.setConnection(connected);
      if (connected) this.scheduleIntroTaunt();
    });

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

  private startMicCapture(): void {
    micCapture.onError((err) => {
      this.devConsole.setError(`Microphone unavailable: ${err.message}`);
      this.micError = true;
      this.updateMicIndicator();
      this.scheduleMicRetry();
    });

    micCapture.onSpeechStart(() => {
      this.cancelTtsFallback();
      if (this.aiState === 'speaking') {
        bossVoicePlayer.stop();
        wsClient.send({ type: 'barge_in', payload: {} });
      }
    });

    // Start VAD now (transmit gated by PTT).
    micCapture.setTransmitEnabled(false);
    void micCapture.start();
  }

  private startPushToTalk(): void {
    if (this.pttActive) return;
    this.pttActive = true;
    this.micError = false;
    this.updateMicIndicator();
    if (!micCapture.isActive) {
      void micCapture.start();
    }
    if (wsClient.isConnected) {
      wsClient.send({ type: 'vad_state', payload: { speaking: true } });
    }
    micCapture.setTransmitEnabled(true);
  }

  private stopPushToTalk(): void {
    if (!this.pttActive) return;
    this.pttActive = false;
    this.updateMicIndicator();
    micCapture.setTransmitEnabled(false);
    if (wsClient.isConnected) {
      wsClient.send({ type: 'vad_state', payload: { speaking: false } });
    }
  }

  private scheduleMicRetry(): void {
    if (micCapture.isActive) return;
    if (this.micRetryHandler) return;

    this.micRetryHandler = () => {
      this.micRetryHandler = null;
      this.devConsole.setError(null);
      this.micError = false;
      this.updateMicIndicator();
      void micCapture.start();
      micCapture.setTransmitEnabled(this.pttActive);
    };
    this.input.once('pointerdown', this.micRetryHandler);
    this.input.keyboard?.once('keydown', this.micRetryHandler);
  }

  private scheduleTtsFallback(): void {
    this.cancelTtsFallback();
    this.waitingForTTS = true;
    this.ttsFallbackTimer = this.time.delayedCall(2600, () => {
      this.ttsFallbackTimer = null;
      if (!this.waitingForTTS) return;
      this.waitingForTTS = false;
      if (bossVoicePlayer.isPlaying) return;
      AudioManager.get().playSFX('boss_intro', 0.6);
      this.devConsole.setTTSStatus('fallback_sfx');
    });
  }

  private cancelTtsFallback(): void {
    this.waitingForTTS = false;
    this.ttsFallbackTimer?.remove(false);
    this.ttsFallbackTimer = null;
  }

  private scheduleIntroTaunt(): void {
    if (this.introTauntSent) return;
    if (this.arenaPhase !== 'PHASE_1') return;
    if (!wsClient.isConnected) return;
    if (this.introTauntTimer) return;

    this.introTauntTimer = this.time.delayedCall(800, () => {
      this.introTauntTimer = null;
      this.sendIntroTaunt();
    });
  }

  private sendIntroTaunt(): void {
    if (this.introTauntSent) return;
    if (this.arenaPhase !== 'PHASE_1') return;
    if (!wsClient.isConnected) return;
    this.introTauntSent = true;

    const payload = {
      ...this.telemetry.compile('player-1'),
      player_said: 'I have entered your arena. Show me what you are.',
    };
    wsClient.send({ type: 'ANALYZE', payload });
    this.devConsole.setTTSStatus('waiting');
  }

  private startPhase1(): void {
    this.arenaPhase = 'PHASE_1';
    this.phaseStartTime = this.time.now;
    this.telemetry.startPhase(this.bossMaxHp);
    this.scheduleIntroTaunt();
  }

  private beginTransition(forcedByTimeout: boolean): void {
    if (this.arenaPhase !== 'PHASE_1') return;
    this.arenaPhase = 'TRANSITIONING';
    this.boss.setVelocity(0, 0);
    this.analyzingOverlay.show();
    this.tauntText.clear();

    this.telemetry.setPlayerHpAtTransition(GameState.get().getData().playerHP);
    this.telemetry.setPhaseForcedByTimeout(forcedByTimeout);

    const payload = this.telemetry.compile('player-1');
    wsClient.send({ type: 'ANALYZE', payload });
    this.devConsole.setTTSStatus('waiting');
  }

  private handleServerMessage(msg: ServerMessage): void {
    this.updateWsDebug(msg.type);
    switch (msg.type) {
      case 'ai_state':
        this.aiState = msg.payload.state;
        this.devConsole.setAIState(this.aiState);
        this.syncBossThinkingIndicator();
        if (this.aiState === 'thinking') {
          this.analyzingOverlay.show();
        } else {
          this.analyzingOverlay.hide();
        }
        break;
      case 'captions_partial':
        this.devConsole.setSTTPartial(msg.payload.text);
        this.showTranscript(msg.payload.text, false);
        break;
      case 'captions_final':
        this.devConsole.setSTTFinal(msg.payload.text);
        this.showTranscript(msg.payload.text, true);
        break;
      case 'BOSS_RESPONSE':
        this.handleBossResponse(msg.payload);
        break;
      case 'AUDIO_READY':
        this.cancelTtsFallback();
        this.devConsole.setTTSStatus('playing');
        bossVoicePlayer.play(msg.payload.audioBase64, msg.payload.format);
        break;
      case 'AUDIO_CHUNK':
        this.cancelTtsFallback();
        this.devConsole.setTTSStatus('streaming');
        bossVoicePlayer.streamChunk(msg.payload.audioBase64, msg.payload.format);
        break;
      case 'AUDIO_DONE':
        bossVoicePlayer.endStream();
        this.devConsole.setTTSStatus('idle');
        break;
      case 'director_update':
        this.directorPanel.update(msg.payload);
        break;
      case 'BOSS_DIRECTIVE':
        this.boss.applyDirective(msg.payload, this.time.now);
        break;
      case 'error':
        this.devConsole.setError(msg.payload.message);
        this.handleBossResponse(msg.payload.fallback);
        break;
      default:
        break;
    }
  }

  private handleBossResponse(response: BossResponse): void {
    this.devConsole.setBossResponse(response);
    this.tauntText.show(response.taunt);
    this.analyzingOverlay.hide();
    this.devConsole.setTTSStatus('waiting');
    this.scheduleTtsFallback();
    if (this.arenaPhase === 'TRANSITIONING') {
      this.arenaPhase = 'PHASE_2';
    }
    this.mechanicInterpreter.applyMechanics(response.mechanics);
  }

  private sendTelemetry(): void {
    if (!wsClient.isConnected) return;
    const playerData = GameState.get().getData();
    const raw = this.telemetry.getRawTelemetry(playerData.playerHP, playerData.playerMaxHP, this.bossHp);
    wsClient.send({ type: 'telemetry', payload: raw });
  }

  private sendLiveTelemetry(): void {
    if (!wsClient.isConnected) return;
    if (this.arenaPhase !== 'PHASE_1' && this.arenaPhase !== 'PHASE_2') return;

    const playerData = GameState.get().getData();
    const zone = this.telemetry.getCurrentZone(this.player.x, this.player.y);
    const corners = new Set(['top_left', 'top_right', 'bot_left', 'bot_right']);

    wsClient.send({
      type: 'LIVE_TELEMETRY',
      payload: {
        context: 'arena',
        player_hp_pct: playerData.playerMaxHP > 0 ? playerData.playerHP / playerData.playerMaxHP : 0,
        boss_hp_pct: this.bossMaxHp > 0 ? this.bossHp / this.bossMaxHp : 0,
        player_zone: zone,
        recent_dodge_bias: this.telemetry.getRecentDodgeBias(),
        recent_accuracy: this.telemetry.getRecentAccuracy(10),
        avg_distance_from_boss: Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y),
        in_corner: corners.has(zone),
        elapsed_ms: Math.max(0, this.time.now - this.phaseStartTime),
        last_damage_source: this.lastDamageSource,
      },
    });
  }

  private handleInput(time: number): void {
    if (!this.player.body) return;

    const move = new Phaser.Math.Vector2(0, 0);
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
    const aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    this.player.setAimAngle(aimAngle);

    const fireRate = gs.getEffectiveFireRate(state.playerFireRate, state.equippedWeapon);
    if (pointer.isDown && time - this.lastShotAt >= fireRate) {
      this.lastShotAt = time;
      this.shootProjectile(aimAngle);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryDash(time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.start('MenuScene');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) {
      this.scene.pause();
      this.scene.launch('InventoryScene');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.usePotion();
    }
  }

  private shootProjectile(angle: number): void {
    const gs = GameState.get();
    const state = gs.getData();
    const baseDamage = gs.getEffectiveWeaponDamage(state.playerDamage, state.equippedWeapon);
    const damage = baseDamage * DifficultyManager.get().getSettings().playerDamageMult;

    const speed = 220;
    const proj = this.add.circle(this.player.x, this.player.y, 2.5, 0xffffff, 1);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.playerProjectiles.push({ obj: proj, vx, vy, damage, createdAt: this.time.now });

    this.telemetry.recordShotFired();
    AudioManager.playSFX(this, 'sword_attack');
  }

  private updateBossAI(time: number): void {
    // Throttle boss AI updates for Easy difficulty (slows attack frequency)
    const throttle = DifficultyManager.get().getSettings().bossAiThrottleMs;
    if (throttle > 0 && time - this.lastBossAiAt < throttle) return;
    this.lastBossAiAt = time;

    const diff = DifficultyManager.get().getSettings();
    const actions = {
      shootProjectile: (x: number, y: number, vx: number, vy: number, damage: number, color: number) => {
        const angle = Math.atan2(vy, vx);
        const proj = this.add.circle(x, y, 3, color ?? 0xff2266, 1);
        const speed = 140;
        this.bossProjectiles.push({
          obj: proj,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          damage: (damage ?? 2) * diff.bossDamageMult,
          createdAt: this.time.now,
        });
      },
      spawnEnemy: () => {},
      shake: () => {},
    };
    this.boss.updateAI(this.player, time, actions);
  }

  private updateProjectiles(time: number, delta: number): void {
    const dt = delta / 1000;
    this.playerProjectiles.forEach((proj) => {
      proj.obj.x += proj.vx * dt;
      proj.obj.y += proj.vy * dt;
      const dist = Phaser.Math.Distance.Between(proj.obj.x, proj.obj.y, this.boss.x, this.boss.y);
      if (dist < 14) {
        const result = this.boss.applyDamage(proj.damage);
        this.bossHp = this.boss.hp;
        proj.obj.destroy();
        this.telemetry.recordShotHit();
        if (result.died) {
          this.bossHp = 0;
        }
      }
      if (time - proj.createdAt > 1600) proj.obj.destroy();
    });

    this.bossProjectiles.forEach((proj) => {
      proj.obj.x += proj.vx * dt;
      proj.obj.y += proj.vy * dt;
      const dist = Phaser.Math.Distance.Between(proj.obj.x, proj.obj.y, this.player.x, this.player.y);
      if (dist < 10) {
        this.damagePlayer(proj.damage, 'projectile');
        proj.obj.destroy();
      }
      if (time - proj.createdAt > 1800) proj.obj.destroy();
    });

    this.playerProjectiles = this.playerProjectiles.filter((proj) => proj.obj.active);
    this.bossProjectiles = this.bossProjectiles.filter((proj) => proj.obj.active);
  }

  private tryDash(time: number): void {
    if (time < this.player.dashCooldownUntil) return;
    if (this.player.invincibleUntil - time > 60) return;

    const dir = this.player.lastDir.clone();
    if (dir.lengthSq() === 0) dir.set(1, 0);
    const newX = Phaser.Math.Clamp(this.player.x + dir.x * DASH_DISTANCE, 10, INTERNAL_WIDTH - 10);
    const newY = Phaser.Math.Clamp(this.player.y + dir.y * DASH_DISTANCE, 10, INTERNAL_HEIGHT - 10);
    this.spawnDashTrail(this.player.x, this.player.y, newX, newY);
    this.player.setPosition(newX, newY);
    this.player.dashCooldownUntil = time + DASH_COOLDOWN_MS;
    this.player.setInvincible(DASH_INVINCIBLE_MS, time);
    AudioManager.playSFX(this, 'dash');
    this.telemetry.recordDash(dir);
  }

  private spawnDashTrail(x1: number, y1: number, x2: number, y2: number): void {
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      const ghost = this.add.circle(x, y, 3, 0x00ffe1, 0.5).setDepth(9);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: Phaser.Math.Between(160, 260),
        onComplete: () => ghost.destroy(),
      });
    }
  }

  private damagePlayer(amount: number, source: 'projectile' | 'hazard' | 'melee'): void {
    const now = this.time.now;
    if (this.player.isInvincible(now)) return;

    // Shield blocks ALL incoming damage for its full duration
    if (this.player.isShieldActive(now) || GameState.get().getData().hasShield) {
      this.spawnShieldBlockEffect();
      return;
    }

    this.lastDamageSource = source;
    GameState.get().takeDamage(amount);
    this.player.setInvincible(INVINCIBLE_MS, now);
    this.telemetry.recordDamage(source, amount);
    AudioManager.playSFX(this, 'enemy_hit');
    if (this.options.screenShake) {
      this.cameras.main.shake(80, 0.004);
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
    const label = this.add.text(this.player.x, this.player.y - 10, '+HP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#33ff66',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: label,
      y: label.y - 14,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });
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

  /** Visual burst when shield absorbs a hit. */
  private spawnShieldBlockEffect(): void {
    const ring = this.add
      .arc(this.player.x, this.player.y, 8, 0, 360, false, 0x44aaff, 0.9)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 320,
      ease: 'Power2.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private showArenaRetryOverlay(): void {
    const gs = GameState.get();
    gs.setHP(gs.getData().playerMaxHP);
    AudioManager.get().stopHeartbeat();
    AudioManager.stopAll(this);

    const cx = INTERNAL_WIDTH / 2;
    const cy = INTERNAL_HEIGHT / 2;
    this.add.rectangle(cx, cy, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x000000, 0.65).setDepth(50).setScrollFactor(0);
    this.add.text(cx, cy - 20, 'YOU DIED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#ff5555',
      stroke: '#0b0f1d',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(cx, cy + 4, `LIVES REMAINING: ${this.lives}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#8ef6ff',
      resolution: 2,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(cx, cy + 20, 'Retrying...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#94a3b8',
      resolution: 2,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart();
      });
    });
  }

  shutdown(): void {
    this.lighting?.destroy();
    this.bossGlow?.destroy();
    this.bossThinkingPulseTween?.stop();
    this.bossThinkingPulseTween = null;
    this.bossThinkingText?.destroy();
    this.shieldGlow?.destroy();
    this.arenaEmbers.forEach((p) => p.sprite.destroy());
    this.arenaEmbers = [];
    this.wsUnsub?.();
    this.wsStatusUnsub?.();
    wsClient.disconnect();
    micCapture.stop();
    bossVoicePlayer.stop();
    this.telemetryTimer?.remove(false);
    this.liveTelemetryTimer?.remove(false);
    this.introTauntTimer?.remove(false);
    this.cancelTtsFallback();
    this.mechanicInterpreter.clear();
    this.devConsole.destroy();
    this.directorPanel.destroy();
    this.micIndicator?.destroy();
    this.micIndicatorBg?.destroy();
    this.transcriptTimer?.remove(false);
    this.transcriptText?.destroy();
    this.transcriptBg?.destroy();
    this.wsDebugText?.destroy();
    this.wsDebugBg?.destroy();
    if (this.micRetryHandler) {
      this.input.off('pointerdown', this.micRetryHandler);
      this.input.keyboard?.off('keydown', this.micRetryHandler);
      this.micRetryHandler = null;
    }
    if (this.pttKeyDownHandler) {
      this.input.keyboard?.off('keydown-T', this.pttKeyDownHandler);
      this.pttKeyDownHandler = null;
    }
    if (this.pttKeyUpHandler) {
      this.input.keyboard?.off('keyup-T', this.pttKeyUpHandler);
      this.pttKeyUpHandler = null;
    }
    if (this.audioUnlockHandler) {
      this.input.off('pointerdown', this.audioUnlockHandler);
      this.input.keyboard?.off('keydown', this.audioUnlockHandler);
      this.audioUnlockHandler = null;
    }
    if (this.toggleHandler) {
      this.input.keyboard?.off('keydown-P', this.toggleHandler);
      this.toggleHandler = null;
    }
  }
}
