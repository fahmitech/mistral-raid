import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import http from 'http';
import type { ClientToServerMessage, ServerToClientMessage, Session } from '../types.js';
import * as sessionManager from '../services/sessionManager.js';
import * as telemetryProcessor from '../services/telemetryProcessor.js';
import * as voxtralSTT from '../services/voxtralSTT.js';
import * as mistralService from '../services/mistralService.js';
import { queryCompanion } from '../agents/gameCompanionAgent.js';
import { buildPlayerProfile } from '../services/playerProfile.js';

export function attachWebSocketServer(httpServer: http.Server): void {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket) => {
    const session = sessionManager.createSession(ws);
    voxtralSTT.prewarmConnection(session);

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        // Streaming chunks if active; otherwise treat as full utterance
        const buf = data as Buffer;
        const handled = voxtralSTT.pushStreamingAudio(session, buf);
        if (!handled && buf.length >= 3200) {
          void voxtralSTT.transcribeAndRespond(session, buf);
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
          case 'LIVE_TELEMETRY':
            void (async () => {
              try {
                const directive = await mistralService.generateDirective(session, msg.payload);
                if (!directive) return;
                if (msg.payload.context === 'arena' && directive.boss) {
                  sendToClient(session, { type: 'BOSS_DIRECTIVE', payload: directive.boss });
                }
                if (msg.payload.context === 'dungeon' && directive.enemies) {
                  sendToClient(session, { type: 'ENEMY_DIRECTIVE', payload: directive.enemies });
                }
              } catch (err) {
                console.error('[ws] directive generation error:', err);
              }
            })();
            break;
          case 'AI_ASSISTANT_QUERY':
            void (async () => {
              try {
                // Enrich context with server-side story state and profile (RM-6)
                const enrichedContext = {
                  ...msg.payload.context,
                  loreDiscovered: session.loreDiscovered,
                  bossHistory: session.bossHistory,
                };

                if (session.latestTelemetrySummary) {
                  const profile = buildPlayerProfile(session.latestTelemetrySummary);
                  enrichedContext.playerProfile = profile;
                }

                const reply = await queryCompanion(msg.payload.message, enrichedContext);
                sendToClient(session, { type: 'AI_ASSISTANT_REPLY', payload: reply });
              } catch (err) {
                console.error('[ws] companion query error:', err);
              }
            })();
            break;
          default:
            break;
        }
      }
    });

    ws.on('close', () => {
      voxtralSTT.clearWarmConnection(session.id);
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
