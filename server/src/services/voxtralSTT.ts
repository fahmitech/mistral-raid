import { RealtimeTranscription, AudioEncoding } from '@mistralai/mistralai/extra/realtime/index.js';
import type { Session } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { canStartBossReply, setTurnState } from './sessionManager.js';
import { generateBossReply } from './mistralService.js';
import { synthesize as synthesizeBossVoice } from './bossVoiceService.js';

const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';
const ENABLE_CAPTIONS = process.env.ENABLE_CAPTIONS !== 'false';
const STT_TARGET_DELAY_MS = Number(process.env.STT_TARGET_DELAY_MS ?? 160);

let client: RealtimeTranscription | null = null;

class AudioChunkQueue implements AsyncIterable<Uint8Array> {
  private queue: Uint8Array[] = [];
  private resolvers: Array<(value: IteratorResult<Uint8Array>) => void> = [];
  private closed = false;

  push(chunk: Uint8Array): void {
    if (this.closed) return;
    if (this.resolvers.length) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: chunk, done: false });
      return;
    }
    this.queue.push(chunk);
  }

  close(): void {
    this.closed = true;
    while (this.resolvers.length) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: undefined as unknown as Uint8Array, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return {
      next: () => {
        if (this.queue.length) {
          const value = this.queue.shift()!;
          return Promise.resolve({ value, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as Uint8Array, done: true });
        }
        return new Promise<IteratorResult<Uint8Array>>((resolve) => this.resolvers.push(resolve));
      },
    };
  }
}

function getClient(): RealtimeTranscription {
  if (client) return client;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }
  client = new RealtimeTranscription({ apiKey });
  return client;
}

async function* singleUtteranceStream(buffer: Buffer): AsyncGenerator<Uint8Array> {
  yield new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function startStreaming(session: Session): void {
  if (!ENABLE_AI_SPEECH) return;
  if (session.sttStream) return;

  const queue = new AudioChunkQueue();
  session.sttStream = { queue, task: null, finalTranscript: '' };
  setTurnState(session, 'USER_SPEAKING');
  session.partialTranscript = '';
  session.stableTranscript = '';

  session.sttStream.task = (async () => {
    try {
      for await (const event of getClient().transcribeStream(
        queue,
        'voxtral-mini-transcribe-realtime-2602',
        {
          audioFormat: { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 },
          targetStreamingDelayMs: STT_TARGET_DELAY_MS,
        }
      )) {
        if (event.type === 'transcription.text.delta') {
          const delta = (event as { text?: string; delta?: string }).text ?? (event as { delta?: string }).delta ?? '';
          if (delta) {
            session.partialTranscript += delta;
            if (ENABLE_CAPTIONS) {
              sendToClient(session, { type: 'captions_partial', payload: { text: session.partialTranscript } });
            }
          }
        }
        if (event.type === 'transcription.done') {
          const finalTranscript = session.partialTranscript.trim();
          session.stableTranscript = finalTranscript;
          session.lastSpeechEndTime = Date.now();
          if (session.sttStream) {
            session.sttStream.finalTranscript = finalTranscript;
          }
          if (ENABLE_CAPTIONS) {
            sendToClient(session, { type: 'captions_final', payload: { text: finalTranscript } });
          }
          break;
        }
        if (event.type === 'error') {
          console.warn('[stt] Voxtral error event:', event);
          break;
        }
      }
    } catch (err) {
      console.warn('[stt] Voxtral stream error:', err);
    }
  })();
}

export function pushStreamingAudio(session: Session, chunk: Buffer): boolean {
  if (!session.sttStream) return false;
  session.sttStream.queue.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  return true;
}

export async function stopStreaming(session: Session): Promise<void> {
  const stt = session.sttStream;
  if (!stt) return;
  stt.queue.close();
  if (stt.task) {
    await stt.task;
  }
  const finalTranscript = stt.finalTranscript.trim();
  session.sttStream = null;

  if (!finalTranscript) {
    setTurnState(session, 'LISTENING');
    return;
  }

  const wordCount = finalTranscript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || !canStartBossReply(session)) {
    setTurnState(session, 'LISTENING');
    return;
  }

  setTurnState(session, 'THINKING');
  const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session, true);
  sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
  setTurnState(session, 'AI_SPEAKING');
  void synthesizeBossVoice(session, bossResponse.taunt);
  session.partialTranscript = '';
}

export async function transcribeAndRespond(session: Session, utteranceBuffer: Buffer): Promise<void> {
  if (!ENABLE_AI_SPEECH) {
    console.warn('[stt] ENABLE_AI_SPEECH=false; skipping transcription');
    return;
  }

  console.log(`[stt] start bytes=${utteranceBuffer.length}`);

  setTurnState(session, 'USER_SPEAKING');
  session.partialTranscript = '';
  session.stableTranscript = '';

  let finalTranscript = '';
  let sawDelta = false;

  try {
    for await (const event of getClient().transcribeStream(
      singleUtteranceStream(utteranceBuffer),
      'voxtral-mini-transcribe-realtime-2602',
      {
        audioFormat: { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 },
        targetStreamingDelayMs: STT_TARGET_DELAY_MS,
      }
    )) {
      if (event.type === 'transcription.text.delta') {
        const delta = (event as { text?: string; delta?: string }).text ?? (event as { delta?: string }).delta ?? '';
        if (delta) {
          if (!sawDelta) {
            sawDelta = true;
            console.log('[stt] first delta received');
          }
          session.partialTranscript += delta;
          if (ENABLE_CAPTIONS) {
            sendToClient(session, { type: 'captions_partial', payload: { text: session.partialTranscript } });
          }
        }
      }
      if (event.type === 'transcription.done') {
        finalTranscript = session.partialTranscript.trim();
        session.stableTranscript = finalTranscript;
        session.lastSpeechEndTime = Date.now();
        if (ENABLE_CAPTIONS) {
          sendToClient(session, { type: 'captions_final', payload: { text: finalTranscript } });
        }
        console.log('[stt] done chars=', finalTranscript.length);
        break;
      }
      if (event.type === 'error') {
        console.warn('[stt] Voxtral error event:', event);
        setTurnState(session, 'LISTENING');
        return;
      }
    }
  } catch (err) {
    console.warn('[stt] Voxtral stream error:', err);
    setTurnState(session, 'LISTENING');
    return;
  }

  if (!finalTranscript) {
    console.warn('[stt] empty transcript');
    setTurnState(session, 'LISTENING');
    return;
  }

  const wordCount = finalTranscript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || !canStartBossReply(session)) {
    setTurnState(session, 'LISTENING');
    return;
  }

  setTurnState(session, 'THINKING');
  const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session, true);
  sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
  setTurnState(session, 'AI_SPEAKING');
  void synthesizeBossVoice(session, bossResponse.taunt);
  session.partialTranscript = '';
}
