interface CreditsOverlayOptions {
  lines: string[];
  onComplete: () => void;
  onBack: () => void;
}

const ensureStyles = (): void => {
  if (document.getElementById('credits-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'credits-overlay-styles';
  style.textContent = `
    .credits-ui { position:absolute; inset:0; pointer-events:none; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; }
    .credits-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:28px 32px 24px; }
    .credits-header { font-size:18px; color:#f5d0fe; letter-spacing:0.2em; text-shadow:0 1px 0 #130022, 0 0 22px rgba(245,208,254,0.7); margin-bottom:14px; text-align:center; }
    .credits-panel { width:900px; background:rgba(5,12,28,0.96); border:2px solid rgba(80,110,170,0.95); border-radius:20px; padding:42px 72px 32px; box-shadow:0 0 64px rgba(12,4,44,0.8); pointer-events:auto; display:flex; flex-direction:column; gap:30px; position:relative; }
    .credits-scroll { position:relative; height:400px; overflow:hidden; border:1px solid rgba(120,140,200,0.4); border-radius:16px; background:rgba(3,6,14,0.7); }
    .credits-scroll-inner { position:absolute; width:100%; will-change:transform; display:flex; flex-direction:column; gap:12px; padding:0 12px; }
    .credits-line { text-align:center; font-size:10px; letter-spacing:0.18em; color:#eaf0ff; }
    .credits-line.title { font-size:12px; color:#ffddf5; letter-spacing:0.26em; }
    .credits-line.section { color:#9bdcff; }
    .credits-footer { display:flex; justify-content:center; }
    .credits-btn { font-family:'Press Start 2P', monospace; font-size:10px; padding:10px 18px; background:rgba(8,12,30,0.95); border:2px solid rgba(90,120,190,0.95); color:#f0f4ff; letter-spacing:0.16em; cursor:pointer; text-transform:uppercase; }
    .credits-btn:hover { background:rgba(14,20,38,0.98); }
  `;
  document.head.appendChild(style);
};

export class CreditsOverlay {
  private root: HTMLDivElement;
  private inner: HTMLDivElement;
  private scrollArea: HTMLDivElement;
  private raf?: number;
  private scrollPos = 0;
  private lastTs = 0;
  private scrollHeight = 0;
  private options: CreditsOverlayOptions;

  constructor(parent: HTMLElement, options: CreditsOverlayOptions) {
    ensureStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.dataset.creditsOverlay = 'true';
    this.root.className = 'credits-ui';

    const frame = document.createElement('div');
    frame.className = 'credits-frame';
    const header = document.createElement('div');
    header.className = 'credits-header';
    header.textContent = 'CREDITS';
    frame.appendChild(header);

    const panel = document.createElement('div');
    panel.className = 'credits-panel';

    this.scrollArea = document.createElement('div');
    this.scrollArea.className = 'credits-scroll';
    this.inner = document.createElement('div');
    this.inner.className = 'credits-scroll-inner';
    options.lines.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'credits-line';
      if (idx === 0) div.classList.add('title');
      if (line === line.toUpperCase() && line.trim().length > 0) {
        div.classList.add('section');
      }
      div.textContent = line || ' ';
      this.inner.appendChild(div);
    });
    this.scrollArea.appendChild(this.inner);
    panel.appendChild(this.scrollArea);

    const footer = document.createElement('div');
    footer.className = 'credits-footer';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'credits-btn';
    backBtn.textContent = '[ BACK TO MENU ]';
    backBtn.addEventListener('click', () => options.onBack());
    footer.appendChild(backBtn);
    panel.appendChild(footer);

    frame.appendChild(panel);
    this.root.appendChild(frame);
    parent.appendChild(this.root);

    this.resetScroll();
    this.start();
  }

  private resetScroll(): void {
    this.scrollPos = this.scrollArea.clientHeight;
    this.scrollHeight = this.inner.scrollHeight;
    this.updateTransform();
    this.lastTs = performance.now();
  }

  private start(): void {
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (time: number): void => {
    const delta = time - this.lastTs;
    this.lastTs = time;
    this.scrollPos -= delta * 0.03; // speed
    this.updateTransform();
    if (this.scrollPos + this.scrollHeight < -40) {
      this.options.onComplete();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private updateTransform(): void {
    this.inner.style.transform = `translateY(${this.scrollPos}px)`;
  }

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.root.remove();
  }
}
