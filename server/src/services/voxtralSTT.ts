import { RealtimeTranscription, AudioEncoding, RealtimeConnection, type RealtimeEvent } from '@mistralai/mistralai/extra/realtime/index.js';
import type { Session } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { canStartBossReply, setTurnState } from './sessionManager.js';
import { generateBossReply } from './mistralService.js';
import { synthesize as synthesizeBossVoice, warmup as warmupBossVoice } from './bossVoiceService.js';

const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';
const ENABLE_CAPTIONS = process.env.ENABLE_CAPTIONS !== 'false';
const STT_MODEL = 'voxtral-mini-transcribe-realtime-2602';
const STT_AUDIO_FORMAT = { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 };
const STT_WARM_CONN_TTL_MS = 8000;
const MIN_UTTERANCE_BYTES = 3200; // 200ms @ 16kHz S16LE — shorter is untranscribable

let client: RealtimeTranscription | null = null;
const warmConnections = new Map<string, { connection: RealtimeConnection; createdAt: number }>();
const warmConnectionPending = new Map<string, Promise<RealtimeConnection | null>>();

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

function isWarmConnectionFresh(entry: { connection: RealtimeConnection; createdAt: number }): boolean {
  return !entry.connection.isClosed && Date.now() - entry.createdAt < STT_WARM_CONN_TTL_MS;
}

async function openConnection(): Promise<RealtimeConnection> {
  return getClient().connect(STT_MODEL, { audioFormat: STT_AUDIO_FORMAT });
}

function discardWarmConnection(sessionId: string): void {
  const entry = warmConnections.get(sessionId);
  if (!entry) return;
  warmConnections.delete(sessionId);
  try {
    void entry.connection.close();
  } catch {
    // Best-effort cleanup.
  }
}

export function clearWarmConnection(sessionId: string): void {
  discardWarmConnection(sessionId);
  warmConnectionPending.delete(sessionId);
}

export function prewarmConnection(session: Session): void {
  if (!ENABLE_AI_SPEECH) return;
  const existing = warmConnections.get(session.id);
  if (existing && isWarmConnectionFresh(existing)) return;
  if (warmConnectionPending.has(session.id)) return;
  if (existing) {
    discardWarmConnection(session.id);
  }

  const pending = openConnection()
    .then((connection) => {
      warmConnections.set(session.id, { connection, createdAt: Date.now() });
      console.log('[stt] Voxtral connection pre-warmed');
      return connection;
    })
    .catch((err) => {
      console.warn('[stt] Voxtral prewarm failed (non-fatal):', err);
      return null;
    })
    .finally(() => {
      warmConnectionPending.delete(session.id);
    });

  warmConnectionPending.set(session.id, pending);
}

async function acquireConnection(session: Session): Promise<RealtimeConnection> {
  const entry = warmConnections.get(session.id);
  if (entry && isWarmConnectionFresh(entry)) {
    warmConnections.delete(session.id);
    console.log('[stt] Using warm Voxtral connection');
    return entry.connection;
  }
  if (entry) {
    discardWarmConnection(session.id);
  }

  const pending = warmConnectionPending.get(session.id);
  if (pending) {
    const warmed = await pending;
    const refreshed = warmConnections.get(session.id);
    if (warmed && refreshed && isWarmConnectionFresh(refreshed)) {
      warmConnections.delete(session.id);
      console.log('[stt] Using warm Voxtral connection (awaited)');
      return refreshed.connection;
    }
  }

  console.log('[stt] Using cold Voxtral connection');
  const connection = await openConnection();
  return connection;
}

