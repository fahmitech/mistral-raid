import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';

export interface SoloHeroStat {
  label: string;
  value: number;
  max: number;
  color: string;
}

export interface SoloHeroOption {
  label: string;
  description: string;
  image?: string | null;
  stats: SoloHeroStat[];
}

interface SoloSelectOverlayOptions {
  heroes: SoloHeroOption[];
  onSelect: (index: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const ensureStyles = (): void => {
  if (document.getElementById('solo-select-redesign')) return;
  const style = document.createElement('style');
  style.id = 'solo-select-redesign';
  style.textContent = `
    .solo-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; pointer-events:none; }
    .solo-bg { position:absolute; inset:0; background:radial-gradient(circle at 50% 15%, rgba(255,255,255,0.05), transparent 45%), linear-gradient(180deg,#04001a 0%,#050427 40%,#080835 100%); }
    .solo-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 20px; }
    .solo-header { text-align:center; margin-bottom:12px; letter-spacing:0.2em; color:#f5d0fe; text-shadow:0 1px 0 #130022, 0 0 24px rgba(245,208,254,0.7); font-size:32px; }
    .solo-header small { display:block; margin-top:8px; font-size:12px; color:#fde68a; letter-spacing:0.25em; opacity:0.9; }
    .solo-panel { position:relative; width:960px; background:rgba(5,12,24,0.95); border:3px solid rgba(80,110,170,0.85); border-radius:12px; padding:20px 64px; display:flex; flex-direction:column; gap:16px; pointer-events:auto; box-shadow:0 0 80px rgba(10,0,40,0.8); }
    .solo-section-title { font-size:15px; letter-spacing:0.2em; color:#facc15; margin-bottom:6px; }
    .solo-portrait-row { display:flex; justify-content:center; gap:24px; }
    .solo-portrait { border:none; background:none; cursor:pointer; display:flex; flex-direction:column; gap:12px; align-items:center; color:#7f8db2; transition: transform 0.2s; }
    .solo-portrait:hover { transform: scale(1.05); }
    .solo-portrait .frame { width:110px; height:110px; border:3px solid rgba(40,60,90,0.45); border-radius:10px; display:flex; align-items:center; justify-content:center; background:#091023; box-shadow:inset 0 4px 12px rgba(0,0,0,0.65); transition:all 0.2s; }
    .solo-portrait img { max-width:64px; max-height:64px; width:auto; height:auto; image-rendering:pixelated; object-fit:contain; }
    .solo-portrait span { font-size:12px; letter-spacing:0.1em; }
    .solo-portrait.selected .frame { border-color:#ffdd00; box-shadow:0 0 16px rgba(255,221,0,0.6); transform: scale(1.1); }
    .solo-portrait.selected span { color:#f8fafc; font-weight:bold; }
    .solo-details { display:flex; gap:32px; align-items:center; margin-top:4px; }
    .solo-hero-art { width:180px; height:180px; border-radius:12px; background:linear-gradient(160deg,#0f1424,#070912); border:2px solid rgba(60,80,130,0.8); display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .solo-hero-art img { max-width:140px; max-height:140px; width:auto; height:auto; image-rendering:pixelated; display:block; object-fit:contain; }
    .solo-card { flex:1; background:rgba(6,16,30,0.92); border:1.5px solid rgba(34,68,102,0.9); border-radius:10px; padding:16px 24px; display:flex; flex-direction:column; gap:14px; }
    .solo-card h4 { font-size:18px; color:#00ffcc; letter-spacing:0.15em; }
    .solo-card p { font-size:12px; color:#dbe8ff; letter-spacing:0.04em; line-height:1.5; }
    .solo-stats { display:flex; flex-direction:column; gap:14px; }
    .solo-stat { display:flex; align-items:center; gap:24px; }
    .solo-stat label { width:80px; font-size:12px; color:#94a3b8; letter-spacing:0.12em; }
    .solo-stat .bar { flex:1; height:14px; background:#0b1424; border:1px solid rgba(255,255,255,0.15); position:relative; border-radius:7px; overflow:hidden; }
    .solo-stat .fill { height:100%; background:var(--bar-color); width:0; transition: width 0.4s ease-out; }
    .solo-stat .value { width:40px; text-align:right; font-size:12px; color:#f8fafc; }
    .solo-divider { border-top:1.5px solid rgba(80,100,150,0.45); margin: 8px 0; }
    .solo-instructions { text-align:center; font-size:12px; color:#9eaad6; letter-spacing:0.12em; margin-bottom:4px; width:100%; }
    .solo-buttons { display:flex; justify-content:space-between; gap:24px; }
    .solo-btn { flex:1; font-family:'Press Start 2P', monospace; font-size:14px; padding:14px 0; background:rgba(8,12,28,0.95); border:2px solid rgba(90,120,190,0.95); color:#f0f4ff; letter-spacing:0.14em; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.65); text-transform:uppercase; transition: all 0.2s; }
    .solo-btn:hover { background:rgba(20,30,60,0.98); border-color:#00ffcc; color:#00ffcc; box-shadow: 0 0 20px rgba(0,255,204,0.3); }
  `;
  document.head.appendChild(style);
};

export class SoloSelectOverlay {
  private root: HTMLDivElement;
  private heroButtons: HTMLButtonElement[] = [];
  private heroImage: HTMLImageElement;
  private heroPlaceholder: HTMLDivElement;
  private nameEl: HTMLHeadingElement;
  private descEl: HTMLParagraphElement;
  private statRows: Array<{ label: HTMLLabelElement; fill: HTMLDivElement; value: HTMLSpanElement }>;
  private options: SoloHeroOption[];
  private instructionsEl: HTMLDivElement;

  private partner_canvas: HTMLCanvasElement;
  private stage: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private scaleX = 1;
  private scaleY = 1;

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement, options: SoloSelectOverlayOptions) {
    parent.querySelectorAll<HTMLDivElement>('[data-solo-overlay="true"]').forEach((node) => node.remove());
    ensureStyles();
    this.partner_canvas = canvas;
    this.options = options.heroes;
    this.root = document.createElement('div');
    this.root.dataset.soloOverlay = 'true';
    this.root.className = 'solo-ui';

    const bg = document.createElement('div');
    bg.className = 'solo-bg';
    this.root.appendChild(bg);

    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'absolute',
      width: `${INTERNAL_WIDTH}px`,
      height: `${INTERNAL_HEIGHT}px`,
      transformOrigin: 'top left',
    });

