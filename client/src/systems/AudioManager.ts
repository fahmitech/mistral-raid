import Phaser from 'phaser';
import { ItemType, OptionsData } from '../config/types';
import {
  AudioVolumes,
  AudioDebugInfo,
  AudioTelemetry,
  AdaptiveResponse,
  MusicLayer,
  MusicMood,
  DEFAULT_VOLUMES,
  AUDIO_VOLUMES_KEY,
} from '../types/AudioTypes';

const SERVER_URL = 'http://localhost:3001';
const MAX_BUFFERS = 60; // evict LRU beyond this

// ─── Cooldowns (ms) ────────────────────────────────────────────────────────────
const SOUND_COOLDOWNS: Readonly<Record<string, number>> = {
  footstep_stone: 200,
  sword_slash: 100,
  dagger_slash: 100,
  katana_slice: 100,
  hammer_impact: 120,
  bomb_explosion: 300,
  player_hit: 150,
  player_death: 10_000,
  heartbeat_low_hp: 850,
  goblin_attack: 400,
  orc_roar: 600,
  skeleton_rattle: 400,
  zombie_growl: 400,
  elemental_magic: 350,
  enemy_kill: 80,
  xp_tone: 100,
  coin_pickup: 80,
  character_hover: 120,
  character_confirm: 500,
  game_start: 10_000,
  menu_hover: 120,
  menu_select: 150,
  menu_open: 200,
  menu_close: 200,
  inventory_open: 300,
  weapon_swap: 200,
  pause_whoosh: 400,
  chest_open: 400,
  potion_drink: 300,
  item_pickup: 100,
  door_open: 600,
  stairs_descend: 1_500,
  dash: 100,
  shield_activate: 300,
  suspense_build: 6_000,
  low_rumble: 4_000,
  boss_intro: 15_000,
  boss_death: 15_000,
  game_over_theme: 15_000,
  victory_theme: 15_000,
};

// ─── Fallback oscillator tones ─────────────────────────────────────────────────
const FALLBACK_TONES: Readonly<Record<string, [number, number, OscillatorType, number]>> = {
  character_hover: [560, 25, 'sine', 0.04],
  character_confirm: [880, 80, 'square', 0.07],
  game_start: [60, 500, 'sawtooth', 0.14],
  sword_slash: [620, 40, 'square', 0.06],
  dagger_slash: [720, 30, 'square', 0.05],
  katana_slice: [800, 35, 'square', 0.05],
  hammer_impact: [200, 80, 'sawtooth', 0.09],
  bomb_explosion: [100, 200, 'sawtooth', 0.12],
  player_hit: [180, 120, 'triangle', 0.10],
  player_death: [90, 600, 'sawtooth', 0.12],
  dash: [420, 80, 'sawtooth', 0.08],
  item_pickup: [900, 80, 'square', 0.05],
  coin_pickup: [1100, 60, 'square', 0.04],
  xp_tone: [750, 50, 'square', 0.05],
  enemy_kill: [660, 60, 'square', 0.06],
  boss_death: [140, 220, 'sawtooth', 0.12],
  boss_intro: [90, 300, 'sawtooth', 0.14],
  chest_open: [550, 150, 'sine', 0.07],
  potion_drink: [440, 100, 'sine', 0.06],
  inventory_open: [380, 80, 'sine', 0.05],
  weapon_swap: [500, 60, 'square', 0.06],
  pause_whoosh: [300, 120, 'sine', 0.06],
  menu_hover: [480, 30, 'sine', 0.04],
  menu_select: [660, 60, 'square', 0.05],
  menu_open: [380, 120, 'sine', 0.05],
  menu_close: [280, 80, 'sine', 0.04],
  shield_activate: [550, 140, 'sine', 0.07],
  stairs_descend: [220, 400, 'sine', 0.06],
  heartbeat_low_hp: [80, 80, 'sine', 0.08],
  suspense_build: [60, 800, 'sine', 0.06],
};

