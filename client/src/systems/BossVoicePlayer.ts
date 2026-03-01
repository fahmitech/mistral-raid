import { AudioManager } from './AudioManager';

class BossVoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private currentUrl: string | null = null;

  play(base64: string, format: string = 'mp3'): void {
    this.stop();
    if (!base64) return;
    const blob = this.base64ToBlob(base64, format);
    const url = URL.createObjectURL(blob);
    this.currentUrl = url;
    this.audio = new Audio(url);
    this.audio.volume = 1;
    this.audio.preload = 'auto';
    this.audio.onended = () => {
      this.active = false;
      this.cleanup();
    };
    this.audio.onpause = () => {
      this.active = false;
    };
    this.audio.onerror = () => {
      this.active = false;
      this.cleanup();
    };
    this.active = true;
    AudioManager.get().duckMusic(0.3, 3.0);
    const playPromise = this.audio.play();
    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.warn('[BossVoicePlayer] play failed:', err);
        this.active = false;
        this.cleanup();
      });
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.active = false;
    this.cleanup();
  }

  get isPlaying(): boolean {
    return this.active;
  }

  private cleanup(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  private base64ToBlob(base64: string, format: string): Blob {
    const cleaned = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const type = format === 'wav'
      ? 'audio/wav'
      : format === 'ogg'
        ? 'audio/ogg'
        : 'audio/mpeg';
    return new Blob([bytes], { type });
  }
}

export const bossVoicePlayer = new BossVoicePlayer();
