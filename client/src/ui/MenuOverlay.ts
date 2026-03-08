import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';

export interface MenuOverlayItem {
  label: string;
  enabled: boolean;
}

interface MenuOverlayLayout {
  menuX: number;
  menuTop: number;
  itemGap: number;
  subtitleY: number;
  hintBaseline: number;
}

interface ItemMetrics {
  centerX: number;
  centerY: number;
  left: number;
}

export class MenuOverlay {
  private container: HTMLDivElement;
  private stage: HTMLDivElement;
  private content: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
  private menuListEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private hintSegments: HTMLSpanElement[] = [];
  private menuItemEls: HTMLButtonElement[] = [];
  private hoverHandler?: (index: number) => void;
  private clickHandler?: (index: number) => void;
  private resizeObserver?: ResizeObserver;
  private scaleX = 1;
  private scaleY = 1;
  private lastStageRect: DOMRect | null = null;
  private items: MenuOverlayItem[] = [];
  private selectedIndex = 0;

  constructor(
    private parent: HTMLElement,
    private canvas: HTMLCanvasElement,
    private layout: MenuOverlayLayout,
  ) {
    this.parent.querySelectorAll<HTMLDivElement>('[data-menu-overlay="true"]').forEach((node) => node.remove());
    if (getComputedStyle(this.parent).position === 'static') {
      this.parent.style.position = 'relative';
    }

    this.container = document.createElement('div');
    this.container.dataset.menuOverlay = 'true';
    Object.assign(this.container.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '30',
      pointerEvents: 'auto',
      fontFamily: '\'Press Start 2P\', monospace',
      textTransform: 'uppercase',
      letterSpacing: '0',
      color: '#cfd8ff',
      userSelect: 'none',
      webkitFontSmoothing: 'none',
      fontSmooth: 'never',
      imageRendering: 'pixelated',
    });

    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'absolute',
      width: `${INTERNAL_WIDTH}px`,
      height: `${INTERNAL_HEIGHT}px`,
      transformOrigin: 'top left',
    });

    this.content = document.createElement('div');
    Object.assign(this.content.style, {
      position: 'absolute',
      inset: '0',
    });

    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.position = 'absolute';
    this.subtitleEl.style.left = '50%';
    this.subtitleEl.style.transform = 'translate(-50%, -50%)';
    this.subtitleEl.style.top = `${this.layout.subtitleY}px`;
    this.subtitleEl.style.fontFamily = '\'Press Start 2P\', monospace';
    this.subtitleEl.style.fontSize = '32px';
    this.subtitleEl.style.letterSpacing = '-0.5px';
    this.subtitleEl.style.color = '#7b5fff';
    this.subtitleEl.style.textShadow = '0 3px 0 #08001a, 0 0 15px rgba(123, 95, 255, 0.5)';

    this.menuListEl = document.createElement('div');
    Object.assign(this.menuListEl.style, {
      position: 'absolute',
      left: `${this.layout.menuX}px`,
      top: `${this.layout.menuTop}px`,
      transform: 'translate(-50%, 0)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: `${this.layout.itemGap}px`,
      pointerEvents: 'auto',
    });

    this.hintEl = document.createElement('div');
    Object.assign(this.hintEl.style, {
      position: 'absolute',
      left: '0',
      width: '100%',
      transform: 'translateY(-100%)',
      color: '#bbf7d0',
      textAlign: 'center',
      display: 'flex',
      justifyContent: 'center',
      gap: '18px',
      pointerEvents: 'auto',
      fontFamily: '\'Press Start 2P\', monospace',
      fontSize: '18px',
      letterSpacing: '0.25em',
      lineHeight: '1',
      padding: '0 4px',
      overflow: 'hidden',
    });
    this.setHintPosition();

    this.content.appendChild(this.subtitleEl);
    this.content.appendChild(this.menuListEl);
    this.content.appendChild(this.hintEl);
    this.stage.appendChild(this.content);
    this.container.appendChild(this.stage);
    this.parent.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(() => this.updateStage());
    this.resizeObserver.observe(this.canvas);
    this.updateStage();
  }

  setItems(items: MenuOverlayItem[]): void {
    this.items = items;
    this.menuListEl.replaceChildren();
    this.menuItemEls = items.map((item, idx) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label.toUpperCase();
      button.style.background = 'transparent';
      button.style.border = 'none';
      button.style.color = item.enabled ? '#cfd8ff' : '#7f8db2';
      button.style.opacity = item.enabled ? '0.9' : '0.4';
      button.style.textShadow = '0 1px 0 rgba(5,7,11,0.85)';
      button.style.cursor = item.enabled ? 'pointer' : 'not-allowed';
      button.style.padding = '4px 12px';
      button.style.fontFamily = '\'Press Start 2P\', monospace';
      button.style.fontSize = '26px';
      button.style.letterSpacing = '-0.15px';
      button.style.lineHeight = '1.2';
      button.disabled = !item.enabled;
      button.dataset.index = String(idx);

      button.addEventListener('mouseenter', () => {
        if (!item.enabled) return;
        this.hoverHandler?.(idx);
      });

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!item.enabled) return;
        this.clickHandler?.(idx);
      });

      this.menuListEl.appendChild(button);
      return button;
    });

    this.applySelectedStyles();
  }

  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
    this.applySelectedStyles();
  }

  setSubtitle(text: string): void {
    this.subtitleEl.textContent = text.toUpperCase();
  }

  setHints(text: string): void {
    const segments = text
      .toUpperCase()
      .split(/\s{3,}/)
      .filter((seg) => seg.trim().length > 0);
    while (this.hintSegments.length < segments.length) {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.style.letterSpacing = '0.2em';
      span.style.whiteSpace = 'nowrap';
      this.hintEl.appendChild(span);
      this.hintSegments.push(span);
    }
    this.hintSegments.forEach((span, idx) => {
      if (idx < segments.length) {
        span.textContent = segments[idx];
        span.style.visibility = 'visible';
      } else {
        span.textContent = '';
        span.style.visibility = 'hidden';
      }
    });
  }

  onHover(handler: (index: number) => void): void {
    this.hoverHandler = handler;
  }

  onClick(handler: (index: number) => void): void {
    this.clickHandler = handler;
  }

  getItemCenterY(index: number): number | null {
    const metrics = this.getItemMetrics(index);
    return metrics?.centerY ?? null;
  }

  getItemLeft(index: number): number | null {
    const metrics = this.getItemMetrics(index);
    return metrics?.left ?? null;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.menuItemEls = [];
    this.container.remove();
  }

  private getItemMetrics(index: number): ItemMetrics | null {
    const el = this.menuItemEls[index];
    if (!el || !this.lastStageRect || !this.scaleX || !this.scaleY) return null;
    const itemRect = el.getBoundingClientRect();
    const left = (itemRect.left - this.lastStageRect.left) / this.scaleX;
    const centerX = left + (itemRect.width / this.scaleX) / 2;
    const centerY = ((itemRect.top - this.lastStageRect.top) + itemRect.height / 2) / this.scaleY;
    return { centerX, centerY, left };
  }

  private setHintPosition(): void {
    this.hintEl.style.top = `${this.layout.hintBaseline - 3}px`;
  }

  private updateStage(): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.parent.getBoundingClientRect();

    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;

    // Use a higher base resolution for UI (720p height) for better layout control
    const baseHeight = 720;
    const aspect = INTERNAL_WIDTH / INTERNAL_HEIGHT;
    const baseWidth = baseHeight * aspect;

    this.stage.style.width = `${baseWidth}px`;
    this.stage.style.height = `${baseHeight}px`;

    this.scaleX = canvasRect.width / baseWidth;
    this.scaleY = canvasRect.height / baseHeight;

    this.stage.style.left = `${left}px`;
    this.stage.style.top = `${top}px`;
    this.stage.style.transform = `scale(${this.scaleX}, ${this.scaleY})`;

    this.lastStageRect = this.stage.getBoundingClientRect();
  }

  private applySelectedStyles(): void {
    this.menuItemEls.forEach((el, idx) => {
      if (idx === this.selectedIndex) {
        el.style.color = '#facc15';
        el.style.opacity = '1';
      } else {
        const item = this.items[idx];
        el.style.color = item?.enabled ? '#cfd8ff' : '#7f8db2';
        el.style.opacity = item?.enabled ? '0.85' : '0.4';
      }
    });
  }
}
