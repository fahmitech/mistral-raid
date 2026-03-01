import type { ClientMessage, ServerMessage } from '../types/arena';

type MessageHandler = (msg: ServerMessage) => void;

type StatusHandler = (connected: boolean) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url = '';
  private handlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private retries = 0;
  private maxRetries = 3;
  private intentionallyClosed = false;

  connect(url?: string): void {
    const target = url ?? this.url ?? '';
    if (!target) return;
    this.url = target;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.intentionallyClosed = false;
    this.ws = new WebSocket(this.url);

    this.ws.addEventListener('open', () => {
      this.retries = 0;
      this.emitStatus(true);
    });

    this.ws.addEventListener('message', (event) => {
      if (event.data instanceof Blob) {
        // Server never sends binary blobs in this protocol.
        return;
      }

      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.handlers.forEach((handler) => handler(msg));
      } catch (err) {
        console.warn('[ws] Failed to parse message', err);
      }
    });

    this.ws.addEventListener('close', () => {
      this.emitStatus(false);
      if (this.intentionallyClosed) return;
      if (this.retries < this.maxRetries) {
        this.retries += 1;
        window.setTimeout(() => this.connect(this.url), 1000);
      }
    });

    this.ws.addEventListener('error', () => {
      // close will trigger reconnect if needed
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[ws] send failed: socket not open');
    }
  }

  sendBinary(data: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('[ws] sendBinary failed: socket not open');
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.ws) this.ws.close();
  }

  get isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private emitStatus(connected: boolean): void {
    this.statusHandlers.forEach((handler) => handler(connected));
  }
}

export const wsClient = new WebSocketClient();
