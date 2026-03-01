import { randomUUID } from 'crypto';
import type { Session, TurnState } from '../types.js';
import { sendToClient } from '../ws/WebSocketServer.js';
import { startDirector, stopDirector } from './aiDirector.js';
import { emit, makeEvent } from './telemetry.js';
import type { WebSocket } from 'ws';

const sessions = new Map<string, Session>();

const BOSS_REPLY_COOLDOWN_MS = Number(process.env.BOSS_REPLY_COOLDOWN_MS ?? 4000);
const ENABLE_AI_SPEECH = process.env.ENABLE_AI_SPEECH !== 'false';

export function createSession(ws: WebSocket): Session {
  const id = randomUUID();
  const session: Session = {
    id,
    turnState: 'LISTENING',
    aiState: 'listening',
    partialTranscript: '',
    stableTranscript: '',
    latestTelemetrySummary: null,
    rollingDebateNotes: '',
    activeLLMAbort: null,
    activeTTSAbort: null,
    lastSpeechEndTime: 0,
    lastBossSpeechTime: 0,
    ws,
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
  };

  sessions.set(id, session);
  emit(makeEvent(id, 'session', 'session.created', {}));
  startDirector(session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function destroySession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  stopDirector(session);
  session.activeLLMAbort?.abort();
  session.activeTTSAbort?.abort();
  session.sttStream?.queue.close();
  emit(makeEvent(id, 'session', 'session.destroyed', { durationMs: 0 }));
  sessions.delete(id);
}

export function setTurnState(session: Session, state: TurnState): void {
  const from = session.turnState;
  session.turnState = state;
  const aiState = state === 'THINKING' ? 'thinking' : state === 'AI_SPEAKING' ? 'speaking' : 'listening';
  session.aiState = aiState;
  emit(makeEvent(session.id, 'session', 'session.state.change', { from, to: state }));
  sendToClient(session, { type: 'ai_state', payload: { state: aiState } });
}

export function handleBargeIn(session: Session): void {
  session.activeLLMAbort?.abort();
  session.activeTTSAbort?.abort();
  session.activeLLMAbort = null;
  session.activeTTSAbort = null;
  session.sttStream?.queue.close();
  session.sttStream = null;
  setTurnState(session, 'LISTENING');
}

export function handleVadState(session: Session, isSpeaking: boolean): void {
  if (!ENABLE_AI_SPEECH) return;
  setTurnState(session, isSpeaking ? 'USER_SPEAKING' : 'USER_PAUSED');
}

export function canStartBossReply(session: Session): boolean {
  if (!ENABLE_AI_SPEECH) return false;
  if (session.turnState === 'THINKING' || session.turnState === 'AI_SPEAKING') return false;
  if (Date.now() - session.lastBossSpeechTime < BOSS_REPLY_COOLDOWN_MS) return false;
  return true;
}
