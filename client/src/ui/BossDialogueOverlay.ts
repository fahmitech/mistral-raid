const FONT = '"Press Start 2P", monospace';
const BOSS_LINES = [
  'I have watched you from the beginning. Every step. Every mistake. Every death.',
  "I call it a warning. You've been camping in that corner for thirty seconds. The next one won't miss.",
  "Can't hit me? Your accuracy is 34 percent. You're missing more shots than I am.",
  "You've spent 40 percent of this fight in that corner. I don't need to come to you.",
  'Silence is an improvement.',
];

type Speaker = 'boss' | 'player';

type Timer = number;

type Interval = number;

class WaveformBars {
  public readonly element: HTMLDivElement;

  private readonly bars: HTMLDivElement[] = [];

  private timer?: Interval;

  constructor(private readonly color: string, private readonly count: number, private readonly height: number) {
    this.element = document.createElement('div');
    this.element.className = 'boss-dialogue-waveform';
    this.element.style.height = `${height}px`;
    for (let i = 0; i < count; i += 1) {
      const bar = document.createElement('div');
      bar.className = 'boss-dialogue-waveform-bar';
      bar.style.backgroundColor = color;
      bar.style.height = '1px';
      this.bars.push(bar);
      this.element.appendChild(bar);
    }
  }

  setActive(active: boolean): void {
    if (!active) {
      this.clear();
      this.bars.forEach((bar) => {
        bar.style.height = '1px';
        bar.style.opacity = '0.15';
      });
      return;
    }
    this.bars.forEach((bar) => {
      bar.style.opacity = '0.8';
    });
    this.clear();
    this.timer = window.setInterval(() => {
      this.bars.forEach((bar) => {
        const next = 1 + Math.floor(Math.random() * Math.max(1, this.height - 1));
        bar.style.height = `${next}px`;
      });
    }, 100);
  }

  destroy(): void {
    this.clear();
    this.element.remove();
  }

  private clear(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

export class BossDialogueOverlay {
  private root?: HTMLDivElement;

  private boxStack?: HTMLDivElement;

  private bossBox?: HTMLDivElement;

  private playerBox?: HTMLDivElement;

  private bossText?: HTMLParagraphElement;

  private bossCaret?: HTMLSpanElement;

  private bossWaveform?: WaveformBars;

  private playerInputRow?: HTMLDivElement;

  private playerInput?: HTMLInputElement;

  private playerSendBtn?: HTMLSpanElement;

  private playerSentText?: HTMLParagraphElement;

  private playerWaveform?: WaveformBars;

  private micButton?: HTMLDivElement;

  private speaker: Speaker = 'boss';

  private typingTimer?: Interval;

  private playerSwapTimer?: Timer;

  private step = 0;

  private readonly parent: HTMLElement;

  constructor(parent?: HTMLElement) {
    this.parent = parent ?? document.getElementById('app') ?? document.body;
  }

  show(): void {
    if (!this.root) {
      this.createDOM();
    }
    if (!this.root?.isConnected) {
      this.parent.appendChild(this.root!);
    }
    this.setSpeaker('boss');
    this.step = 0;
    this.typewriteBoss(BOSS_LINES[0]);
  }

  destroy(): void {
    this.clearTimers();
    this.bossWaveform?.destroy();
    this.playerWaveform?.destroy();
    this.root?.remove();
    this.root = undefined;
  }

  private createDOM(): void {
    this.root = document.createElement('div');
    this.root.className = 'boss-dialogue-overlay';

    this.boxStack = document.createElement('div');
    this.boxStack.className = 'boss-dialogue-stack';

    this.bossBox = this.createBossBox();
    this.playerBox = this.createPlayerBox();

    this.boxStack.appendChild(this.bossBox);
    this.boxStack.appendChild(this.playerBox);
    this.root.appendChild(this.boxStack);
  }

  private createBossBox(): HTMLDivElement {
    const box = this.createBoxWrapper('boss');

    const name = document.createElement('div');
    name.className = 'boss-dialogue-name boss-dialogue-name--boss';
    name.textContent = 'THE ARCHITECT';
    box.appendChild(name);

    this.bossText = document.createElement('p');
    this.bossText.className = 'boss-dialogue-text boss-dialogue-text--boss';
    this.bossText.textContent = '';

    this.bossCaret = document.createElement('span');
    this.bossCaret.className = 'boss-dialogue-caret';
    this.bossText.appendChild(this.bossCaret);

    box.appendChild(this.bossText);

    const wf = new WaveformBars('#ff4444', 5, 10);
    wf.element.classList.add('boss-dialogue-waveform--boss');
    box.appendChild(wf.element);
    wf.setActive(true);
    this.bossWaveform = wf;

    return box;
  }

  private createPlayerBox(): HTMLDivElement {
    const box = this.createBoxWrapper('player');

    const name = document.createElement('div');
    name.className = 'boss-dialogue-name boss-dialogue-name--player';
    name.textContent = 'YOU';
    box.appendChild(name);

    this.playerSentText = document.createElement('p');
    this.playerSentText.className = 'boss-dialogue-text boss-dialogue-text--player';
    this.playerSentText.textContent = '';
    this.playerSentText.style.display = 'none';
    box.appendChild(this.playerSentText);

    this.playerInputRow = document.createElement('div');
    this.playerInputRow.className = 'boss-dialogue-input-row';

    const mic = document.createElement('div');
    mic.className = 'boss-dialogue-mic';
    mic.addEventListener('mousedown', () => this.setMicActive(true));
    mic.addEventListener('mouseup', () => this.setMicActive(false));
    mic.addEventListener('mouseleave', () => this.setMicActive(false));
    this.micButton = mic;
    this.playerWaveform = new WaveformBars('#4488cc', 5, 10);
    mic.appendChild(this.playerWaveform.element);
    this.playerWaveform.setActive(false);

    const divider = document.createElement('div');
    divider.className = 'boss-dialogue-divider';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'boss-dialogue-input-wrap';

    const prompt = document.createElement('span');
    prompt.className = 'boss-dialogue-input-prompt';
    prompt.textContent = '▸';

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.placeholder = 'Type or hold mic...';
    input.className = 'boss-dialogue-input';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.sendPlayerMessage(input.value);
      }
    });
    input.addEventListener('input', () => this.updateSendButton());
    this.playerInput = input;

