import * as vad from '@ricky0123/vad-web';
import vadModelUrl from '@ricky0123/vad-web/dist/silero_vad.onnx?url';
import vadWorkletUrl from '@ricky0123/vad-web/dist/vad.worklet.bundle.min.js?url';
import { wsClient } from '../network/WebSocketClient';

class MicCapture {
  private vad: any | null = null;
  private active = false;
  private transmitEnabled = true;
  private allowCurrentUtterance = false;
  private isSpeaking = false;
  private inputSampleRate = 48000;
  private streamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private resampleRatio = 1;
  private resampleTail = new Float32Array(0);
  private resampleOffset = 0;
  private pending: Float32Array = new Float32Array(0);
  private pendingLength = 0;
  private readonly chunkSamples = 320; // 20ms @ 16kHz
  private readonly streamingMode = true;
  private errorHandler: ((err: Error) => void) | null = null;
  private speechStartHandler: (() => void) | null = null;
  private speechEndHandler: (() => void) | null = null;

  async start(): Promise<void> {
    try {
      const MicVADRef = (vad as any).MicVAD ?? (vad as any).default?.MicVAD;
      if (!MicVADRef) {
        throw new Error('MicVAD export not found from @ricky0123/vad-web');
      }

      this.vad = await MicVADRef.new({
        modelURL: vadModelUrl,
        workletURL: vadWorkletUrl,
        modelFetcher: (path: string) => fetch(path).then((res) => res.arrayBuffer()),
        onSpeechStart: () => {
          this.isSpeaking = true;
          this.allowCurrentUtterance = this.transmitEnabled;
          if (this.allowCurrentUtterance) {
            wsClient.send({ type: 'vad_state', payload: { speaking: true } });
            this.speechStartHandler?.();
          }
        },
        onSpeechEnd: (audio: Float32Array) => {
          this.isSpeaking = false;
          if (!this.allowCurrentUtterance) return;

          if (this.streamingMode) {
            // In streaming mode, chunks are already sent. Just signal end of speech.
            this.flushChunks(); // Final flush to catch any tail audio
            wsClient.send({ type: 'vad_state', payload: { speaking: false } });
            this.speechEndHandler?.();
          } else {
            // Single utterance mode: resample and send the whole buffer
            const targetSampleRate = 16000;
            const maxSeconds = 8;
            const resampled = this.resampleToTargetRate(audio, this.inputSampleRate, targetSampleRate);
            const maxSamples = targetSampleRate * maxSeconds;
            const endIndex = Math.min(resampled.length, maxSamples);
            const pcm = new Int16Array(endIndex);
            for (let i = 0; i < endIndex; i += 1) {
              pcm[i] = Math.max(-32768, Math.min(32767, Math.round(resampled[i] * 32767)));
            }
            if (this.isSpeaking) {
              wsClient.sendBinary(pcm.buffer);
            }
            wsClient.send({ type: 'vad_state', payload: { speaking: false } });
            this.speechEndHandler?.();
          }
          this.allowCurrentUtterance = false;
        },
        onVADMisfire: () => {
          this.isSpeaking = false;
          if (!this.allowCurrentUtterance) return;
          wsClient.send({ type: 'vad_state', payload: { speaking: false } });
          this.allowCurrentUtterance = false;
        },
      });
      const vadSampleRate = this.vad?.audioContext?.sampleRate;
      if (typeof vadSampleRate === 'number' && Number.isFinite(vadSampleRate)) {
        this.inputSampleRate = vadSampleRate;
      }
      this.setupStreamingNodes();
      await this.vad.start();
      this.active = true;
    } catch (err) {
      this.active = false;
      this.errorHandler?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  stop(): void {
    this.vad?.pause();
    this.teardownStreamingNodes();
    this.active = false;
  }

  get isActive(): boolean {
    return this.active;
  }

  setTransmitEnabled(enabled: boolean): void {
    if (this.transmitEnabled === enabled) return;
    this.transmitEnabled = enabled;
    if (enabled) {
      this.speechStartHandler?.();
    } else {
      this.speechEndHandler?.();
    }
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

  private setupStreamingNodes(): void {
    if (!this.streamingMode) return;
    const ctx: AudioContext | undefined = this.vad?.audioContext;
    const stream: MediaStream | undefined = this.vad?.stream;
    if (!ctx || !stream) return;

    this.resampleRatio = this.inputSampleRate / 16000;
    this.resampleTail = new Float32Array(0);
    this.resampleOffset = 0;
    this.pendingLength = 0;

    this.streamSource = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream });
    this.processor = ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      if (!this.transmitEnabled) return;
      const input = event.inputBuffer.getChannelData(0);
      const resampled = this.resampleStream(input);
      this.appendSamples(resampled);
      this.flushChunks();
    };
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.streamSource.connect(this.processor);
    this.processor.connect(this.sink);
    this.sink.connect(ctx.destination);
  }

