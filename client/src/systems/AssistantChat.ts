import { wsClient } from '../network/WebSocketClient';
import type { CompanionContext, CompanionReply } from '../types/arena';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

const SUGGESTIONS = [
  { label: 'Where is the boss?', msg: 'Where is the boss?' },
  { label: 'Where are enemies?', msg: 'Where are the enemies?' },
  { label: 'Find treasure',      msg: 'Where is the nearest treasure?' },
  { label: 'Am I safe?',         msg: 'Am I safe right now?' },
  { label: 'Enemy count?',       msg: 'How many enemies are left?' },
];

const MAX_MESSAGES = 12;

export class AssistantChat {
  private panel: HTMLDivElement;
  private tab: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private voiceBtn!: HTMLButtonElement;
  private sendBtn!: HTMLButtonElement;
  private suggestionsEl!: HTMLDivElement;
  private voiceRow!: HTMLDivElement;
  private inputRow!: HTMLDivElement;
  private activationOverlay?: HTMLDivElement;
  private visible = false;
  private activated = false;
  private messages: ChatMessage[] = [];
  private pendingMessages: ChatMessage[] = [];
  private contextFn: () => CompanionContext;
  private removeHandler: (() => void) | null = null;
  private voiceController: import('./VoiceController').VoiceController | null = null;

  constructor(contextFn: () => CompanionContext) {
    this.contextFn = contextFn;
    this.tab = this.buildTab();
    this.panel = this.buildPanel();
    document.body.appendChild(this.tab);
    document.body.appendChild(this.panel);

    this.removeHandler = wsClient.onMessage((msg) => {
      if (msg.type === 'AI_ASSISTANT_REPLY') {
        this.handleReply(msg.payload as CompanionReply);
      }
    });

    // Lazy-load VoiceController to avoid loading MediaRecorder APIs on first import
    import('./VoiceController').then(({ VoiceController }) => {
      this.voiceController = new VoiceController(
        (text) => this.addMessage('user', text),
        (reply) => this.handleReply(reply),
        () => this.contextFn()
      );
    }).catch(() => { /* voice unavailable */ });

    // Start with the panel open but gated until activation.
    this.setPanelVisibility(true, false);
    this.setInteractionEnabled(false);
    this.showActivationOverlay();
  }

  toggle(): void {
    this.setPanelVisibility(!this.visible);
  }

