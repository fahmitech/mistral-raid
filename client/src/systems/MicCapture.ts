import { MicVAD } from '@ricky0123/vad-web';
import { wsClient } from '../network/WebSocketClient';

class MicCapture {
  private vad: Awaited<ReturnType<typeof MicVAD.new>> | null = null;
  private active = false;
  private errorHandler: ((err: Error) => void) | null = null;
  private speechStartHandler: (() => void) | null = null;
  private speechEndHandler: (() => void) | null = null;

  async start(): Promise<void> {
    try {
      this.vad = await MicVAD.new({
        onSpeechStart: () => {
          wsClient.send({ type: 'vad_state', payload: { speaking: true } });
          this.speechStartHandler?.();
        },
        onSpeechEnd: (audio: Float32Array) => {
          const pcm = new Int16Array(audio.length);
          for (let i = 0; i < audio.length; i += 1) {
            pcm[i] = Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32767)));
          }
          wsClient.sendBinary(pcm.buffer);
          wsClient.send({ type: 'vad_state', payload: { speaking: false } });
          this.speechEndHandler?.();
        },
        onVADMisfire: () => {
          wsClient.send({ type: 'vad_state', payload: { speaking: false } });
        },
      });
      await this.vad.start();
      this.active = true;
    } catch (err) {
      this.active = false;
      this.errorHandler?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  stop(): void {
    this.vad?.pause();
    this.active = false;
  }

  get isActive(): boolean {
    return this.active;
  }

  onError(handler: (err: Error) => void): void {
    this.errorHandler = handler;
  }

  onSpeechStart(handler: () => void): void {
    this.speechStartHandler = handler;
  }

  onSpeechEnd(handler: () => void): void {
    this.speechEndHandler = handler;
  }
}

export const micCapture = new MicCapture();
