import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, DASH_COOLDOWN_MS, DASH_DISTANCE, DASH_INVINCIBLE_MS, INVINCIBLE_MS } from '../config/constants';
import { Player } from '../entities/Player';
import { GameState } from '../core/GameState';
import { CHARACTER_CONFIGS } from '../config/characters';
import { ITEM_CONFIGS } from '../config/items';
import { BOSS_CONFIGS } from '../config/bosses';
import { BossType } from '../config/types';
import { BossEntity } from '../entities/BossEntity';
import { AudioManager } from '../systems/AudioManager';
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
  private bossHp = 100;
  private bossMaxHp = 100;
  private arenaPhase: ArenaPhase = 'INTRO';
  private aiState: AIState = 'listening';

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
  private toggleHandler: ((event: KeyboardEvent) => void) | null = null;

  private wsUnsub: (() => void) | null = null;
  private wsStatusUnsub: (() => void) | null = null;

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x101018, 1);
    this.physics.world.setBounds(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    const gs = GameState.get();
    const state = gs.getData();
    gs.setHP(state.playerMaxHP);
    const charConfig = CHARACTER_CONFIGS[state.character];
    const weaponType = state.equippedWeapon;
    const weaponItem = ITEM_CONFIGS[weaponType];
    const weaponConfig = gs.getWeaponConfig(weaponType);

    this.player = new Player(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 40, charConfig.spriteKey, weaponItem, weaponConfig);
    this.add.existing(this.player);
    this.physics.add.existing(this.player);
    this.player.initPhysics();

    const bossConfig = BOSS_CONFIGS[BossType.BigDemon];
    this.boss = new BossEntity(this, INTERNAL_WIDTH / 2, 40, bossConfig);
    this.add.existing(this.boss);
    this.physics.add.existing(this.boss);
    this.boss.setCollideWorldBounds(true);
    this.bossHp = bossConfig.hp;
    this.bossMaxHp = bossConfig.hp;

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
      SPACE: this.input.keyboard!.addKey('SPACE'),
      SHIFT: this.input.keyboard!.addKey('SHIFT'),
      F2: this.input.keyboard!.addKey('F2'),
      F5: this.input.keyboard!.addKey('F5'),
      ESC: this.input.keyboard!.addKey('ESC'),
    };

    this.hud = new ArenaHUD(this);
    this.tauntText = new TauntText(this);
    this.analyzingOverlay = new AnalyzingOverlay(this);

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
  }

  update(time: number, delta: number): void {
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
    if (GameState.get().isDead() && this.arenaPhase !== 'DEFEAT') {
      this.arenaPhase = 'DEFEAT';
      this.scene.start('GameOverScene');
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
    this.wsStatusUnsub = wsClient.onStatus((connected) => this.devConsole.setConnection(connected));

    this.telemetryTimer = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => this.sendTelemetry(),
    });
  }

  private startMicCapture(): void {
    micCapture.onError((err) => {
      this.devConsole.setError(`Microphone unavailable: ${err.message}`);
    });

    micCapture.onSpeechStart(() => {
      if (this.aiState === 'speaking') {
        bossVoicePlayer.stop();
        wsClient.send({ type: 'barge_in', payload: {} });
      }
    });

    void micCapture.start();
  }

  private startPhase1(): void {
    this.arenaPhase = 'PHASE_1';
    this.phaseStartTime = this.time.now;
    this.telemetry.startPhase(this.bossMaxHp);
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
    switch (msg.type) {
      case 'ai_state':
        this.aiState = msg.payload.state;
        this.devConsole.setAIState(this.aiState);
        if (this.aiState === 'thinking') {
          this.analyzingOverlay.show();
        } else {
          this.analyzingOverlay.hide();
        }
        break;
      case 'captions_partial':
        this.devConsole.setSTTPartial(msg.payload.text);
        break;
      case 'captions_final':
        this.devConsole.setSTTFinal(msg.payload.text);
        break;
      case 'BOSS_RESPONSE':
        this.handleBossResponse(msg.payload);
        break;
      case 'AUDIO_READY':
        this.devConsole.setTTSStatus('playing');
        bossVoicePlayer.play(msg.payload.audioBase64);
        break;
      case 'director_update':
        this.directorPanel.update(msg.payload);
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
      if (time - this.lastFootstepAt > 200) {
        this.lastFootstepAt = time;
        AudioManager.playSFX(this, 'footstep');
      }
    } else {
      this.player.setVelocity(0, 0);
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
  }

  private shootProjectile(angle: number): void {
    const gs = GameState.get();
    const state = gs.getData();
    const damage = gs.getEffectiveWeaponDamage(state.playerDamage, state.equippedWeapon);

    const speed = 220;
    const proj = this.add.circle(this.player.x, this.player.y, 2.5, 0xffffff, 1);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.playerProjectiles.push({ obj: proj, vx, vy, damage, createdAt: this.time.now });

    this.telemetry.recordShotFired();
    AudioManager.playSFX(this, 'sword_attack');
  }

  private updateBossAI(time: number): void {
    const actions = {
      shootProjectile: (x: number, y: number, vx: number, vy: number, damage: number, color: number) => {
        const angle = Math.atan2(vy, vx);
        const proj = this.add.circle(x, y, 3, color ?? 0xff2266, 1);
        const speed = 140;
        this.bossProjectiles.push({ obj: proj, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: damage ?? 2, createdAt: this.time.now });
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

    GameState.get().takeDamage(amount);
    this.player.setInvincible(INVINCIBLE_MS, now);
    this.telemetry.recordDamage(source, amount);
    AudioManager.playSFX(this, 'enemy_hit');
  }

  shutdown(): void {
    this.wsUnsub?.();
    this.wsStatusUnsub?.();
    wsClient.disconnect();
    micCapture.stop();
    bossVoicePlayer.stop();
    this.telemetryTimer?.remove(false);
    this.mechanicInterpreter.clear();
    this.devConsole.destroy();
    this.directorPanel.destroy();
    if (this.toggleHandler) {
      this.input.keyboard?.off('keydown-P', this.toggleHandler);
      this.toggleHandler = null;
    }
  }
}