    const frame = document.createElement('div');
    frame.className = 'solo-frame';
    frame.style.width = '100%';
    frame.style.height = '100%';
    const header = document.createElement('div');
    header.className = 'solo-header';
    header.innerHTML = 'CHOOSE YOUR HERO<small>Select your champion</small>';
    frame.appendChild(header);

    const panel = document.createElement('div');
    panel.className = 'solo-panel';
    frame.appendChild(panel);

    const heroSectionTitle = document.createElement('div');
    heroSectionTitle.className = 'solo-section-title';
    heroSectionTitle.textContent = 'YOUR HERO';
    panel.appendChild(heroSectionTitle);

    const heroRow = document.createElement('div');
    heroRow.className = 'solo-portrait-row';
    panel.appendChild(heroRow);

    options.heroes.forEach((hero, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'solo-portrait';
      const frameEl = document.createElement('div');
      frameEl.className = 'frame';
      if (hero.image) {
        const img = document.createElement('img');
        img.src = hero.image;
        img.alt = hero.label;
        frameEl.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.style.width = '34px';
        ph.style.height = '34px';
        ph.style.background = 'rgba(255,255,255,0.2)';
        frameEl.appendChild(ph);
      }
      const label = document.createElement('span');
      label.textContent = hero.label;
      btn.append(frameEl, label);
      btn.addEventListener('click', () => options.onSelect(idx));
      heroRow.appendChild(btn);
      this.heroButtons.push(btn);
    });

    const details = document.createElement('div');
    details.className = 'solo-details';
    panel.appendChild(details);

