import Phaser from 'phaser';
import {
  DASH_COOLDOWN_MS,
  DASH_DISTANCE,
  DASH_INVINCIBLE_MS,
  ENEMY_EXPLODE_RANGE,
  ENEMY_PROJECTILE_LIFETIME_MS,
  ENEMY_PROJECTILE_SPEED,
  INVINCIBLE_MS,
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
  EnemyType,
  ItemEffect,
  ItemType,
  LevelData,
  RoomType,
  TileType,
} from '../config/types';
import { GameState, getWeaponDamageMultiplier, getWeaponProjectileColor } from '../core/GameState';
import { MazeData, MazeGenerator } from '../core/MazeGenerator';
import { getLevelData } from '../core/LevelConfig';
import { EnemyFactory } from '../core/EnemyFactory';
import { BossFactory } from '../core/BossFactory';
import { ItemFactory } from '../core/ItemFactory';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { BossEntity } from '../entities/BossEntity';
import { Item } from '../entities/Item';
import { LootSystem } from '../systems/LootSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { MiniMap } from '../systems/MiniMap';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';

export class LevelScene extends Phaser.Scene {
  private levelData!: LevelData;
  private maze!: MazeData;
  private player!: Player;
  private playerSpriteKey = 'knight_m';

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
  private hintText?: Phaser.GameObjects.Text;
  private weaponText?: Phaser.GameObjects.Text;
  private levelText?: Phaser.GameObjects.Text;
  private coinText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private dashBar?: Phaser.GameObjects.Graphics;
  private dashLabel?: Phaser.GameObjects.Text;
  private shieldIndicator?: Phaser.GameObjects.Graphics;
  private heartSprites: Phaser.GameObjects.Image[] = [];
  private lastHP = -1;

  private boss?: BossEntity;
  private bossBar?: Phaser.GameObjects.Graphics;
  private bossNameText?: Phaser.GameObjects.Text;
  private bossTriggered = false;
  private stairsSprite?: Phaser.GameObjects.Image;
  private stairsActive = false;

  private stairsCheck?: Phaser.Time.TimerEvent;
  private minimapTimer?: Phaser.Time.TimerEvent;

  private options = SaveSystem.loadOptions();
  private currentWeaponType: ItemType = ItemType.WeaponSword;
  private lastUpdateTime = 0;

  constructor() {
    super('LevelScene');
  }

  init(data: { level?: number; continue?: boolean }): void {
    const state = GameState.get();
    if (data?.continue) {
      const save = SaveSystem.load();
      if (save) {
        state.loadSave(save);
      }
    } else if (data?.level) {
      state.setLevel(data.level);
    }
    this.levelData = getLevelData(state.getData().level);
  }

