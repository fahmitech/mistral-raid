import { ItemType, OptionsData } from '../config/types';

export class AudioManager {
  private static instance = new AudioManager();
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private options: OptionsData = {
    soundOn: true,
    musicOn: true,
    screenShake: true,
    fullscreen: false,
  };

  static get(): AudioManager {
    return AudioManager.instance;
  }

  setOptions(opts: OptionsData): void {
    this.options = { ...this.options, ...opts };
    if (this.musicGain) {
      this.musicGain.gain.value = this.options.musicOn ? 0.12 : 0;
    }
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.options.musicOn ? 0.12 : 0;
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.musicOsc) {
      this.musicOsc = this.ctx!.createOscillator();
      this.musicOsc.type = 'sine';
      this.musicOsc.frequency.value = 90;
      this.musicOsc.connect(this.musicGain!);
      this.musicOsc.start();
    }
  }

  playTone(freq: number, durationMs: number, type: OscillatorType, volume = 0.08): void {
    if (!this.ctx || !this.masterGain || !this.options.soundOn) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + durationMs / 1000);
  }

  shoot(): void {
    this.playTone(620, 40, 'square', 0.06);
  }

  weaponShoot(type: ItemType): void {
    switch (type) {
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
      case ItemType.WeaponSword:
      default:
        this.playTone(600, 60, 'square', 0.06);
        break;
    }
  }

  weaponExplode(): void {
    this.playTone(160, 200, 'sawtooth', 0.12);
    this.playTone(60, 260, 'triangle', 0.08);
  }

  dash(): void {
    this.playTone(420, 80, 'sawtooth', 0.08);
  }

  hit(): void {
    this.playTone(180, 120, 'triangle', 0.1);
  }

  pickup(): void {
    this.playTone(900, 80, 'square', 0.05);
  }

  bossDeath(): void {
    this.playTone(140, 220, 'sawtooth', 0.12);
  }
}
