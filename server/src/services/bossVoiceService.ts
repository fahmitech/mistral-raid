import WebSocket from 'ws';
import type { RawData } from 'ws';
import type { Session } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { setTurnState } from './sessionManager.js';

const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';
const ENABLE_STREAMING_TTS = process.env.ENABLE_STREAMING_TTS !== 'false';
// Time to first audio chunk before aborting (ms). Keep generous for cold starts.
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 2500);
const WARM_SOCKET_TTL_MS = 8000;

const BOSS_VOICE = {
  model_id: 'eleven_flash_v2_5',
  voice_id: process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB',
  voice_settings: {
    stability: 0.3,
    similarity_boost: 0.8,
    style: 0.5,
    speed: 0.9,
  },
  output_format: 'mp3_44100_128',
};

interface WarmSocket {
  ws: WebSocket;
  ready: Promise<void>;
  created: number;
  timeout: ReturnType<typeof setTimeout>;
}

let warmSocket: WarmSocket | null = null;

function getApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  return key;
}

function buildTtsUrl(): string {
  return `wss://api.elevenlabs.io/v1/text-to-speech/${BOSS_VOICE.voice_id}/stream-input` +
    `?model_id=${encodeURIComponent(BOSS_VOICE.model_id)}` +
    `&output_format=${encodeURIComponent(BOSS_VOICE.output_format)}`;
}

function discardWarmSocket(entry: WarmSocket): void {
  clearTimeout(entry.timeout);
  try {
    entry.ws.close();
  } catch {
    // best-effort cleanup
  }
}

function isWarmSocketFresh(entry: WarmSocket): boolean {
  if (Date.now() - entry.created >= WARM_SOCKET_TTL_MS) return false;
  return entry.ws.readyState === WebSocket.OPEN || entry.ws.readyState === WebSocket.CONNECTING;
}

export function warmup(): void {
  if (!ENABLE_AI_SPEECH) return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  if (warmSocket && isWarmSocketFresh(warmSocket)) return;
  if (warmSocket) {
    const stale = warmSocket;
    warmSocket = null;
    discardWarmSocket(stale);
  }

  const url = buildTtsUrl();
  const ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });
  const ready = new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const timeout = setTimeout(() => {
    const current = warmSocket;
    if (current && current.ws === ws) {
      warmSocket = null;
      discardWarmSocket(current);
    }
  }, WARM_SOCKET_TTL_MS);

  warmSocket = { ws, ready, created: Date.now(), timeout };
  void ready.catch((err) => {
    const current = warmSocket;
    if (!current || current.ws !== ws) return;
    console.warn('[tts] Warm socket failed:', err);
    warmSocket = null;
    discardWarmSocket(current);
  });
}

async function acquireSocket(apiKey: string): Promise<{ ws: WebSocket; warmed: boolean }> {
  const existing = warmSocket;
  if (existing) {
    if (isWarmSocketFresh(existing)) {
      warmSocket = null;
      clearTimeout(existing.timeout);
      try {
        await existing.ready;
      } catch (err) {
        console.warn('[tts] Warm socket open failed, falling back:', err);
      }
      if (existing.ws.readyState === WebSocket.OPEN) {
        existing.ws.removeAllListeners();
        return { ws: existing.ws, warmed: true };
      }
    }
    warmSocket = null;
    discardWarmSocket(existing);
  }

  const url = buildTtsUrl();
  const ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return { ws, warmed: false };
}

