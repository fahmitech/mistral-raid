import WebSocket from 'ws';
import type { RawData } from 'ws';
import type { Session } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { setTurnState } from './sessionManager.js';

const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 1000);

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

function getApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  return key;
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

  const timeout = setTimeout(() => {
    controller.abort();
  }, TTS_TIMEOUT_MS);

  const url = `wss://api.elevenlabs.io/v1/text-to-speech/${BOSS_VOICE.voice_id}/stream-input` +
    `?model_id=${encodeURIComponent(BOSS_VOICE.model_id)}` +
    `&output_format=${encodeURIComponent(BOSS_VOICE.output_format)}`;

  const audioChunks: Buffer[] = [];

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(url, {
      headers: { 'xi-api-key': apiKey },
    });

    const cleanup = () => {
      clearTimeout(timeout);
      session.activeTTSAbort = null;
    };

    const finalize = () => {
      cleanup();
      if (!controller.signal.aborted && audioChunks.length > 0) {
        const audioBase64 = Buffer.concat(audioChunks).toString('base64');
        sendToClient(session, { type: 'AUDIO_READY', payload: { audioBase64, format: 'mp3' } });
        session.lastBossSpeechTime = Date.now();
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

    ws.on('open', () => {
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

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (controller.signal.aborted) return;

      try {
        if (!isBinary) {
          const text = typeof data === 'string' ? data : data.toString();
          const msg = JSON.parse(text) as { audio?: string; isFinal?: boolean };
          if (msg.audio) audioChunks.push(Buffer.from(msg.audio, 'base64'));
          if (msg.isFinal) ws.close();
          return;
        }

        if (Buffer.isBuffer(data)) {
          audioChunks.push(data);
          return;
        }

        if (data instanceof ArrayBuffer) {
          audioChunks.push(Buffer.from(data));
          return;
        }

        if (Array.isArray(data)) {
          data.forEach((chunk) => audioChunks.push(chunk));
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
  });
}