// ─── Static Phaser audio volumes ──────────────────────────────────────────────
const STATIC_MUSIC_VOLUMES: Record<string, number> = {
  menu_theme: 0.5,
  dungeon_ambient: 0.4,
  combat_music: 0.6,
  boss_music: 0.8,
  game_over_music: 0.7,
  victory_music: 0.7,
  credits_theme: 0.5,
};
const STATIC_SFX_VOLUMES: Record<string, number> = {
  sword_attack: 0.7,
  enemy_hit: 0.9,
  enemy_die: 0.75,
  dash: 0.8,
  shield: 0.8,
  footstep: 0.4,
  ui_click: 0.7,
  menu_hover: 0.5,
  chest_open: 0.9,
  potion_drink: 0.85,
  boss_roar: 0.9,
};

// ─── Music track mapping ───────────────────────────────────────────────────────
const MUSIC_TRACK: Partial<Record<MusicLayer, string>> = {
  menu: 'menu_ambient',
  hero_select: 'hero_select_music',
  ambient: 'dungeon_ambient_loop',
  combat: 'combat_music',
  boss: 'boss_music_loop',
  credits: 'credits_music',
};

// Static Phaser audio keys (preloaded in BootScene from client/public/audio/)
const PHASER_MUSIC_KEYS: Partial<Record<MusicLayer, string>> = {
  menu: 'menu_theme',
  hero_select: 'menu_theme',
  ambient: 'dungeon_ambient',
  combat: 'combat_music',
  boss: 'boss_music',
  credits: 'credits_theme',
};

interface MusicNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  name: string;
}