  private teardownStreamingNodes(): void {
    this.processor?.disconnect();
    this.streamSource?.disconnect();
    this.sink?.disconnect();
    this.processor = null;
    this.streamSource = null;
    this.sink = null;
    this.pendingLength = 0;
    this.resampleTail = new Float32Array(0);
    this.resampleOffset = 0;
  }

  private resampleStream(input: Float32Array): Float32Array {
    if (this.resampleRatio === 1) return input;
    const tailLen = this.resampleTail.length;
    let buffer: Float32Array;
    if (tailLen) {
      buffer = new Float32Array(tailLen + input.length);
      buffer.set(this.resampleTail, 0);
      buffer.set(input, tailLen);
    } else {
      buffer = input;
    }

    const available = buffer.length - this.resampleOffset;
    const outputLength = Math.floor(available / this.resampleRatio);
    if (outputLength <= 0) {
      this.resampleTail = buffer as any;
      return new Float32Array(0);
    }

    const output = new Float32Array(outputLength);
    let idx = this.resampleOffset;
    for (let i = 0; i < outputLength; i += 1) {
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, buffer.length - 1);
      const t = idx - i0;
      output[i] = buffer[i0] * (1 - t) + buffer[i1] * t;
      idx += this.resampleRatio;
    }

    const consumed = Math.floor(idx);
    this.resampleOffset = idx - consumed;
    this.resampleTail = consumed < buffer.length ? buffer.slice(consumed) : new Float32Array(0);
    return output;
  }

  private appendSamples(samples: Float32Array): void {
    if (!samples.length) return;
    const needed = this.pendingLength + samples.length;
    if (this.pending.length < needed) {
      const nextSize = Math.max(needed, this.pending.length * 2 || 2048);
      const next = new Float32Array(nextSize);
      if (this.pendingLength) {
        next.set(this.pending.subarray(0, this.pendingLength), 0);
      }
      this.pending = next;
    }
    this.pending.set(samples, this.pendingLength);
    this.pendingLength += samples.length;
  }

  private flushChunks(): void {
    while (this.pendingLength >= this.chunkSamples) {
      const chunk = this.pending.subarray(0, this.chunkSamples);
      const pcm = new Int16Array(this.chunkSamples);
      for (let i = 0; i < this.chunkSamples; i += 1) {
        pcm[i] = Math.max(-32768, Math.min(32767, Math.round(chunk[i] * 32767)));
      }
      if (this.isSpeaking || this.allowCurrentUtterance) {
        wsClient.sendBinary(pcm.buffer);
      }
      this.pending.copyWithin(0, this.chunkSamples, this.pendingLength);
      this.pendingLength -= this.chunkSamples;
    }
  }

  private resampleToTargetRate(input: Float32Array, inRate: number, outRate: number): Float32Array {
    if (!inRate || inRate === outRate) return input;
    const ratio = inRate / outRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i += 1) {
      const idx = i * ratio;
      const idx0 = Math.floor(idx);
      const idx1 = Math.min(idx0 + 1, input.length - 1);
      const t = idx - idx0;
      output[i] = input[idx0] * (1 - t) + input[idx1] * t;
    }

    return output;
  }
}

export const micCapture = new MicCapture();