    const art = document.createElement('div');
    art.className = 'solo-hero-art';
    this.heroImage = document.createElement('img');
    this.heroImage.alt = '';
    this.heroPlaceholder = document.createElement('div');
    this.heroPlaceholder.className = 'placeholder';
    art.append(this.heroImage, this.heroPlaceholder);
    details.appendChild(art);

    const card = document.createElement('div');
    card.className = 'solo-card';
    this.nameEl = document.createElement('h4');
    this.descEl = document.createElement('p');
    card.append(this.nameEl, this.descEl);
    const statsList = document.createElement('div');
    statsList.className = 'solo-stats';
    const statTemplateCount = options.heroes[0]?.stats.length ?? 0;
    this.statRows = [];
    for (let i = 0; i < statTemplateCount; i += 1) {
      const stat = document.createElement('div');
      stat.className = 'solo-stat';
      const label = document.createElement('label');
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('div');
      fill.className = 'fill';
      bar.appendChild(fill);
      const value = document.createElement('span');
      value.className = 'value';
      stat.append(label, bar, value);
      statsList.appendChild(stat);
      this.statRows.push({ label, fill, value });
    }
    card.appendChild(statsList);
    details.appendChild(card);

    const divider = document.createElement('div');
    divider.className = 'solo-divider';
    panel.appendChild(divider);

    this.instructionsEl = document.createElement('div');
    this.instructionsEl.className = 'solo-instructions';
    panel.appendChild(this.instructionsEl);

    const buttons = document.createElement('div');
    buttons.className = 'solo-buttons';
    const backBtn = document.createElement('button');
    backBtn.className = 'solo-btn';
    backBtn.type = 'button';
    backBtn.textContent = '[ BACK ]';
    backBtn.addEventListener('click', options.onBack);
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'solo-btn';
    confirmBtn.type = 'button';
    confirmBtn.textContent = '[ START ]';
    confirmBtn.addEventListener('click', options.onConfirm);
    buttons.append(backBtn, confirmBtn);
    panel.appendChild(buttons);

    this.stage.appendChild(frame);
    this.root.appendChild(this.stage);

    this.resizeObserver = new ResizeObserver(() => this.updateStage());
    this.resizeObserver.observe(canvas);
    this.updateStage();

    parent.appendChild(this.root);
  }

  render(index: number): void {
    const hero = this.options[index];
    if (!hero) return;
    this.heroButtons.forEach((btn, idx) => btn.classList.toggle('selected', idx === index));
    this.nameEl.textContent = hero.label;
    this.descEl.textContent = hero.description;
    if (hero.image) {
      this.heroImage.src = hero.image;
      this.heroImage.style.display = 'block';
      this.heroPlaceholder.style.display = 'none';
    } else {
      this.heroImage.style.display = 'none';
      this.heroPlaceholder.style.display = 'block';
    }
    hero.stats.forEach((stat, idx) => {
      const row = this.statRows[idx];
      if (!row) return;
      row.label.textContent = stat.label;
      row.fill.style.width = `${Math.min(100, (stat.value / stat.max) * 100)}%`;
      row.fill.style.setProperty('--bar-color', stat.color);
      row.value.textContent = stat.value.toString();
    });
    this.instructionsEl.textContent = `SELECTING: ${hero.label}   ◄► CHANGE   ENTER CONFIRM`;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.root.remove();
  }

  private updateStage(): void {
    const canvasRect = this.partner_canvas.getBoundingClientRect();
    const parentRect = this.root.parentElement?.getBoundingClientRect() ?? canvasRect;

    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;

    const baseHeight = 720;
    const aspect = INTERNAL_WIDTH / INTERNAL_HEIGHT;
    const baseWidth = baseHeight * aspect;

    this.scaleX = canvasRect.width / baseWidth;
    this.scaleY = canvasRect.height / baseHeight;

    this.stage.style.left = `${left}px`;
    this.stage.style.top = `${top}px`;
    this.stage.style.width = `${baseWidth}px`;
    this.stage.style.height = `${baseHeight}px`;
    this.stage.style.transform = `scale(${this.scaleX}, ${this.scaleY})`;
  }
}