// ─── Persistent volume helpers ─────────────────────────────────────────────────
function loadVolumes(): AudioVolumes {
  try {
    const raw = localStorage.getItem(AUDIO_VOLUMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioVolumes>;
      return {
        master: parsed.master ?? DEFAULT_VOLUMES.master,
        music: parsed.music ?? DEFAULT_VOLUMES.music,
        sfx: parsed.sfx ?? DEFAULT_VOLUMES.sfx,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_VOLUMES };
}

function saveVolumes(v: AudioVolumes): void {
  try { localStorage.setItem(AUDIO_VOLUMES_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════════
export class AudioManager {
  private static instance = new AudioManager();

  // Web Audio graph
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Volume settings (persisted)
  private volumes: AudioVolumes = loadVolumes();

  // Boolean toggles from OptionsData
  private soundOn = true;
  private musicOn = true;

  // Buffer cache
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private accessTime = new Map<string, number>(); // LRU tracking

  // Music nodes
  private musicNodes = new Map<string, MusicNode>();
  private currentLayer: MusicLayer = 'none';

  // Global presence (always-on)
  private presenceSource: AudioBufferSourceNode | null = null;
  private presenceGain: GainNode | null = null;
  private presenceStarted = false;

  // SFX cooldowns
  private lastPlayed = new Map<string, number>();

  // Heartbeat
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Last telemetry (read by AudioDebugOverlay)
  private lastTelemetry: AudioTelemetry = {
    hp: 0, maxHp: 0, bossHp: 0, bossMaxHp: 0, enemyCount: 0, recentDamageTaken: 0,
  };
  private lastMood: MusicMood = 'calm';

  // Debug
  private recentSFX: string[] = [];
  private sfxTriggerTimes: number[] = []; // for SFX/sec stat

  // Phaser scene reference for static music (set via init())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private phaserScene: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private activePhaserTrack: any = null;
  private activePhaserKey = '';

  static get(): AudioManager { return AudioManager.instance; }

  // ─── Options ─────────────────────────────────────────────────────────────────

  setOptions(opts: OptionsData): void {
    this.soundOn = opts.soundOn;
    this.musicOn = opts.musicOn;
    this.applyGains();
  }

  setMasterVolume(v: number): void {
    this.volumes.master = Math.max(0, Math.min(1, v));
    saveVolumes(this.volumes);
    this.applyGains();
  }

  setMusicVolume(v: number): void {
    this.volumes.music = Math.max(0, Math.min(1, v));
    saveVolumes(this.volumes);
    this.applyGains();
  }

  setSfxVolume(v: number): void {
    this.volumes.sfx = Math.max(0, Math.min(1, v));
    saveVolumes(this.volumes);
    this.applyGains();
  }

  getVolumes(): Readonly<AudioVolumes> { return this.volumes; }

  private applyGains(): void {
    if (this.masterGain) this.masterGain.gain.value = this.soundOn ? this.volumes.master : 0;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? this.volumes.music : 0;
    if (this.sfxGain) this.sfxGain.gain.value = this.soundOn ? this.volumes.sfx : 1;
    // Also update Phaser track volume
    if (this.activePhaserTrack) {
      this.activePhaserTrack.volume = this.musicOn ? this.volumes.music * this.volumes.master : 0;
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state !== 'suspended';
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applyGains();
      this.startGlobalAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ─── Global Always-On Presence ────────────────────────────────────────────────

  startGlobalAmbience(): void {
    if (this.presenceStarted) return;
    this.presenceStarted = true;

    void this.fetchBuffer('global_presence').then((buf) => {
      if (!buf || !this.ctx || !this.masterGain) return;

      this.presenceGain = this.ctx.createGain();
      this.presenceGain.gain.value = 0;
      this.presenceGain.connect(this.masterGain);

      this.presenceSource = this.ctx.createBufferSource();
      this.presenceSource.buffer = buf;
      this.presenceSource.loop = true;
      this.presenceSource.connect(this.presenceGain);
      this.presenceSource.start();

      const now = this.ctx.currentTime;
      this.presenceGain.gain.setValueAtTime(0, now);
      this.presenceGain.gain.linearRampToValueAtTime(0.12, now + 4.0);
    });
  }

  // ─── Preloading ───────────────────────────────────────────────────────────────

  preload(names: string[]): void {
    for (const name of names) void this.fetchBuffer(name);
  }

  private fetchBuffer(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) {
      this.accessTime.set(name, Date.now());
      return Promise.resolve(this.buffers.get(name)!);
    }
    if (this.loading.has(name)) return this.loading.get(name)!;

    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const genRes = await fetch(`${SERVER_URL}/api/audio/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: name }),
        });
        if (!genRes.ok) throw new Error(`generate HTTP ${genRes.status}`);

        const { url } = (await genRes.json()) as { url: string };

        const audioRes = await fetch(`${SERVER_URL}${url}`);
        if (!audioRes.ok) throw new Error(`audio HTTP ${audioRes.status}`);

        const arrayBuffer = await audioRes.arrayBuffer();
        if (!this.ctx) { this.loading.delete(name); return null; }

        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
        this.accessTime.set(name, Date.now());
        this.loading.delete(name);
        this.evictIfNeeded();
        return audioBuffer;
      } catch (err: unknown) {
        console.warn(`[AudioManager] "${name}":`, err instanceof Error ? err.message : err);
        this.loading.delete(name);
        return null;
      }
    })();

    this.loading.set(name, promise);
    return promise;
  }

  private evictIfNeeded(): void {
    if (this.buffers.size <= MAX_BUFFERS) return;
    const sorted = [...this.accessTime.entries()].sort((a, b) => a[1] - b[1]);
    for (const [name] of sorted) {
      if (this.buffers.size <= MAX_BUFFERS) break;
      if (this.musicNodes.has(name)) continue;
      this.buffers.delete(name);
      this.accessTime.delete(name);
    }
  }

  // ─── SFX Playback ─────────────────────────────────────────────────────────────

  playSFX(name: string, volume = 1.0): void {
    if (!this.soundOn) return;
    if (!this.ctx || !this.sfxGain) { void this.fetchBuffer(name); return; }

    const cooldown = SOUND_COOLDOWNS[name] ?? 50;
    const now = performance.now();
    if ((this.lastPlayed.get(name) ?? 0) + cooldown > now) return;
    this.lastPlayed.set(name, now);

    this.recentSFX = [name, ...this.recentSFX].slice(0, 8);
    this.sfxTriggerTimes.push(now);

    const buffer = this.buffers.get(name);
    if (buffer) {
      this.playBuffer(buffer, volume);
    } else {
      this.playFallbackTone(name);
      void this.fetchBuffer(name);
    }
  }

  /** Play SFX with random pitch variation (±pitchVariance fraction). */
  playSFXPitched(name: string, volume = 1.0, pitchVariance = 0.1): void {
    if (!this.soundOn) return;
    if (!this.ctx || !this.sfxGain) { void this.fetchBuffer(name); return; }

    const cooldown = SOUND_COOLDOWNS[name] ?? 50;
    const now = performance.now();
    if ((this.lastPlayed.get(name) ?? 0) + cooldown > now) return;
    this.lastPlayed.set(name, now);

    this.recentSFX = [name, ...this.recentSFX].slice(0, 8);

    const rate = 1.0 + (Math.random() * 2 - 1) * pitchVariance;
    const buffer = this.buffers.get(name);
    if (buffer) {
      this.playBuffer(buffer, volume, rate);
    } else {
      this.playFallbackTone(name);
      void this.fetchBuffer(name);
    }
  }

  /** Play a spatialized SFX based on distance + horizontal pan. */
  playSFXAt(name: string, sourceX: number, sourceY: number, playerX: number, playerY: number, volume = 1.0): void {
    if (!this.ctx || !this.sfxGain || !this.soundOn) return;

    const cooldown = SOUND_COOLDOWNS[name] ?? 50;
    const now = performance.now();
    if ((this.lastPlayed.get(name) ?? 0) + cooldown > now) return;
    this.lastPlayed.set(name, now);

    const dist = Math.hypot(sourceX - playerX, sourceY - playerY);
    const distVol = Math.max(0, 1 - dist / 220);
    if (distVol < 0.02) return;

    const panValue = Math.max(-1, Math.min(1, (sourceX - playerX) / 100));

    const buffer = this.buffers.get(name);
    if (buffer) {
      this.playBufferPanned(buffer, volume * distVol, panValue);
    } else {
      void this.fetchBuffer(name);
    }
  }

  private playBuffer(buffer: AudioBuffer, volume: number, playbackRate = 1.0): void {
    if (!this.ctx || !this.sfxGain) return;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  private playBufferPanned(buffer: AudioBuffer, volume: number, pan: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    panner.pan.value = pan;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);
    source.start();
  }

  private playFallbackTone(name: string): void {
    if (!this.ctx || !this.sfxGain) return;
    const tone = FALLBACK_TONES[name];
    if (!tone) return;
    const [freq, dur, type, vol] = tone;
    this.playTone(freq, dur, type, vol);
  }

  private playTone(freq: number, durMs: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + durMs / 1000);
  }

  // ─── Music Layer Management ────────────────────────────────────────────────────

  playMusic(layer: MusicLayer): void {
    if (layer === 'none') { this.stopMusic(); return; }
    if (layer === this.currentLayer) return;
    this.currentLayer = layer;

    // ── Try Phaser static file first (preloaded in BootScene) ──────────────────
    const phaserKey = PHASER_MUSIC_KEYS[layer];
    if (phaserKey && this.phaserScene) {
      const isCached: boolean = this.phaserScene.sound?.game?.cache?.audio?.has?.(phaserKey) ?? false;
      if (isCached) {
        this.crossFade(phaserKey);
        return;
      }
    }

    // ── Fallback: Web Audio API via ElevenLabs server ──────────────────────────
    const trackName = MUSIC_TRACK[layer];
    if (!trackName) return;

    this.fadeOutAllMusic(0.5);

    const buf = this.buffers.get(trackName);
    if (buf) {
      this.startLoopedTrack(trackName, buf);
    } else {
      void this.fetchBuffer(trackName).then((b) => {
        if (!b || this.currentLayer !== layer) return;
        this.startLoopedTrack(trackName, b);
      });
    }
  }

  private startLoopedTrack(name: string, buffer: AudioBuffer): void {
    if (!this.ctx || !this.musicGain) return;
    const existing = this.musicNodes.get(name);
    if (existing) {
      try { existing.source.stop(); } catch { /* ignore */ }
      existing.gain.disconnect();
      this.musicNodes.delete(name);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.musicGain);
    source.start();

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1.0, now + 0.5);
    this.musicNodes.set(name, { source, gain, name });
  }

  weaponShoot(type: ItemType): void {
    switch (type) {
      case ItemType.WeaponSword:
        this.playSFX('sword_attack', 0.8);
        break;
      case ItemType.WeaponDagger:
        this.playTone(760, 55, 'triangle', 0.05);
        break;
      case ItemType.WeaponKatana:
        this.playTone(480, 80, 'sawtooth', 0.07);
        break;
      case ItemType.WeaponHammer:
        this.playTone(320, 110, 'square', 0.09);
        break;
      case ItemType.WeaponBomb:
        this.playTone(220, 90, 'triangle', 0.08);
        break;
      default:
        this.playSFX('sword_attack', 0.8);
        break;
    }
  }

  weaponExplode(): void {
    this.playTone(160, 200, 'sawtooth', 0.12);
    this.playTone(60, 260, 'triangle', 0.08);
  }

  private fadeOutAllMusic(durationSec: number): void {
    if (!this.ctx) return;
    for (const [name, node] of this.musicNodes) {
      const now = this.ctx.currentTime;
      node.gain.gain.setValueAtTime(node.gain.gain.value, now);
      node.gain.gain.linearRampToValueAtTime(0, now + durationSec);
      const captured = node;
      setTimeout(() => {
        try { captured.source.stop(); } catch { /* ignore */ }
        captured.gain.disconnect();
      }, (durationSec + 0.1) * 1000);
      this.musicNodes.delete(name);
    }
  }

  stopMusic(): void {
    this.fadeOutAllMusic(0.4);
    this.currentLayer = 'none';
    // Also stop Phaser static track
    if (this.activePhaserTrack) {
      const old = this.activePhaserTrack;
      if (this.phaserScene?.tweens) {
        this.phaserScene.tweens.add({ targets: old, volume: 0, duration: 400, onComplete: () => { try { old.stop(); old.destroy(); } catch { /* ignore */ } } });
      } else {
        try { old.stop(); old.destroy(); } catch { /* ignore */ }
      }
      this.activePhaserTrack = null;
      this.activePhaserKey = '';
    }
  }

  /** Duck music volume briefly — e.g. during a boss voice line. */
  duckMusic(targetVolume: number, durationSec: number): void {
    if (!this.ctx || !this.musicGain) return;
    const base = this.musicOn ? this.volumes.music : 0;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(targetVolume, now + 0.15);
    this.musicGain.gain.linearRampToValueAtTime(base, now + 0.15 + durationSec);
  }

  // ─── Global Volume ────────────────────────────────────────────────────────────

  mute(): void { this.setMasterVolume(0); }
  unmute(): void { this.setMasterVolume(this.volumes.master); }

  // ─── Heartbeat ────────────────────────────────────────────────────────────────

  startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return;
    this.heartbeatTimer = setInterval(() => this.playSFX('heartbeat_low_hp', 0.45), 900);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Adaptive Telemetry ───────────────────────────────────────────────────────

  updateTelemetry(data: AudioTelemetry): void {
    this.lastTelemetry = data;
    const { hp, maxHp, bossHp, bossMaxHp } = data;

    if (maxHp > 0 && hp / maxHp < 0.3) this.startHeartbeat();
    else this.stopHeartbeat();

    let mood: MusicMood = 'calm';
    if (bossHp > 0) mood = 'intense';
    else if (hp / maxHp < 0.3) mood = 'critical';
    else if (data.recentDamageTaken > 4) mood = 'tense';
    else if (data.enemyCount > 4) mood = 'tense';
    this.lastMood = mood;

    if (bossMaxHp > 0 && this.currentLayer === 'boss' && this.ctx && this.musicGain && this.musicOn) {
      const bossRatio = Math.max(0, bossHp / bossMaxHp);
      const target = this.volumes.music * (1 + (1 - bossRatio) * 0.45);
      const now = this.ctx.currentTime;
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(target, now + 2.0);
    }

    void this.fetchAdaptive(data);
  }

  private async fetchAdaptive(data: AudioTelemetry): Promise<void> {
    try {
      const res = await fetch(`${SERVER_URL}/api/audio/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) return;
      const adaptive = (await res.json()) as AdaptiveResponse;
      this.applyAdaptive(adaptive);
    } catch { /* network error: silent fallback */ }
  }

  private applyAdaptive(r: AdaptiveResponse): void {
    if (!this.ctx || !this.musicGain || !this.musicOn) return;
    const target = this.volumes.music * r.volumeMultiplier;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + 1.5);
    this.lastMood = r.musicMood;
  }

  // ─── Weapon SFX ──────────────────────────────────────────────────────────────

  playWeaponSFX(weapon: ItemType): void {
    const sfxMap: Partial<Record<ItemType, string>> = {
      [ItemType.WeaponSword]: 'sword_slash',
      [ItemType.WeaponDagger]: 'dagger_slash',
      [ItemType.WeaponKatana]: 'katana_slice',
      [ItemType.WeaponHammer]: 'hammer_impact',
      [ItemType.WeaponBomb]: 'bomb_explosion',
    };
    this.playSFX(sfxMap[weapon] ?? 'sword_slash', 0.75);
  }

  // ─── Phaser Integration ───────────────────────────────────────────────────────

  /**
   * Register the active Phaser scene. Enables Phaser-native music playback
   * using pre-generated static MP3s from client/public/audio/.
   * Call this in every scene's create() before playMusic().
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init(scene: any): void {
    this.phaserScene = scene;
  }

  /**
   * Play a Phaser-preloaded static SFX (from client/public/audio/).
   * Volume is scaled by master * sfx volumes. Cooldown via lastPlayed map.
   */
  playPhaserSFX(key: string, volume = 1.0, cooldownMs = 100): void {
    if (!this.soundOn || !this.phaserScene) return;
    const now = performance.now();
    const cd = SOUND_COOLDOWNS[key] ?? cooldownMs;
    if ((this.lastPlayed.get(key) ?? 0) + cd > now) return;
    this.lastPlayed.set(key, now);
    this.recentSFX = [key, ...this.recentSFX].slice(0, 8);
    this.sfxTriggerTimes.push(now);

    const targetVol = volume * this.volumes.sfx * this.volumes.master;
    const isCached: boolean = this.phaserScene.sound?.game?.cache?.audio?.has?.(key) ?? false;
    if (!isCached) return; // not preloaded — silent fallback
    try {
      this.phaserScene.sound.play(key, { volume: targetVol });
    } catch { /* ignore */ }
  }

  /**
   * Play a Phaser SFX with random pitch variation via detune (cents).
   * ±pitchVariance is a fraction (0.1 = ±10%), converted to ±1200 cents.
   */
  playPhaserSFXPitched(key: string, volume = 1.0, pitchVariance = 0.1): void {
    if (!this.soundOn || !this.phaserScene) return;
    const now = performance.now();
    const cd = SOUND_COOLDOWNS[key] ?? 100;
    if ((this.lastPlayed.get(key) ?? 0) + cd > now) return;
    this.lastPlayed.set(key, now);
    this.recentSFX = [key, ...this.recentSFX].slice(0, 8);
    this.sfxTriggerTimes.push(now);

    const targetVol = volume * this.volumes.sfx * this.volumes.master;
    const isCached: boolean = this.phaserScene.sound?.game?.cache?.audio?.has?.(key) ?? false;
    if (!isCached) return;
    const detune = (Math.random() * 2 - 1) * pitchVariance * 1200;
    try {
      this.phaserScene.sound.play(key, { volume: targetVol, detune });
    } catch { /* ignore */ }
  }

  /** Alias for unlock() — matches the plan's public API. */
  unlockAudio(): void { this.unlock(); }

  /** Alias for setSfxVolume() — matches the plan's public API. */
  setSFXVolume(v: number): void { this.setSfxVolume(v); }

  /**
   * Crossfade to a Phaser static music key (e.g. 'menu_theme', 'combat_music').
   * 500ms fade out of current, 500ms fade in of new track.
   * Falls back to playMusic() via MusicLayer mapping if key not found.
   */
  crossFade(key: string): void {
    if (!this.phaserScene || !this.musicOn) return;
    const soundMgr = this.phaserScene.sound;
    const tweens = this.phaserScene.tweens;
    if (!soundMgr) return;

    const targetVol: number = this.volumes.music * this.volumes.master;

    // Fade out current Phaser track
    if (this.activePhaserTrack && this.activePhaserKey !== key) {
      const old = this.activePhaserTrack;
      tweens.add({ targets: old, volume: 0, duration: 500, onComplete: () => { try { old.stop(); old.destroy(); } catch { /* ignore */ } } });
      this.activePhaserTrack = null;
      this.activePhaserKey = '';
    }

    // Check if audio is cached by Phaser (preloaded in BootScene)
    const isCached: boolean = soundMgr.game?.cache?.audio?.has?.(key) ?? false;
    if (!isCached) {
      // Fallback: find MusicLayer from key and use Web Audio
      const layer = (Object.entries(PHASER_MUSIC_KEYS).find(([, v]) => v === key)?.[0]) as MusicLayer | undefined;
      if (layer) this.playMusic(layer);
      return;
    }

    // Fade in new Phaser track
    if (this.activePhaserKey === key && this.activePhaserTrack?.isPlaying) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const track: any = soundMgr.add(key, { loop: true, volume: 0 });
    track.play();
    this.activePhaserTrack = track;
    this.activePhaserKey = key;
    tweens.add({ targets: track, volume: targetVol, duration: 500 });
  }

  // ─── Backward-Compatible Wrappers ─────────────────────────────────────────────

  shoot(): void { this.playSFX('sword_slash', 0.7); }
  dash(): void { this.playSFX('dash', 0.8); }
  hit(): void { this.playSFX('player_hit', 0.9); }
  pickup(): void { this.playSFX('item_pickup', 0.8); }
  bossDeath(): void { this.playSFX('boss_death', 1.0); }

  // ─── Debug ────────────────────────────────────────────────────────────────────

  /** SFX triggers in the last 1 second. */
  getSFXPerSecond(): number {
    const now = performance.now();
    this.sfxTriggerTimes = this.sfxTriggerTimes.filter((t) => now - t < 1000);
    return this.sfxTriggerTimes.length;
  }

  /** Current active Phaser static music key (or empty string). */
  getActivePhaserKey(): string { return this.activePhaserKey; }

  getDebugInfo(): AudioDebugInfo {
    return {
      layer: this.currentLayer,
      loaded: this.buffers.size,
      loading: this.loading.size,
      heartbeat: this.heartbeatTimer !== null,
      presence: this.presenceStarted,
      musicTracks: this.activePhaserKey
        ? [...this.musicNodes.keys(), `[phaser:${this.activePhaserKey}]`]
        : [...this.musicNodes.keys()],
      recent: [...this.recentSFX],
      hp: this.lastTelemetry.hp,
      maxHp: this.lastTelemetry.maxHp,
      bossHp: this.lastTelemetry.bossHp,
      bossMaxHp: this.lastTelemetry.bossMaxHp,
      enemyCount: this.lastTelemetry.enemyCount,
      intensityLevel: this.lastMood,
      masterVolume: this.volumes.master,
      musicVolume: this.volumes.music,
      sfxVolume: this.volumes.sfx,
    };
  }

  // ─── Static Phaser-native audio API (plan-based simple singleton) ─────────────

  private static currentMusicKey: string | null = null;

  static playMusic(scene: Phaser.Scene, key: string): void {
    if (AudioManager.currentMusicKey === key && !!scene.sound.get(key)?.isPlaying) return;
    scene.sound.stopAll();
    AudioManager.currentMusicKey = key;
    if (!scene.cache.audio.exists(key)) {
      console.warn('[AudioManager] Missing audio key:', key);
      return;
    }
    try {
      scene.sound.play(key, { loop: true, volume: STATIC_MUSIC_VOLUMES[key] ?? 0.5 });
    } catch (err) {
      console.error('[AudioManager] playMusic error:', err);
    }
  }

  static playSFX(scene: Phaser.Scene, key: string): void {
    if (!scene.cache.audio.exists(key)) {
      console.warn('[AudioManager] Missing SFX key:', key);
      return;
    }
    try {
      scene.sound.play(key, { volume: STATIC_SFX_VOLUMES[key] ?? 0.7 });
    } catch (err) {
      console.error('[AudioManager] playSFX error:', err);
    }
  }

  static stopAll(scene: Phaser.Scene): void {
    scene.sound.stopAll();
    AudioManager.currentMusicKey = null;
  }

  static stopMusic(scene: Phaser.Scene): void {
    if (AudioManager.currentMusicKey) {
      scene.sound.stopByKey(AudioManager.currentMusicKey);
      AudioManager.currentMusicKey = null;
    }
  }

  static isMusicPlaying(scene: Phaser.Scene, key: string): boolean {
    return !!scene.sound.get(key)?.isPlaying;
  }
}