async function* transcribeWithConnection(
  connection: RealtimeConnection,
  audioStream: AsyncIterable<Uint8Array>
): AsyncGenerator<RealtimeEvent> {
  const iterator = audioStream[Symbol.asyncIterator]();
  const iterable = { [Symbol.asyncIterator]: () => iterator };
  let stopRequested = false;
  let sentAnyAudio = false;
  const sendAudioTask = (async () => {
    try {
      for await (const chunk of iterable) {
        if (stopRequested || connection.isClosed) break;
        await connection.sendAudio(chunk);
        sentAnyAudio = true;
      }
    } finally {
      if (!connection.isClosed && sentAnyAudio) {
        await connection.flushAudio();
        await connection.endAudio();
      } else if (!connection.isClosed) {
        // No audio was ever sent — close connection to unblock the event loop.
        // Without this, `for await (event of connection)` hangs forever
        // because Voxtral has nothing to transcribe and never sends events.
        await connection.close();
      }
    }
  })();

  try {
    for await (const event of connection) {
      yield event;
      if (event.type === 'transcription.done') break;
      if (event.type === 'error') break;
    }
  } finally {
    stopRequested = true;
    await connection.close();
    await sendAudioTask;
    const maybeReturn = iterator.return;
    if (typeof maybeReturn === 'function') {
      await maybeReturn.call(iterator);
    }
  }
}

async function* singleUtteranceStream(buffer: Buffer): AsyncGenerator<Uint8Array> {
  yield new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function startStreaming(session: Session): void {
  if (!ENABLE_AI_SPEECH) return;

  // If a stale stream exists, force-close it so we can start fresh.
  if (session.sttStream) {
    console.warn('[stt] Clearing stale sttStream before starting new one');
    session.sttStream.queue.close();
    session.sttStream = null;
  }

  const queue = new AudioChunkQueue();
  const stt = { queue, task: null as Promise<void> | null, finalTranscript: '' };
  session.sttStream = stt;
  setTurnState(session, 'USER_SPEAKING');
  session.partialTranscript = '';
  session.stableTranscript = '';

  stt.task = (async () => {
    try {
      const connection = await acquireConnection(session);
      for await (const event of transcribeWithConnection(connection, queue)) {
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
          stt.finalTranscript = finalTranscript;
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
  // Null immediately so startStreaming can create a new stream
  // while we await the task / LLM / TTS below.
  session.sttStream = null;
  stt.queue.close();
  if (stt.task) {
    await stt.task;
  }
  const finalTranscript = stt.finalTranscript.trim();

  if (!finalTranscript) {
    setTurnState(session, 'LISTENING');
    prewarmConnection(session);
    return;
  }

  const wordCount = finalTranscript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || !canStartBossReply(session)) {
    setTurnState(session, 'LISTENING');
    prewarmConnection(session);
    return;
  }

  setTurnState(session, 'THINKING');
  warmupBossVoice();
  const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session, true);
  sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
  setTurnState(session, 'AI_SPEAKING');
  void synthesizeBossVoice(session, bossResponse.taunt);
  session.partialTranscript = '';
  prewarmConnection(session);
}

export async function transcribeAndRespond(session: Session, utteranceBuffer: Buffer): Promise<void> {
  if (!ENABLE_AI_SPEECH) {
    console.warn('[stt] ENABLE_AI_SPEECH=false; skipping transcription');
    return;
  }

  if (utteranceBuffer.length < MIN_UTTERANCE_BYTES) {
    return;
  }

  console.log(`[stt] start bytes=${utteranceBuffer.length}`);

  setTurnState(session, 'USER_SPEAKING');
  session.partialTranscript = '';
  session.stableTranscript = '';

  let finalTranscript = '';
  let sawDelta = false;

  try {
    const connection = await acquireConnection(session);
    for await (const event of transcribeWithConnection(connection, singleUtteranceStream(utteranceBuffer))) {
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
        prewarmConnection(session);
        return;
      }
    }
  } catch (err) {
    console.warn('[stt] Voxtral stream error:', err);
    setTurnState(session, 'LISTENING');
    prewarmConnection(session);
    return;
  }

  if (!finalTranscript) {
    console.warn('[stt] empty transcript');
    setTurnState(session, 'LISTENING');
    prewarmConnection(session);
    return;
  }

  const wordCount = finalTranscript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || !canStartBossReply(session)) {
    setTurnState(session, 'LISTENING');
    prewarmConnection(session);
    return;
  }

  setTurnState(session, 'THINKING');
  warmupBossVoice();
  const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session, true);
  sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
  setTurnState(session, 'AI_SPEAKING');
  void synthesizeBossVoice(session, bossResponse.taunt);
  session.partialTranscript = '';
  prewarmConnection(session);
}
