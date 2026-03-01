import { AudioManager } from './AudioManager';

class BossVoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private streamQueue: Uint8Array[] = [];
  private streamOpen = false;
  private streamEnded = false;
  private streaming = false;
  private fallbackChunks: Uint8Array[] = [];
  private active = false;
  private currentUrl: string | null = null;

  streamChunk(base64: string, format: string = 'mp3'): void {
    if (!base64) return;
    if (!this.ensureStream(format)) {
      this.fallbackChunks.push(this.base64ToBytes(base64));
      return;
    }
    this.streamQueue.push(this.base64ToBytes(base64));
    this.flushStream();
  }

  endStream(): void {
    if (!this.streaming) {
      if (this.fallbackChunks.length) {
        const merged = this.concatChunks(this.fallbackChunks);
        this.fallbackChunks = [];
        const b64 = this.bytesToBase64(merged);
        this.play(b64, 'mp3');
      }
      return;
    }
    this.streamEnded = true;
    this.flushStream();
  }

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
    this.streaming = false;
    this.streamEnded = false;
    this.streamQueue = [];
    this.fallbackChunks = [];
    if (this.sourceBuffer) {
      try {
        this.sourceBuffer.abort();
      } catch {
        // no-op
      }
    }
    this.sourceBuffer = null;
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // no-op
      }
    }
    this.mediaSource = null;
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

  private ensureStream(format: string): boolean {
    if (this.streaming) return true;
    const mime = format === 'mp3' ? 'audio/mpeg' : format === 'ogg' ? 'audio/ogg' : 'audio/wav';
    const canStream = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mime);
    if (!canStream) return false;

    this.stop();
    this.streaming = true;
    this.streamOpen = false;
    this.streamEnded = false;
    this.streamQueue = [];

    this.mediaSource = new MediaSource();
    const url = URL.createObjectURL(this.mediaSource);
    this.currentUrl = url;
    this.audio = new Audio(url);
    this.audio.volume = 1;
    this.audio.preload = 'auto';
    this.audio.onended = () => {
      this.active = false;
      this.cleanup();
    };
    this.audio.onerror = () => {
      this.active = false;
      this.cleanup();
    };
    this.mediaSource.addEventListener('sourceopen', () => {
      if (!this.mediaSource) return;
      this.sourceBuffer = this.mediaSource.addSourceBuffer(mime);
      this.sourceBuffer.mode = 'sequence';
      this.sourceBuffer.addEventListener('updateend', () => this.flushStream());
      this.streamOpen = true;
      this.flushStream();
    }, { once: true });

    this.active = true;
    AudioManager.get().duckMusic(0.3, 3.0);
    const playPromise = this.audio.play();
    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.warn('[BossVoicePlayer] stream play failed:', err);
        this.active = false;
        this.cleanup();
      });
    }
    return true;
  }

  private flushStream(): void {
    if (!this.streaming || !this.streamOpen || !this.sourceBuffer) return;
    if (this.sourceBuffer.updating) return;

    if (this.streamQueue.length) {
      const chunk = this.streamQueue.shift()!;
      try {
        this.sourceBuffer.appendBuffer(chunk);
      } catch (err) {
        console.warn('[BossVoicePlayer] appendBuffer failed:', err);
      }
      return;
    }

    if (this.streamEnded && this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // no-op
      }
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

  private base64ToBytes(base64: string): Uint8Array {
    const cleaned = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private concatChunks(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.length;
    });
    return merged;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const bossVoicePlayer = new BossVoicePlayer();
