import type { AIState, BossResponse } from '../types/arena';

interface DevConsoleState {
  connected: boolean;
  aiState: AIState;
  sttPartial: string;
  sttFinal: string;
  llmModel: string;
  ttsStatus: string;
  mechanicsLine: string;
  analysis: string;
  error: string | null;
}

export class DevConsole {
  private container: HTMLDivElement;
  private visible = false;
  private state: DevConsoleState = {
    connected: false,
    aiState: 'listening',
    sttPartial: '',
    sttFinal: '',
    llmModel: 'mistral-small-latest',
    ttsStatus: 'idle',
    mechanicsLine: 'none',
    analysis: '',
    error: null,
  };

  constructor(parent: HTMLElement | string) {
    const host = typeof parent === 'string' ? document.getElementById(parent) : parent;
    if (!host) throw new Error(`DevConsole: parent not found (${String(parent)})`);

    const computedPos = window.getComputedStyle(host).position;
    if (computedPos === 'static') host.style.position = 'relative';

    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.left = '8px';
    this.container.style.top = '8px';
    this.container.style.width = '360px';
    this.container.style.zIndex = '80';
    this.container.style.padding = '10px 12px';
    this.container.style.background = 'rgba(8, 10, 18, 0.85)';
    this.container.style.border = '1px solid rgba(120, 140, 200, 0.4)';
    this.container.style.color = '#cdd6ff';
    this.container.style.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    this.container.style.display = 'none';
    this.container.style.pointerEvents = 'none';

    host.appendChild(this.container);
    this.render();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(next: boolean): void {
    this.visible = next;
    this.container.style.display = next ? 'block' : 'none';
  }

  setConnection(connected: boolean): void {
    this.state.connected = connected;
    this.render();
  }

  setAIState(state: AIState): void {
    this.state.aiState = state;
    this.render();
  }

  setSTTPartial(text: string): void {
    this.state.sttPartial = text;
    this.render();
  }

  setSTTFinal(text: string): void {
    this.state.sttFinal = text;
    this.render();
  }

  setBossResponse(response: BossResponse): void {
    this.state.analysis = response.analysis;
    this.state.mechanicsLine = response.mechanics.map((m) => String(m.type)).join(', ');
    this.state.llmModel = this.state.llmModel || 'mistral-small-latest';
    this.render();
  }

  setTTSStatus(status: string): void {
    this.state.ttsStatus = status;
    this.render();
  }

  setError(message: string | null): void {
    this.state.error = message;
    this.render();
  }

  destroy(): void {
    this.container.remove();
  }

  private render(): void {
    const stateColor = this.state.aiState === 'speaking' ? '#ff88aa' : this.state.aiState === 'thinking' ? '#ffee88' : '#66ffcc';
    const conn = this.state.connected ? 'CONNECTED' : 'OFFLINE';
    const err = this.state.error ? `<div style="color:#ff8888">ERROR: ${this.escape(this.state.error)}</div>` : '';

    this.container.innerHTML = `
      <div style="font-weight:600;color:#a6b9ff;margin-bottom:6px;">DEV CONSOLE [F2]</div>
      <div>WS: <span style="color:${this.state.connected ? '#66ffcc' : '#ff6677'}">${conn}</span></div>
      <div>AI STATE: <span style="color:${stateColor}">${this.state.aiState.toUpperCase()}</span></div>
      <div style="margin-top:6px;color:#88aaff">STT ▶ ${this.escape(this.state.sttFinal || this.state.sttPartial || '...')}</div>
      <div style="color:#88ffaa">LLM ▶ ${this.escape(this.state.llmModel)}</div>
      <div style="color:#ffcc88">TTS ▶ ${this.escape(this.state.ttsStatus)}</div>
      <div style="margin-top:6px;color:#ffaaee">MECHANICS ▶ ${this.escape(this.state.mechanicsLine)}</div>
      <div style="color:#cccccc;opacity:0.8;margin-top:4px;">${this.escape(this.state.analysis)}</div>
      ${err}
    `;
  }

  private escape(text: string): string {
    return text.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch] ?? ch));
  }
}
