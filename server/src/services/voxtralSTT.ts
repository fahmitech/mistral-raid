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

export async function transcribeAndRespond(session: Session, utteranceBuffer: Buffer): Promise<void> {
  if (!ENABLE_AI_SPEECH) return;
  if (session.turnState === 'THINKING' || session.turnState === 'AI_SPEAKING') return;
  if (!canStartBossReply(session)) return;

  setTurnState(session, 'USER_SPEAKING');
  session.partialTranscript = '';
  session.stableTranscript = '';

  let finalTranscript = '';

  try {
    for await (const event of getClient().transcribeStream(
      singleUtteranceStream(utteranceBuffer),
      'voxtral-mini-transcribe-realtime-2602',
      { audioFormat: { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 } }
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
        finalTranscript = session.partialTranscript.trim();
        session.stableTranscript = finalTranscript;
        session.lastSpeechEndTime = Date.now();
        if (ENABLE_CAPTIONS) {
          sendToClient(session, { type: 'captions_final', payload: { text: finalTranscript } });
        }
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
    setTurnState(session, 'LISTENING');
    return;
  }

  const wordCount = finalTranscript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4 || !canStartBossReply(session)) {
    setTurnState(session, 'LISTENING');
    return;
  }

  setTurnState(session, 'THINKING');
  const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session);
  sendToClient(session, { type: 'BOSS_RESPONSE', payload: bossResponse });
  setTurnState(session, 'AI_SPEAKING');
  void synthesizeBossVoice(session, bossResponse.taunt);
  session.partialTranscript = '';
}