  create(): void {
    AudioManager.get().setOptions(this.options);
    this.cameras.main.setBackgroundColor(this.levelData.bgColor);

    this.events.on('resume', () => {
      this.options = SaveSystem.loadOptions();
      AudioManager.get().setOptions(this.options);
      if (this.player) {
        this.player.setAlpha(1);
        this.player.invincibleUntil = 0;
      }
    });

    this.createBulletTextures();

    this.maze = new MazeGenerator().generate(this.levelData);
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
    EnemyFactory.spawnEnemies(this, this.maze, this.levelData, this.enemies);

    this.setupCollisions();
    this.setupCamera();
    this.createHUD();

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
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.tryShield();
      }
    });
  }

  update(time: number): void {
    this.lastUpdateTime = time;
    this.handleInput(time);

    this.player.updateBlink(time);
    if (!Number.isFinite(this.player.alpha) || this.player.alpha <= 0) {
      this.player.setAlpha(1);
      this.player.setVisible(true);
    }
    this.player.updateWeaponPosition();
    this.updateShieldRing(time);
    this.checkAutoCollect();

    this.enemies.children.iterate((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) return true;
      enemy.updateAI(this.player, time, {
        shootProjectile: (x, y, vx, vy, dmg, color) => this.spawnEnemyProjectile(x, y, vx, vy, dmg, color),
        spawnEnemy: (type, x, y) => this.spawnSummonedEnemy(type, x, y),
        shake: (d, i) => this.shakeCamera(d, i),
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

    this.checkBossTrigger();
    this.updateHUD(time);
    this.lighting.update(this.player.x, this.player.y);
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
    for (let y = 0; y < this.maze.height; y += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        const tile = this.maze.tiles[y][x];
        if (tile !== TileType.Wall) {
          const variant = (x + y) % 4;
          floor.draw(`floor_${variant + 1}`, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
  }

  private createWalls(): void {
    this.walls = this.physics.add.staticGroup();
    for (let y = 0; y < this.maze.height; y += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        if (this.maze.tiles[y][x] === TileType.Wall) {
          const aboveWall = y > 0 && this.maze.tiles[y - 1][x] === TileType.Wall;
          const key = aboveWall ? 'wall_mid' : 'wall_top_mid';
          const wall = this.add.image(x * TILE_SIZE + 8, y * TILE_SIZE + 8, key).setDepth(1);
          this.walls.add(wall);
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
      const sprite = this.add.sprite(torch.x * TILE_SIZE + 8, torch.y * TILE_SIZE + 8, 'wall_fountain_mid_blue_anim_f0');
      sprite.setDepth(2);
      if (this.anims.exists('torch')) {
        sprite.play('torch');
      }
    }
  }

  private createPlayer(): void {
    const state = GameState.get().getData();
    const config = CHARACTER_CONFIGS[state.character];
    this.playerSpriteKey = config.spriteKey;
    const spawnX = this.maze.playerSpawn.x * TILE_SIZE + 8;
    const spawnY = this.maze.playerSpawn.y * TILE_SIZE + 8;
    const weaponConfig = ITEM_CONFIGS[state.equippedWeapon];
    this.currentWeaponType = state.equippedWeapon;
    this.player = new Player(this, spawnX, spawnY, `${this.playerSpriteKey}_idle_anim_f0`, weaponConfig);
    this.add.existing(this.player);
    this.physics.add.existing(this.player);
    if (!this.player.body) {
      this.physics.world.enable(this.player);
    }
    this.player.initPhysics();
    if (this.anims.exists(`${this.playerSpriteKey}_idle`)) {
      this.player.play(`${this.playerSpriteKey}_idle`);
    }
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

    this.physics.add.collider(this.playerProjectiles, this.walls, (obj) => obj.destroy());
    this.physics.add.collider(this.enemyProjectiles, this.walls, (obj) => obj.destroy());

    this.physics.add.overlap(this.playerProjectiles, this.enemies, (proj, enemy) => {
      this.handleEnemyHit(proj as Phaser.Physics.Arcade.Image, enemy as Enemy);
    });

    this.physics.add.overlap(this.playerProjectiles, this.bossGroup, (proj, boss) => {
      this.handleBossHit(proj as Phaser.Physics.Arcade.Image, boss as BossEntity);
    });

    this.physics.add.overlap(this.enemyProjectiles, this.player, (proj) => {
      const dmg = (proj as Phaser.Physics.Arcade.Image).getData('damage') as number;
      proj.destroy();
      this.damagePlayer(dmg || 1, this.lastUpdateTime);
    });

    this.physics.add.overlap(this.player, this.enemies, (_playerObj, enemyObj) => {
      const enemy = enemyObj as Enemy | undefined;
      const damage = enemy?.config?.damage;
      if (typeof damage !== 'number') return;
      this.damagePlayer(damage, this.lastUpdateTime);
    });

    this.physics.add.overlap(this.player, this.bossGroup, (_p, bossObj) => {
      const boss = bossObj as BossEntity;
      if (!boss.active) return;
      this.damagePlayer(2 + boss.phase, this.lastUpdateTime);
    });

  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.maze.width * TILE_SIZE, this.maze.height * TILE_SIZE);
  }

  private createHUD(): void {
    this.levelText = this.add
      .text(6, 6, `LEVEL ${this.levelData.level}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffcc00',
      })
      .setScrollFactor(0)
      .setDepth(20);

    this.coinText = this.add
      .text(6, 14, 'COINS: 0', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#ffdd44',
      })
      .setScrollFactor(0)
      .setDepth(20);

    this.scoreText = this.add
      .text(314, 6, 'SCORE: 0', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#eecc55',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(20);

    this.weaponText = this.add
      .text(314, 162, 'SWORD', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#ffcc44',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(20);

    this.hintText = this.add
      .text(160, 155, '[E] Pick up', {
        fontFamily: '"Press Start 2P"',
        fontSize: '5px',
        color: '#aaffaa',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    this.dashLabel = this.add
      .text(10, 168, 'DASH', {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#006666',
      })
      .setScrollFactor(0)
      .setDepth(20);

    this.dashBar = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.shieldIndicator = this.add.graphics().setScrollFactor(0).setDepth(20);

    this.createHearts();
  }

  private createHearts(): void {
    this.heartSprites.forEach((heart) => heart.destroy());
    this.heartSprites = [];
    const maxHearts = Math.ceil(GameState.get().getData().playerMaxHP / 2);
    for (let i = 0; i < maxHearts; i += 1) {
      const heart = this.add
        .image(10 + i * 14, 164, 'ui_heart_full')
        .setScrollFactor(0)
        .setDepth(20);
      this.heartSprites.push(heart);
    }
  }

  private updateHUD(time: number): void {
    const state = GameState.get().getData();
    if (state.equippedWeapon !== this.currentWeaponType) {
      this.currentWeaponType = state.equippedWeapon;
      this.player.setWeapon(ITEM_CONFIGS[state.equippedWeapon]);
    }
    if (this.coinText) this.coinText.setText(`COINS: ${state.coins}`);
    if (this.scoreText) this.scoreText.setText(`SCORE: ${state.score}`);
    if (this.weaponText) {
      this.weaponText.setText(WEAPON_LABELS[state.equippedWeapon] ?? 'SWORD');
    }

    if (state.playerHP !== this.lastHP) {
      this.lastHP = state.playerHP;
      this.updateHearts();
    }

    const dashRemaining = Math.max(0, this.player.dashCooldownUntil - time);
    if (this.dashBar) {
      this.dashBar.clear();
      this.dashBar.fillStyle(0x444444, 1);
      this.dashBar.fillRect(10, 172, 30, 3);
      const pct = dashRemaining <= 0 ? 1 : 1 - dashRemaining / DASH_COOLDOWN_MS;
      this.dashBar.fillStyle(0x00ffff, 0.85);
      this.dashBar.fillRect(10, 172, 30 * pct, 3);
    }

    if (this.shieldIndicator) {
      this.shieldIndicator.clear();
      if (this.player.isShieldActive(time) || GameState.get().getData().hasShield) {
        const pulse = 0.5 + Math.sin(time / 120) * 0.2;
        this.shieldIndicator.lineStyle(1, 0x33aaff, 0.9);
        this.shieldIndicator.strokeCircle(90, 172, 5 + pulse * 2);
      } else {
        const shieldRemaining = Math.max(0, this.player.shieldCooldownUntil - time);
        if (shieldRemaining > 0) {
          const pct = 1 - shieldRemaining / SHIELD_COOLDOWN_MS;
          this.shieldIndicator.fillStyle(0x113355, 1);
          this.shieldIndicator.fillRect(80, 170, 30, 3);
          this.shieldIndicator.fillStyle(0x3399ff, 0.6);
          this.shieldIndicator.fillRect(80, 170, 30 * pct, 3);
        }
      }
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
    if (!this.player.body) {
      this.physics.world.enable(this.player);
      this.player.initPhysics();
    }

    const move = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left?.isDown || this.keys.A.isDown) move.x -= 1;
    if (this.cursors.right?.isDown || this.keys.D.isDown) move.x += 1;
    if (this.cursors.up?.isDown || this.keys.W.isDown) move.y -= 1;
    if (this.cursors.down?.isDown || this.keys.S.isDown) move.y += 1;

    const state = GameState.get().getData();
    if (move.lengthSq() > 0) {
      move.normalize();
      this.player.setVelocity(move.x * state.playerSpeed, move.y * state.playerSpeed);
      this.player.updateFacing(move);
      if (move.x !== 0) this.player.setFlipX(move.x < 0);
      if (this.anims.exists(`${this.playerSpriteKey}_run`)) {
        this.player.anims?.play(`${this.playerSpriteKey}_run`, true);
      }
    } else {
      this.player.setVelocity(0, 0);
      if (this.anims.exists(`${this.playerSpriteKey}_idle`)) {
        this.player.anims?.play(`${this.playerSpriteKey}_idle`, true);
      }
    }

    const pointer = this.input.activePointer;
    this.player.updateWeaponPosition(pointer.worldX, pointer.worldY);

    const primaryDown = pointer.isDown && (pointer.leftButtonDown() || pointer.primaryDown);
    if (primaryDown) {
      if (time - this.lastShotAt >= state.playerFireRate) {
        this.lastShotAt = time;
        this.shootProjectile(pointer.worldX, pointer.worldY);
      }
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

    this.updatePickupHint();
  }

  private updateShieldRing(time: number): void {
    this.shieldRing.clear();
    if (this.player.isShieldActive(time)) {
      const pulse = 0.5 + Math.sin(time / 140) * 0.2;
      this.shieldRing.lineStyle(1, 0x33aaff, 0.9);
      this.shieldRing.strokeCircle(this.player.x, this.player.y, 11 + pulse * 2);
    }
  }

  private shootProjectile(targetX: number, targetY: number): void {
    const state = GameState.get().getData();
    const weaponMult = getWeaponDamageMultiplier(state.equippedWeapon);
    const damage = state.playerDamage * weaponMult;

    const baseAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    const angles = state.isMultiShot ? [baseAngle, baseAngle - 0.2, baseAngle + 0.2] : [baseAngle];

    const muzzleX = this.player.x + Math.cos(baseAngle) * 10;
    const muzzleY = this.player.y + Math.sin(baseAngle) * 10;

    angles.forEach((angle) => {
      const proj = this.physics.add.image(muzzleX, muzzleY, 'player_bullet');
      proj.setDepth(10);
      proj.setData('damage', damage);
      this.playerProjectiles.add(proj);
      proj.setTint(getWeaponProjectileColor(state.equippedWeapon));
      proj.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);
      this.time.delayedCall(PROJECTILE_LIFETIME_MS, () => proj.destroy());
    });

    this.spawnMuzzleFlash(muzzleX, muzzleY);
    const snap = (Math.PI * 2) / 8;
    const snapped = Math.round(baseAngle / snap) * snap;
    this.player.weaponSprite.setRotation(snapped + Math.PI / 2);
    this.player.weaponSprite.setTint(0xffffff);
    this.time.delayedCall(50, () => this.player.weaponSprite.clearTint());
    this.shakeCamera(28, 0.002);
    AudioManager.get().shoot();
  }

  private spawnEnemyProjectile(x: number, y: number, vx: number, vy: number, damage: number, color: number): void {
    const proj = this.physics.add.image(x, y, 'enemy_bullet');
    proj.setTint(color);
    proj.setData('damage', damage);
    this.enemyProjectiles.add(proj);
    proj.setVelocity(vx * ENEMY_PROJECTILE_SPEED, vy * ENEMY_PROJECTILE_SPEED);
    this.time.delayedCall(ENEMY_PROJECTILE_LIFETIME_MS, () => proj.destroy());
  }

  private spawnMuzzleFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y, 3, 0xffffff, 1).setDepth(12);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 45,
      onComplete: () => flash.destroy(),
    });
  }

  private tryDash(time: number): void {
    if (time < this.player.dashCooldownUntil) return;
    if (this.player.invincibleUntil - time > 60) return;

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
    AudioManager.get().dash();
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
        this.player.setWeapon(ITEM_CONFIGS[next]);
        this.player.weaponSprite.setTint(0xffffff);
        this.time.delayedCall(80, () => this.player.weaponSprite.clearTint());
        this.shakeCamera(20, 0.002);
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
    const item = this.getInteractiveItem();
    if (!item) return;
    if (item.isChest) {
      this.openChest(item);
    } else {
      this.collectItem(item);
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

  private updatePickupHint(): void {
    const item = this.getInteractiveItem();
    if (this.hintText) {
      this.hintText.setVisible(!!item);
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
    } else {
      state.addItem(item.config, item.qty);
      AudioManager.get().pickup();
    }
    item.destroy();
  }

  private openChest(item: Item): void {
    if (item.opened) return;
    item.openChest();
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

  private handleEnemyHit(proj: Phaser.Physics.Arcade.Image, enemy: Enemy): void {
    const damage = proj.getData('damage') as number;
    proj.destroy();
    enemy.takeDamage(damage);
    enemy.setTint(0xff00ff);
    this.time.delayedCall(80, () => {
      if (!enemy.active) return;
      if (enemy.config.behavior === EnemyBehavior.Shielded && enemy.hp > enemy.maxHP * 0.5) {
        enemy.setTint(0x4488ff);
      } else {
        enemy.clearTint();
      }
      return true;
    });
    this.shakeCamera(45, 0.003);
    this.spawnHitParticles(enemy.x, enemy.y, 0xff00ff);

    if (enemy.hp <= 0) {
      enemy.die();
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
    } else {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      enemy.setVelocity(Math.cos(angle) * 95, Math.sin(angle) * 95);
    }
  }

  private handleBossHit(proj: Phaser.Physics.Arcade.Image, boss: BossEntity): void {
    const damage = proj.getData('damage') as number;
    proj.destroy();
    const result = boss.applyDamage(damage);
    this.spawnHitParticles(boss.x, boss.y, 0xffffff);
    if (result.phaseChanged) {
      this.showPhaseText(boss.phase);
    }
    if (result.died) {
      this.handleBossDeath(boss);
    }
  }

  private triggerExploder(enemy: Enemy): void {
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    if (dist <= ENEMY_EXPLODE_RANGE) {
      this.damagePlayer(enemy.config.damage * 3, this.lastUpdateTime);
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
    this.spawnCoinExplosion(boss.x, boss.y);
    if (this.stairsSprite) {
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
    SaveSystem.save(GameState.get().getData().character, GameState.get().getData());

    if (this.levelData.level === 5) {
      this.time.delayedCall(2500, () => {
        this.scene.start('VictoryScene');
      });
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
  }

  private checkBossTrigger(): void {
    if (this.bossTriggered) return;
    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const room = this.maze.bossRoom;
    if (tileX >= room.x && tileX < room.x + room.w && tileY >= room.y && tileY < room.y + room.h) {
      this.bossTriggered = true;
      this.spawnBoss();
    }
  }

  private spawnBoss(): void {
    const posX = this.maze.bossRoom.cx * TILE_SIZE + 8;
    const posY = (this.maze.bossRoom.cy - 2) * TILE_SIZE + 8;
    this.boss = BossFactory.spawnBoss(this, this.levelData.bossType, posX, posY, this.bossGroup);
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
    this.showBossBar();
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
      SaveSystem.save(GameState.get().getData().character, GameState.get().getData());
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

  private damagePlayer(amount: number, time: number): void {
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
    this.player.setInvincible(INVINCIBLE_MS, time);
    this.spawnPlayerHitEffects();

    if (GameState.get().isDead()) {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene');
      });
    }
  }

  private spawnPlayerHitEffects(): void {
    AudioManager.get().hit();
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

  private showLevelIntro(): void {
    const title = this.add
      .text(160, 70, this.levelData.name, {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(20);

    const subtitle = this.add
      .text(160, 84, this.levelData.subtitle, {
        fontFamily: '"Press Start 2P"',
        fontSize: '4px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(20);

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 1,
      duration: 500,
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        title.destroy();
        subtitle.destroy();
      },
    });
  }
}
