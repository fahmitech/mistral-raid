import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import type { LoreEntry } from '../content/loreEntries';
import { GameState } from '../core/GameState';

export class JournalOverlay {
  private container: HTMLDivElement;
  private stage: HTMLDivElement;
  private panel: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private bodyEl: HTMLParagraphElement;
  private promptEl: HTMLDivElement;
  private closeHandler: (() => void) | null = null;
  private visible = false;
  private hideTimer: number | null = null;
  private resizeObserver: ResizeObserver;
  private activeEntryId: string | null = null;

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement) {
    parent.querySelectorAll<HTMLDivElement>('[data-journal-overlay="true"]').forEach((node) => node.remove());
    this.container = document.createElement('div');
    this.container.dataset.journalOverlay = 'true';
    Object.assign(this.container.style, {
      position: 'absolute',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(4, 6, 12, 0.82)',
      backdropFilter: 'blur(2px)',
      transition: 'opacity 160ms ease-out',
      opacity: '0',
      zIndex: '60',
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
      width: '260px',
      maxWidth: '90%',
      padding: '24px 22px 20px',
      background: 'rgba(10, 12, 20, 0.92)',
      border: '1px solid rgba(92, 98, 130, 0.7)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
      borderRadius: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      pointerEvents: 'auto',
      color: '#f3f0e6',
      fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
    });

    const titleWrap = document.createElement('div');
    Object.assign(titleWrap.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });

    this.titleEl = document.createElement('h2');
    this.titleEl.textContent = '';
    Object.assign(this.titleEl.style, {
      margin: '0',
      fontSize: '13px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#fef9c3',
      fontFamily: '\'Press Start 2P\', monospace',
      textShadow: '0 1px 0 rgba(0, 0, 0, 0.8)',
    });

    const divider = document.createElement('div');
    Object.assign(divider.style, {
      height: '1px',
      width: '100%',
      background: 'linear-gradient(90deg, rgba(250, 204, 21, 0) 0%, rgba(250, 204, 21, 0.6) 50%, rgba(250, 204, 21, 0) 100%)',
    });

    this.bodyEl = document.createElement('p');
    this.bodyEl.textContent = '';
    Object.assign(this.bodyEl.style, {
      margin: '0',
      fontSize: '11px',
      lineHeight: '1.5',
      color: '#f4f1d6',
      letterSpacing: '0.02em',
      fontFamily: '"Spectral", "Georgia", serif',
    });

    this.promptEl = document.createElement('div');
    this.promptEl.textContent = '[E] Close';
    Object.assign(this.promptEl.style, {
      marginTop: '8px',
      fontSize: '9px',
      fontFamily: '\'Press Start 2P\', monospace',
      letterSpacing: '0.1em',
      color: '#9dd6c6',
      alignSelf: 'center',
    });

    titleWrap.appendChild(this.titleEl);
    titleWrap.appendChild(divider);
    this.panel.appendChild(titleWrap);
    this.panel.appendChild(this.bodyEl);
    this.panel.appendChild(this.promptEl);
    this.stage.appendChild(this.panel);
    this.container.appendChild(this.stage);
    parent.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(() => this.updateStage(canvas));
    this.resizeObserver.observe(canvas);
    this.container.addEventListener('transitionend', (evt) => {
      if (evt.propertyName === 'opacity' && !this.visible && this.container.style.opacity === '0') {
        this.container.style.display = 'none';
      }
    });

    window.addEventListener('keydown', this.handleKeyDown, true);
    this.updateStage(canvas);
  }

  onRequestClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  show(entry: LoreEntry): void {
    window.clearTimeout(this.hideTimer ?? undefined);
    this.hideTimer = null;
    this.titleEl.textContent = entry.title;
    this.bodyEl.textContent = entry.body;
    this.activeEntryId = entry.id;
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.visible = true;
      this.container.style.opacity = '1';
    });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.container.style.opacity = '0';
    if (this.activeEntryId) {
      GameState.markLoreDiscovered(this.activeEntryId);
      this.activeEntryId = null;
    }
    this.hideTimer = window.setTimeout(() => {
      if (!this.visible) {
        this.container.style.display = 'none';
      }
    }, 200);
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.resizeObserver.disconnect();
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.container.remove();
    this.closeHandler = null;
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

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.visible) return;
    const key = event.key.toLowerCase();
    if (key === 'e' || key === 'escape') {
      event.preventDefault();
      this.closeHandler?.();
    }
  };
}
