import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import type { StoryCardPayload } from '../content/storyCards';

type QueueEntry = {
  payload: StoryCardPayload;
  resolve: () => void;
};

export class StoryOverlay {
  private container: HTMLDivElement;
  private stage: HTMLDivElement;
  private panel: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private subtitleEl: HTMLParagraphElement;
  private stingEl: HTMLParagraphElement;
  private bodyEl: HTMLParagraphElement;
  private typeBadge: HTMLSpanElement;
  private visible = false;
  private queue: QueueEntry[] = [];
  private currentResolve: (() => void) | null = null;
  private resizeObserver: ResizeObserver;
  private visibilityHandler: ((visible: boolean) => void) | null = null;
  private closeBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement) {
    parent.querySelectorAll<HTMLDivElement>('[data-story-overlay="true"]').forEach((node) => node.remove());
    this.container = document.createElement('div');
    this.container.dataset.storyOverlay = 'true';
    Object.assign(this.container.style, {
      position: 'absolute',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(3, 4, 10, 0.8)',
      backdropFilter: 'blur(2px)',
      transition: 'opacity 160ms ease-out',
      opacity: '0',
      zIndex: '70',
      pointerEvents: 'auto',
    });

    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'absolute',
      width: `${INTERNAL_WIDTH}px`,
      height: `${INTERNAL_HEIGHT}px`,
      transformOrigin: 'top left',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    });

    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      width: '360px',
      maxWidth: '90%',
      padding: '32px 32px 24px',
      background: 'rgba(6, 8, 18, 0.94)',
      border: '1px solid rgba(148, 163, 184, 0.25)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
      borderRadius: '10px',
      color: '#f8f5ec',
      fontFamily: '"Press Start 2P", monospace',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'auto',
    });

    this.typeBadge = document.createElement('span');
    Object.assign(this.typeBadge.style, {
      fontSize: '8px',
      letterSpacing: '0.18em',
      color: '#fcd34d',
      textTransform: 'uppercase',
    });

    this.titleEl = document.createElement('h2');
    Object.assign(this.titleEl.style, {
      margin: '0',
      fontSize: '22px',
      letterSpacing: '0.08em',
      color: '#fef3c7',
      textTransform: 'uppercase',
    });

    this.subtitleEl = document.createElement('p');
    Object.assign(this.subtitleEl.style, {
      margin: '0',
      fontSize: '12px',
      letterSpacing: '0.2em',
      color: '#a5b4fc',
      textTransform: 'uppercase',
    });

    this.stingEl = document.createElement('p');
    Object.assign(this.stingEl.style, {
      margin: '6px 0 0',
      fontFamily: '"Spectral", "Georgia", serif',
      fontSize: '13px',
      lineHeight: '1.7',
      color: '#fef9c3',
      whiteSpace: 'pre-line',
    });

    this.bodyEl = document.createElement('p');
    Object.assign(this.bodyEl.style, {
      margin: '0',
      fontFamily: '"Spectral", "Georgia", serif',
      fontSize: '12px',
      lineHeight: '1.6',
      color: '#e2e8f0',
      whiteSpace: 'pre-line',
    });

    this.closeBtn = document.createElement('button');
    this.closeBtn.textContent = '[X]';
    Object.assign(this.closeBtn.style, {
      alignSelf: 'flex-end',
      border: '1px solid rgba(248, 250, 252, 0.2)',
      background: 'rgba(15, 23, 42, 0.8)',
      color: '#fef3c7',
      fontSize: '9px',
      letterSpacing: '0.2em',
      cursor: 'pointer',
      padding: '4px 8px',
    });
    this.closeBtn.addEventListener('click', () => this.handleDismiss());

    this.panel.appendChild(this.closeBtn);
    this.panel.appendChild(this.typeBadge);
    this.panel.appendChild(this.titleEl);
    this.panel.appendChild(this.subtitleEl);
    this.panel.appendChild(this.stingEl);
    this.panel.appendChild(this.bodyEl);
    this.stage.appendChild(this.panel);
    this.container.appendChild(this.stage);
    parent.appendChild(this.container);

    this.closeBtn.blur();

    this.resizeObserver = new ResizeObserver(() => this.updateStage(canvas));
    this.resizeObserver.observe(canvas);
    this.updateStage(canvas);

    this.container.addEventListener('click', (evt) => {
      if (evt.target === this.container) {
        this.closeBtn.focus();
      }
    });
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.queue = [];
    this.container.remove();
    this.visibilityHandler = null;
  }

  onVisibilityChange(handler: (visible: boolean) => void): void {
    this.visibilityHandler = handler;
  }

  show(payload: StoryCardPayload): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ payload, resolve });
      if (!this.visible) {
        this.presentNext();
      }
    });
  }

  private presentNext(): void {
    if (this.visible) return;
    const next = this.queue.shift();
    if (!next) return;
    this.currentResolve = next.resolve;
    this.applyPayload(next.payload);
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.visible = true;
      this.container.style.opacity = '1';
      this.visibilityHandler?.(true);
    });
    this.closeBtn.focus();
  }

  private applyPayload(payload: StoryCardPayload): void {
    this.typeBadge.textContent = this.getTypeLabel(payload.type);
    this.titleEl.textContent = payload.title;
    this.subtitleEl.textContent = payload.subtitle ?? '';
    this.subtitleEl.style.display = payload.subtitle ? 'block' : 'none';
    this.stingEl.textContent = payload.sting ?? '';
    this.stingEl.style.display = payload.sting ? 'block' : 'none';
    this.bodyEl.textContent = payload.body ?? '';
    this.bodyEl.style.display = payload.body ? 'block' : 'none';
  }

  private handleDismiss(): void {
    if (!this.visible) return;
    this.container.style.opacity = '0';
    const resolve = this.currentResolve;
    this.currentResolve = null;
    window.setTimeout(() => {
      this.visible = false;
      this.container.style.display = 'none';
      this.visibilityHandler?.(false);
      resolve?.();
      this.presentNext();
    }, 200);
  }

  private getTypeLabel(type: StoryCardPayload['type']): string {
    switch (type) {
      case 'levelIntro':
        return 'Level Brief';
      case 'bossIntro':
        return 'Encounter';
      case 'discovery':
        return 'Discovery';
      case 'aftermath':
        return 'Aftermath';
      default:
        return '';
    }
  }

  private updateStage(canvas: HTMLCanvasElement): void {
    const canvasRect = canvas.getBoundingClientRect();
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;
    this.stage.style.left = `${left}px`;
    this.stage.style.top = `${top}px`;
    this.stage.style.width = `${canvasRect.width}px`;
    this.stage.style.height = `${canvasRect.height}px`;
  }
}
