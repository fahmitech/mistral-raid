import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import http from 'http';
import type { ClientToServerMessage, ServerToClientMessage, Session } from '../types.js';
import * as sessionManager from '../services/sessionManager.js';
import * as telemetryProcessor from '../services/telemetryProcessor.js';
import * as voxtralSTT from '../services/voxtralSTT.js';
import * as mistralService from '../services/mistralService.js';

export function attachWebSocketServer(httpServer: http.Server): void {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket) => {
    const session = sessionManager.createSession(ws);

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        // Complete utterance PCM S16LE 16kHz from VAD onSpeechEnd
        void voxtralSTT.transcribeAndRespond(session, data as Buffer);
      } else {
        let msg: ClientToServerMessage | null = null;
        try {
          msg = JSON.parse(data.toString()) as ClientToServerMessage;
        } catch (err) {
          console.warn('[ws] Failed to parse message:', err);
          return;
        }

        if (!msg) return;
        switch (msg.type) {
          case 'telemetry':
            telemetryProcessor.ingest(session, msg.payload);
            break;
          case 'barge_in':
            sessionManager.handleBargeIn(session);
            break;
          case 'vad_state':
            sessionManager.handleVadState(session, msg.payload.speaking);
            break;
          case 'ANALYZE':
            void mistralService.handleAnalyze(session, msg.payload);
            break;
          default:
            break;
        }
      }
    });

    ws.on('close', () => sessionManager.destroySession(session.id));
    ws.on('error', (err: Error) => console.error(`[ws] session ${session.id} error:`, err));
  });
}

export function sendToClient(session: Session, msg: ServerToClientMessage): void {
  if (session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify(msg));
  }
}