  close(): void {
    if (!this.visible) return;
    this.setPanelVisibility(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  addMessage(role: 'user' | 'ai', text: string): void {
    if (!this.activated) {
      this.pendingMessages.push({ role, text });
      return;
    }
    this.messages.push({ role, text });
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
    this.renderMessages();
  }

  addAutoAlert(text: string): void {
    if (!this.activated) {
      this.pendingMessages.push({ role: 'ai', text });
      return;
    }
    // Only add if not duplicate of last AI message
    const last = this.messages[this.messages.length - 1];
    if (last?.role === 'ai' && last.text === text) return;
    this.addMessage('ai', text);
  }

  destroy(): void {
    this.removeHandler?.();
    this.voiceController?.destroy();
    this.tab.parentNode?.removeChild(this.tab);
    this.panel.parentNode?.removeChild(this.panel);
  }

  private sendQuery(text: string): void {
    if (!text.trim() || !this.activated) return;
    this.addMessage('user', text);
    const context = this.contextFn();
    wsClient.send({ type: 'AI_ASSISTANT_QUERY', payload: { message: text, context } });
    this.addMessage('ai', '...');
  }

  private handleReply(reply: CompanionReply): void {
    // Replace last '...' placeholder if present, otherwise append
    if (!this.activated) {
      this.pendingMessages.push({ role: 'ai', text: reply.reply_text });
      return;
    }
    const last = this.messages[this.messages.length - 1];
    if (last?.role === 'ai' && last.text === '...') {
      this.messages[this.messages.length - 1] = { role: 'ai', text: reply.reply_text };
    } else {
      this.addMessage('ai', reply.reply_text);
      return; // addMessage already calls renderMessages
    }
    this.renderMessages();

    if (reply.warning || reply.proximity_alert) {
      this.panel.style.borderColor = '#ff4444';
      setTimeout(() => { this.panel.style.borderColor = '#5555ff'; }, 2000);
    }
  }

  private renderMessages(): void {
    this.messagesEl.innerHTML = '';
    for (const m of this.messages) {
      const row = document.createElement('div');
      row.style.cssText = `
        margin: 4px 0;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 11px;
        line-height: 1.4;
        max-width: 90%;
        word-wrap: break-word;
        ${m.role === 'user'
          ? 'background:#2a2a6a;color:#ccd;align-self:flex-end;margin-left:auto;'
          : 'background:#1a3a1a;color:#8f8;'}
      `;
      row.textContent = m.role === 'ai' ? `AI: ${m.text}` : `You: ${m.text}`;
      this.messagesEl.appendChild(row);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private buildTab(): HTMLDivElement {
    const tab = document.createElement('div');
    tab.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 0;
      background: rgba(20,20,80,0.95);
      border: 1px solid #5555ff;
      border-right: none;
      border-radius: 6px 0 0 6px;
      padding: 8px 10px;
      font-family: 'Press Start 2P', monospace, sans-serif;
      font-size: 8px;
      color: #aaf;
      cursor: pointer;
      z-index: 10000;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      letter-spacing: 1px;
      box-shadow: -2px 0 8px rgba(80,80,255,0.3);
      pointer-events: all;
      transition: background 0.15s;
      user-select: none;
    `;
    tab.textContent = '🤖 AI [H]';
    tab.addEventListener('click', () => this.toggle());
    tab.addEventListener('mouseenter', () => { tab.style.background = 'rgba(40,40,120,0.95)'; });
    tab.addEventListener('mouseleave', () => { tab.style.background = 'rgba(20,20,80,0.95)'; });
    return tab;
  }

  private buildPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 300px;
      max-height: 420px;
      background: rgba(10,10,24,0.95);
      border: 1px solid #5555ff;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      font-family: 'Press Start 2P', monospace, sans-serif;
      color: #aaf;
      z-index: 9999;
      transform: translateX(110%);
      transition: transform 0.25s ease-out;
      box-shadow: 0 0 16px rgba(80,80,255,0.4);
      pointer-events: all;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 10px;
      font-size: 9px;
      color: #88f;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;
    const title = document.createElement('span');
    title.textContent = 'AI DUNGEON COMPANION';
    header.appendChild(title);

    const hintLabel = document.createElement('button');
    hintLabel.textContent = '[H] CLOSE';
    hintLabel.style.cssText =
      'font-size:7px;color:#c4d7ff;background:rgba(8,8,24,0.85);border:1px solid #556;letter-spacing:0.1em;padding:3px 6px;cursor:pointer;font-family:inherit;';
    hintLabel.addEventListener('click', () => this.toggle());
    header.appendChild(hintLabel);
    panel.appendChild(header);

    // Messages area
    const msgs = document.createElement('div');
    msgs.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      min-height: 80px;
      max-height: 200px;
      scrollbar-width: thin;
      scrollbar-color: #444 #111;
    `;
    this.messagesEl = msgs;
    panel.appendChild(msgs);

    // Suggestion chips
    const chips = document.createElement('div');
    chips.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px 8px;
      border-top: 1px solid #222;
      flex-shrink: 0;
    `;
    for (const s of SUGGESTIONS) {
      const btn = document.createElement('button');
      btn.textContent = s.label;
      btn.style.cssText = `
        background: #1a1a44;
        color: #88f;
        border: 1px solid #334;
        border-radius: 3px;
        font-size: 8px;
        padding: 3px 5px;
        cursor: pointer;
        font-family: inherit;
      `;
      btn.addEventListener('click', () => this.sendQuery(s.msg));
      btn.addEventListener('mouseenter', () => { btn.style.background = '#2a2a66'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1a44'; });
      chips.appendChild(btn);
    }
    this.suggestionsEl = chips;
    panel.appendChild(chips);

    // Voice button
    const voiceRow = document.createElement('div');
    voiceRow.style.cssText = `
      padding: 4px 8px;
      border-top: 1px solid #222;
      flex-shrink: 0;
    `;
    const vBtn = document.createElement('button');
    vBtn.textContent = 'VOICE GUIDE (2 coins)';
    vBtn.style.cssText = `
      width: 100%;
      background: #2a0a2a;
      color: #f8f;
      border: 1px solid #a4a;
      border-radius: 3px;
      font-size: 8px;
      padding: 5px;
      cursor: pointer;
      font-family: inherit;
    `;
    vBtn.addEventListener('mouseenter', () => { vBtn.style.background = '#3a1a3a'; });
    vBtn.addEventListener('mouseleave', () => { vBtn.style.background = '#2a0a2a'; });
    vBtn.addEventListener('mousedown', () => { this.voiceController?.startRecording(); });
    vBtn.addEventListener('mouseup', ()   => { this.voiceController?.stopRecording(); });
    vBtn.addEventListener('mouseleave', () => { this.voiceController?.stopRecording(); });
    this.voiceBtn = vBtn;
    voiceRow.appendChild(vBtn);
    this.voiceRow = voiceRow;
    panel.appendChild(voiceRow);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px;
      border-top: 1px solid #222;
      flex-shrink: 0;
    `;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Ask your companion...';
    input.style.cssText = `
      flex: 1;
      background: #111;
      color: #ccf;
      border: 1px solid #334;
      border-radius: 3px;
      font-size: 10px;
      padding: 4px 6px;
      font-family: inherit;
      outline: none;
    `;
    // Prevent Phaser from capturing keypresses while input focused
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.sendQuery(input.value);
        input.value = '';
      }
    });
    this.inputEl = input;

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'ASK';
    sendBtn.style.cssText = `
      background: #1a1a88;
      color: #aaf;
      border: 1px solid #446;
      border-radius: 3px;
      font-size: 9px;
      padding: 4px 7px;
      cursor: pointer;
      font-family: inherit;
    `;
    sendBtn.addEventListener('click', () => {
      this.sendQuery(input.value);
      input.value = '';
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    this.sendBtn = sendBtn;
    this.inputRow = inputRow;
    panel.appendChild(inputRow);

    return panel;
  }

  private setPanelVisibility(next: boolean, focusInput = true): void {
    this.visible = next;
    this.panel.style.transform = next ? 'translateX(0)' : 'translateX(110%)';
    this.tab.style.opacity = next ? '0.4' : '1';
    if (next && focusInput && this.activated) {
      setTimeout(() => this.inputEl.focus(), 80);
    } else if (!next) {
      const canvas = document.querySelector('canvas');
      canvas?.focus();
    }
  }

  private setInteractionEnabled(enabled: boolean): void {
    this.suggestionsEl.style.pointerEvents = enabled ? 'auto' : 'none';
    this.suggestionsEl.style.opacity = enabled ? '1' : '0.4';
    this.voiceBtn.disabled = !enabled;
    this.voiceBtn.style.opacity = enabled ? '1' : '0.5';
    this.inputEl.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
    this.inputEl.placeholder = enabled ? 'Ask your companion...' : 'Activate companion to chat';
    this.voiceRow.style.opacity = enabled ? '1' : '0.5';
    this.inputRow.style.opacity = enabled ? '1' : '0.5';
  }

  private showActivationOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      inset: 48px 12px 120px 12px;
      background: rgba(4,4,18,0.92);
      border: 1px dashed rgba(120,140,220,0.6);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-align: center;
      padding: 16px;
      z-index: 20;
    `;
    const text = document.createElement('div');
    text.textContent = 'Activate your AI companion when you are ready. Movement stays unlocked until then.';
    text.style.cssText = 'font-size: 9px; color:#cfd8ff; letter-spacing:0.12em;';
    const btn = document.createElement('button');
    btn.textContent = 'ACTIVATE COMPANION';
    btn.style.cssText =
      'padding:8px 12px;background:#1a1a88;color:#f5d0fe;border:2px solid #7788ff;border-radius:6px;font-size:9px;cursor:pointer;font-family:inherit;letter-spacing:0.2em;';
    btn.addEventListener('click', () => this.activateCompanion());
    overlay.append(text, btn);
    this.panel.appendChild(overlay);
    this.activationOverlay = overlay;
  }

  private activateCompanion(): void {
    if (this.activated) return;
    this.activated = true;
    this.activationOverlay?.remove();
    this.activationOverlay = undefined;
    this.setInteractionEnabled(true);
    this.addMessage('ai', 'Dungeon AI online. Ask me anything or use the quick buttons below.');
    if (this.pendingMessages.length > 0) {
      for (const msg of this.pendingMessages) {
        this.addMessage(msg.role, msg.text);
      }
      this.pendingMessages = [];
    }
    setTimeout(() => this.inputEl.focus(), 80);
  }
}
