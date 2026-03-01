import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import http from 'http';
import type { ClientToServerMessage, ServerToClientMessage, Session } from '../types.js';
import * as sessionManager from '../services/sessionManager.js';
import * as telemetryProcessor from '../services/telemetryProcessor.js';
import * as voxtralSTT from '../services/voxtralSTT.js';
import * as mistralService from '../services/mistralService.js';
import { emit, makeEvent } from '../services/telemetry.js';
import type { TelemetryCategory } from '../types/telemetryEvents.js';

export function attachWebSocketServer(httpServer: http.Server): void {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket) => {
    const session = sessionManager.createSession(ws);
    emit(makeEvent(session.id, 'ws', 'ws.connection', {}));

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        emit(makeEvent(session.id, 'ws', 'ws.message.in', {
          messageType: 'binary_audio', isBinary: true,
          sizeBytes: (data as Buffer).length,
        }));
        // Streaming chunks if active; otherwise treat as full utterance
        const handled = voxtralSTT.pushStreamingAudio(session, data as Buffer);
        if (!handled) {
          void voxtralSTT.transcribeAndRespond(session, data as Buffer);
        }
      } else {
        let msg: ClientToServerMessage | null = null;
        try {
          msg = JSON.parse(data.toString()) as ClientToServerMessage;
        } catch (err) {
          console.warn('[ws] Failed to parse message:', err);
          return;
        }

        if (!msg) return;
        if (msg.type !== 'telemetry' && msg.type !== 'game_telemetry') {
          emit(makeEvent(session.id, 'ws', 'ws.message.in', {
            messageType: msg.type, isBinary: false,
          }));
        }
        switch (msg.type) {
          case 'telemetry':
            telemetryProcessor.ingest(session, msg.payload);
            break;
          case 'barge_in':
            sessionManager.handleBargeIn(session);
            break;
          case 'vad_state':
            sessionManager.handleVadState(session, msg.payload.speaking);
            if (msg.payload.speaking) {
              voxtralSTT.startStreaming(session);
            } else {
              void voxtralSTT.stopStreaming(session);
            }
            break;
          case 'ANALYZE':
            void mistralService.handleAnalyze(session, msg.payload);
            break;
          case 'game_telemetry':
            // Client-side game events — batch them into the server telemetry system
            if (msg.payload && Array.isArray(msg.payload.events)) {
              for (const evt of msg.payload.events) {
                telemetryProcessor.trackGameEvent(session, evt);
                emit({
                  id: '',
                  timestamp: Date.now(),
                  sessionId: session.id,
                  category: ((evt.category as string) ?? 'game') as TelemetryCategory,
                  type: ((evt.type as string) ?? 'game.player.action'),
                  data: (evt.data as Record<string, unknown>) ?? {},
                } as Parameters<typeof emit>[0]);
              }
            }
            break;
          default:
            break;
        }
      }
    });

    ws.on('close', () => {
      emit(makeEvent(session.id, 'ws', 'ws.disconnect', { sessionDurationMs: 0 }));
      sessionManager.destroySession(session.id);
    });
    ws.on('error', (err: Error) => console.error(`[ws] session ${session.id} error:`, err));
  });
}

export function sendToClient(session: Session, msg: ServerToClientMessage): void {
  if (session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify(msg));
  }
}