    const send = document.createElement('span');
    send.className = 'boss-dialogue-send';
    send.textContent = 'SEND';
    send.style.visibility = 'hidden';
    send.addEventListener('click', () => this.sendPlayerMessage(this.playerInput?.value ?? ''));
    this.playerSendBtn = send;

    inputWrap.appendChild(prompt);
    inputWrap.appendChild(input);
    inputWrap.appendChild(send);

    this.playerInputRow.appendChild(mic);
    this.playerInputRow.appendChild(divider);
    this.playerInputRow.appendChild(inputWrap);
    box.appendChild(this.playerInputRow);

    return box;
  }

  private createBoxWrapper(mode: 'boss' | 'player'): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = `boss-dialogue-box boss-dialogue-box--${mode}`;
    wrapper.style.fontFamily = FONT;

    ['tl', 'tr', 'bl', 'br'].forEach((corner) => {
      const gem = document.createElement('div');
      gem.className = `boss-dialogue-gem boss-dialogue-gem--${mode} boss-dialogue-gem--${corner}`;
      wrapper.appendChild(gem);
    });

    return wrapper;
  }

  private setSpeaker(next: Speaker): void {
    this.speaker = next;
    if (this.bossBox && this.playerBox) {
      this.bossBox.style.display = next === 'boss' ? 'block' : 'none';
      this.playerBox.style.display = next === 'player' ? 'block' : 'none';
    }
    if (next === 'player') {
      if (this.playerInput) {
        this.playerInput.value = '';
      }
      this.playerSentText && (this.playerSentText.style.display = 'none');
      this.playerInputRow && (this.playerInputRow.style.display = 'flex');
      this.updateSendButton();
      window.setTimeout(() => this.playerInput?.focus(), 50);
    }
  }

  private typewriteBoss(text: string): void {
    if (!this.bossText) return;
    this.setSpeaker('boss');
    this.bossText.textContent = '';
    if (this.bossCaret) {
      this.bossCaret.style.display = 'inline-block';
      this.bossCaret.classList.remove('boss-dialogue-caret--blink');
    }
    this.bossWaveform?.setActive(true);
    this.clearTypingTimer();
    let i = 0;
    this.typingTimer = window.setInterval(() => {
      if (!this.bossText) return;
      i += 1;
      this.bossText.textContent = text.slice(0, i);
      if (this.bossCaret) {
        this.bossText.appendChild(this.bossCaret);
      }
      if (i >= text.length) {
        this.clearTypingTimer();
        this.onBossFinished();
      }
    }, 30);
  }

  private onBossFinished(): void {
    if (this.bossCaret) {
      this.bossCaret.style.display = 'inline-block';
    }
    this.bossWaveform?.setActive(false);
    if (this.bossCaret) {
      this.bossCaret.classList.add('boss-dialogue-caret--blink');
    }
    this.playerSwapTimer = window.setTimeout(() => {
      this.setSpeaker('player');
      this.playerSwapTimer = undefined;
    }, 1500);
  }

  private sendPlayerMessage(raw: string): void {
    const text = raw.trim();
    if (!text) return;
    if (this.playerInput) {
      this.playerInput.value = '';
    }
    if (this.playerSendBtn) {
      this.playerSendBtn.style.visibility = 'hidden';
    }
    if (this.playerSentText) {
      this.playerSentText.textContent = text;
      this.playerSentText.style.display = 'block';
    }
    if (this.playerInputRow) {
      this.playerInputRow.style.display = 'none';
    }
    const next = Math.min(this.step + 1, BOSS_LINES.length - 1);
    this.step = next;
    window.setTimeout(() => {
      this.typewriteBoss(BOSS_LINES[next]);
    }, 800);
  }

  private setMicActive(active: boolean): void {
    if (this.micButton) {
      this.micButton.classList.toggle('boss-dialogue-mic--active', active);
    }
    this.playerWaveform?.setActive(active);
  }

  private updateSendButton(): void {
    if (!this.playerSendBtn || !this.playerInput) return;
    const hasText = this.playerInput.value.trim().length > 0;
    this.playerSendBtn.style.visibility = hasText ? 'visible' : 'hidden';
  }

  private clearTimers(): void {
    this.clearTypingTimer();
    if (this.playerSwapTimer) {
      window.clearTimeout(this.playerSwapTimer);
      this.playerSwapTimer = undefined;
    }
  }

  private clearTypingTimer(): void {
    if (this.typingTimer) {
      window.clearInterval(this.typingTimer);
      this.typingTimer = undefined;
    }
  }
}