export async function synthesize(session: Session, tauntText: string): Promise<void> {
  if (!ENABLE_AI_SPEECH) {
    setTurnState(session, 'LISTENING');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[tts] ELEVENLABS_API_KEY not set');
    setTurnState(session, 'LISTENING');
    return;
  }

  const controller = new AbortController();
  session.activeTTSAbort = controller;

  let receivedAudio = false;
  const timeout = setTimeout(() => {
    if (!receivedAudio) {
      console.warn('[tts] Timeout waiting for first audio chunk');
      controller.abort();
    }
  }, TTS_TIMEOUT_MS);

  const audioChunks: Buffer[] = [];
  let sentFirstChunk = false;

  let ws: WebSocket;
  let warmed = false;
  try {
    const acquired = await acquireSocket(apiKey);
    ws = acquired.ws;
    warmed = acquired.warmed;
  } catch (err) {
    clearTimeout(timeout);
    session.activeTTSAbort = null;
    console.warn('[tts] Failed to open ElevenLabs WS:', err);
    setTurnState(session, 'LISTENING');
    return;
  }

  console.log(`[tts] ${warmed ? 'using warm socket' : 'cold connect'}`);

  await new Promise<void>((resolve) => {
    let finalized = false;
    const cleanup = () => {
      clearTimeout(timeout);
      session.activeTTSAbort = null;
    };

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      cleanup();
      if (ENABLE_STREAMING_TTS) {
        if (!controller.signal.aborted) {
          sendToClient(session, { type: 'AUDIO_DONE', payload: { format: 'mp3' } });
        }
      } else {
        if (!controller.signal.aborted && audioChunks.length > 0) {
          const audioBase64 = Buffer.concat(audioChunks).toString('base64');
          sendToClient(session, { type: 'AUDIO_READY', payload: { audioBase64, format: 'mp3' } });
          session.lastBossSpeechTime = Date.now();
        } else if (!audioChunks.length) {
          console.warn('[tts] No audio chunks received');
        }
      }
      setTurnState(session, 'LISTENING');
      resolve();
    };

    controller.signal.addEventListener('abort', () => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (controller.signal.aborted) return;

      try {
        if (!isBinary) {
          const text = typeof data === 'string' ? data : data.toString();
          const msg = JSON.parse(text) as { audio?: string; isFinal?: boolean };
          if (msg.audio) {
            if (ENABLE_STREAMING_TTS) {
              sendToClient(session, { type: 'AUDIO_CHUNK', payload: { audioBase64: msg.audio, format: 'mp3' } });
              if (!sentFirstChunk) {
                sentFirstChunk = true;
                session.lastBossSpeechTime = Date.now();
              }
            } else {
              audioChunks.push(Buffer.from(msg.audio, 'base64'));
            }
            receivedAudio = true;
            clearTimeout(timeout);
          }
          if (msg.isFinal) ws.close();
          return;
        }

        if (Buffer.isBuffer(data)) {
          if (ENABLE_STREAMING_TTS) {
            sendToClient(session, { type: 'AUDIO_CHUNK', payload: { audioBase64: data.toString('base64'), format: 'mp3' } });
            if (!sentFirstChunk) {
              sentFirstChunk = true;
              session.lastBossSpeechTime = Date.now();
            }
          } else {
            audioChunks.push(data);
          }
          receivedAudio = true;
          clearTimeout(timeout);
          return;
        }

        if (data instanceof ArrayBuffer) {
          const buf = Buffer.from(data);
          if (ENABLE_STREAMING_TTS) {
            sendToClient(session, { type: 'AUDIO_CHUNK', payload: { audioBase64: buf.toString('base64'), format: 'mp3' } });
            if (!sentFirstChunk) {
              sentFirstChunk = true;
              session.lastBossSpeechTime = Date.now();
            }
          } else {
            audioChunks.push(buf);
          }
          receivedAudio = true;
          clearTimeout(timeout);
          return;
        }

        if (Array.isArray(data)) {
          if (ENABLE_STREAMING_TTS) {
            data.forEach((chunk) => {
              sendToClient(session, { type: 'AUDIO_CHUNK', payload: { audioBase64: chunk.toString('base64'), format: 'mp3' } });
            });
            if (!sentFirstChunk && data.length) {
              sentFirstChunk = true;
              session.lastBossSpeechTime = Date.now();
            }
          } else {
            data.forEach((chunk) => audioChunks.push(chunk));
          }
          if (data.length) {
            receivedAudio = true;
            clearTimeout(timeout);
          }
        }
      } catch (err) {
        console.warn('[tts] Failed to parse ElevenLabs message:', err);
      }
    });

    ws.on('close', () => finalize());
    ws.on('error', (err: Error) => {
      console.warn('[tts] ElevenLabs WS error:', err);
      finalize();
    });

    const initPayload = {
      text: ' ',
      model_id: BOSS_VOICE.model_id,
      output_format: BOSS_VOICE.output_format,
      voice_settings: BOSS_VOICE.voice_settings,
    };
    ws.send(JSON.stringify(initPayload));
    ws.send(JSON.stringify({ text: tauntText }));
    ws.send(JSON.stringify({ text: '', flush: true }));
  });
}
