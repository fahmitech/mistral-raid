import { AudioManager } from './AudioManager';

class BossVoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private currentUrl: string | null = null;

  play(base64: string): void {
    this.stop();
    const blob = this.base64ToBlob(base64);
    const url = URL.createObjectURL(blob);
    this.currentUrl = url;
    this.audio = new Audio(url);
    this.audio.volume = 1;
    this.audio.onended = () => {
      this.active = false;
      this.cleanup();
    };
    this.audio.onpause = () => {
      this.active = false;
    };
    this.active = true;
    AudioManager.get().duckMusic(0.3, 3.0);
    void this.audio.play();
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

  private base64ToBlob(base64: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/mpeg' });
  }
}

export const bossVoicePlayer = new BossVoicePlayer();
