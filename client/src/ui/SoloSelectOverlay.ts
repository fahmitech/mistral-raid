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

interface TorchSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
}

const CANVAS_W = 384;
const CANVAS_H = 216;
const ARCH_LEFT = 74;
const ARCH_RIGHT = CANVAS_W - 74;
const ARCH_TOP = 34;
const ARCH_BOTTOM = CANVAS_H - 26;
const TILE_W = 16;
const TILE_H = 10;

const ensureStyles = (): void => {
  if (document.getElementById('solo-select-redesign')) return;
  const style = document.createElement('style');
  style.id = 'solo-select-redesign';
  style.textContent = `
    .solo-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; color:#f4f0ff; pointer-events:none; text-transform:uppercase; }
    .solo-bg {
      position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(180deg,#1a1d22 0%,#14161b 60%,#0c0d12 100%);
    }
    .solo-bg-canvas,
    .solo-fire-canvas {
      position:absolute; inset:0; width:100%; height:100%; pointer-events:none; image-rendering:pixelated;
    }
    .solo-bg-canvas { z-index:0; }
    .solo-fire-canvas { z-index:1; }
    .solo-bg::before, .solo-bg::after {
      content:''; position:absolute; top:8%; bottom:8%; width:140px;
      border-radius:60px;
      background:linear-gradient(180deg, rgba(32,20,58,0.9) 0%, rgba(12,8,20,0.7) 100%);
      box-shadow:0 0 40px rgba(0,0,0,0.45);
      opacity:0.35;
    }
    .solo-bg::before { left:6%; }
    .solo-bg::after { right:6%; }
    .solo-scanlines {
      position:absolute; inset:0; pointer-events:none;
      background:repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px);
      z-index:1;
    }
    .solo-vignette {
      position:absolute; inset:0; pointer-events:none; z-index:1;
      background:radial-gradient(ellipse 80% 80% at 50% 50%, transparent 45%, rgba(0,0,0,0.75) 100%);
    }
    .solo-screen {
      position:relative; z-index:5;
      width:min(1080px, 95vw);
      margin:0 auto;
      padding:48px 32px 36px;
      display:flex; flex-direction:column; gap:28px;
      pointer-events:auto;
    }
    .solo-header { text-align:center; display:flex; flex-direction:column; gap:12px; }
    .solo-header-title {
      font-size:clamp(18px, 2.2vw, 28px);
      letter-spacing:8px;
      color:#f8ecff;
      text-shadow:0 0 12px rgba(210,150,255,0.5), 3px 3px 0 #08040a;
    }
    .solo-header-rule {
      display:flex; align-items:center; gap:0; width:420px; max-width:80vw; margin:0 auto;
    }
    .solo-header-rule-line { flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(90,72,118,0.9)); }
    .solo-header-rule-line.r { background:linear-gradient(90deg, rgba(90,72,118,0.9), transparent); }
    .solo-header-gem {
      width:10px; height:10px; transform:rotate(45deg);
      background:#f5b45f;
      box-shadow:0 0 12px rgba(245,180,95,0.9);
      animation:solo-gemPulse 2.4s ease-in-out infinite alternate;
    }
    @keyframes solo-gemPulse {
      from { box-shadow:0 0 8px rgba(245,180,95,0.5); }
      to { box-shadow:0 0 20px rgba(255,210,130,1), 0 0 32px rgba(180,90,40,0.5); }
    }
    .solo-header-sub {
      font-size:9px; letter-spacing:6px; color:#6d5e86;
    }
    .solo-hero-row {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
      gap:18px;
    }
    .solo-portrait {
      position:relative;
      border:none;
      background:rgba(8,10,20,0.85);
      border-radius:16px;
      padding:18px 12px 16px;
      cursor:pointer;
      display:flex;
      flex-direction:column;
      gap:12px;
      align-items:center;
      color:#8b86a8;
      transition:transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      border:1px solid rgba(255,255,255,0.08);
      pointer-events:auto;
    }
    .solo-portrait::before {
      content:''; position:absolute; inset:6px;
      border-radius:12px;
      border:1px dashed rgba(255,255,255,0.05);
      pointer-events:none;
    }
    .solo-portrait:hover,
    .solo-portrait.selected {
      transform:translateY(-4px);
      border-color:rgba(255,210,120,0.4);
      box-shadow:0 10px 26px rgba(0,0,0,0.45);
      color:#f4f0ff;
    }
    .solo-portrait .frame {
      width:96px; height:96px;
      border-radius:14px;
      background:linear-gradient(160deg,#141629,#07060d);
      border:2px solid rgba(255,255,255,0.07);
      display:flex; align-items:center; justify-content:center;
      box-shadow:inset 0 3px 12px rgba(0,0,0,0.65);
    }
    .solo-portrait img { width:64px; height:64px; image-rendering:pixelated; }
    .solo-portrait span { font-size:11px; letter-spacing:0.16em; }
    .solo-detail {
      display:flex;
      gap:32px;
      align-items:flex-start;
      background:rgba(5,8,18,0.9);
      border:1px solid rgba(90,70,130,0.5);
      border-radius:20px;
      padding:28px 32px;
      box-shadow:0 20px 50px rgba(0,0,0,0.55);
      flex-wrap:wrap;
    }
    .solo-hero-art {
      width:220px;
      height:220px;
      border-radius:18px;
      background:radial-gradient(circle at 50% 30%, rgba(255,200,150,0.12), transparent 70%), linear-gradient(160deg,#0c0f1b,#05030a);
      border:2px solid rgba(255,255,255,0.08);
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:inset 0 -10px 18px rgba(0,0,0,0.6);
    }
    .solo-hero-art img { width:120px; height:120px; image-rendering:pixelated; display:block; }
    .solo-hero-art .placeholder { width:74px; height:74px; background:rgba(255,255,255,0.12); border-radius:10px; }
    .solo-info-card {
      flex:1;
      min-width:280px;
      background:rgba(8,12,24,0.92);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:16px;
      padding:20px 22px;
      display:flex;
      flex-direction:column;
      gap:18px;
    }
    .solo-info-card h4 {
      font-size:15px;
      letter-spacing:0.2em;
      color:#74fdd4;
    }
    .solo-info-card p {
      font-size:11px;
      color:#cfd6ff;
      letter-spacing:0.1em;
      line-height:1.7;
      text-transform:none;
    }
    .solo-stats { display:flex; flex-direction:column; gap:12px; }
    .solo-stat {
      display:flex;
      align-items:center;
      gap:12px;
    }
    .solo-stat label {
      width:80px;
      font-size:10px;
      color:#8b95b5;
      letter-spacing:0.2em;
    }
    .solo-stat .bar {
      flex:1;
      height:10px;
      background:#0b1424;
      border:1px solid rgba(255,255,255,0.15);
      position:relative;
      overflow:hidden;
      border-radius:10px;
    }
    .solo-stat .bar .fill {
      position:absolute; top:0; left:0; height:100%; width:0%;
      background:var(--bar-color,#f5d0fe);
      transition:width 0.18s ease;
    }
    .solo-stat .value {
      width:40px;
      text-align:right;
      font-size:10px;
      color:#f8fbff;
    }
    .solo-instructions {
      text-align:center;
      font-size:10px;
      letter-spacing:0.16em;
      color:#8e86b0;
    }
    .solo-buttons {
      display:flex;
      justify-content:space-between;
      gap:28px;
      flex-wrap:wrap;
    }
    .solo-btn {
      flex:1;
      min-width:200px;
      font-family:'Press Start 2P', monospace;
      font-size:11px;
      padding:14px 0;
      background:rgba(8,12,28,0.9);
      border:2px solid rgba(90,120,190,0.85);
      color:#f0f4ff;
      letter-spacing:0.2em;
      cursor:pointer;
      box-shadow:0 6px 18px rgba(0,0,0,0.55);
      transition:background 0.15s ease, box-shadow 0.15s ease;
    }
    .solo-btn:hover { background:rgba(14,20,40,0.95); box-shadow:0 10px 22px rgba(0,0,0,0.55); }
    @media (max-width:900px) {
      .solo-detail { flex-direction:column; align-items:center; }
      .solo-hero-art { width:180px; height:180px; }
    }
    @media (max-width:640px) {
      .solo-buttons { flex-direction:column; }
      .solo-btn { width:100%; }
    }
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
  private bgCanvas: HTMLCanvasElement;
  private fireCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D | null;
  private fireCtx: CanvasRenderingContext2D | null;
  private animationFrame?: number;
  private phase = 0;
  private sparks: TorchSpark[] = [];
  private torchPositions: Array<{ x: number; y: number }> = [
    { x: 60, y: 70 },
    { x: CANVAS_W - 60, y: 70 },
  ];

  constructor(parent: HTMLElement, options: SoloSelectOverlayOptions) {
    ensureStyles();
    this.options = options.heroes;
    this.root = document.createElement('div');
    this.root.dataset.soloOverlay = 'true';
    this.root.className = 'solo-ui';

    const bg = document.createElement('div');
    bg.className = 'solo-bg';
    this.root.appendChild(bg);
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = CANVAS_W;
    this.bgCanvas.height = CANVAS_H;
    this.bgCanvas.className = 'solo-bg-canvas';
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.root.appendChild(this.bgCanvas);

    this.fireCanvas = document.createElement('canvas');
    this.fireCanvas.width = CANVAS_W;
    this.fireCanvas.height = CANVAS_H;
    this.fireCanvas.className = 'solo-fire-canvas';
    this.fireCtx = this.fireCanvas.getContext('2d');
    this.root.appendChild(this.fireCanvas);

    const scanlines = document.createElement('div');
    scanlines.className = 'solo-scanlines';
    this.root.appendChild(scanlines);

    const vignette = document.createElement('div');
    vignette.className = 'solo-vignette';
    this.root.appendChild(vignette);

    const screen = document.createElement('div');
    screen.className = 'solo-screen';
    this.root.appendChild(screen);

    const header = document.createElement('div');
    header.className = 'solo-header';
    header.innerHTML = `
      <div class="solo-header-title">CHOOSE YOUR HERO</div>
      <div class="solo-header-rule">
        <div class="solo-header-rule-line"></div>
        <div class="solo-header-gem"></div>
        <div class="solo-header-rule-line r"></div>
      </div>
      <div class="solo-header-sub">SELECT YOUR CHAMPION</div>
    `;
    screen.appendChild(header);

    const heroRow = document.createElement('div');
    heroRow.className = 'solo-hero-row';
    screen.appendChild(heroRow);

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
        ph.style.width = '40px';
        ph.style.height = '40px';
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
    details.className = 'solo-detail';
    screen.appendChild(details);

    const art = document.createElement('div');
    art.className = 'solo-hero-art';
    this.heroImage = document.createElement('img');
    this.heroImage.alt = '';
    this.heroPlaceholder = document.createElement('div');
    this.heroPlaceholder.className = 'placeholder';
    art.append(this.heroImage, this.heroPlaceholder);
    details.appendChild(art);

    const card = document.createElement('div');
    card.className = 'solo-info-card';
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

    this.instructionsEl = document.createElement('div');
    this.instructionsEl.className = 'solo-instructions';
    screen.appendChild(this.instructionsEl);

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
    screen.appendChild(buttons);

    this.drawHallwayBase();
    this.startTorchLoop();

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
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.sparks = [];
    this.root.remove();
  }

  private drawHallwayBase(): void {
    if (!this.bgCtx) return;
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    gradient.addColorStop(0, '#26282f');
    gradient.addColorStop(0.4, '#1c1d24');
    gradient.addColorStop(1, '#0d0d13');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#2f3239';
    ctx.fillRect(0, 0, 48, CANVAS_H);
    ctx.fillRect(CANVAS_W - 48, 0, 48, CANVAS_H);

    for (let row = 0; row < 18; row += 1) {
      const height = 6;
      const width = CANVAS_W - row * 18;
      if (width <= 0) continue;
      const x = (CANVAS_W - width) / 2;
      const y = CANVAS_H - row * 8 - 20;
      ctx.fillStyle = row % 2 === 0 ? '#3d414a' : '#2c2f36';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y, width, 1);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_W; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 40, CANVAS_H);
      ctx.stroke();
    }

    const leftWall = [
      { x: 0, y: 0 },
      { x: ARCH_LEFT, y: ARCH_TOP },
      { x: ARCH_LEFT, y: ARCH_BOTTOM },
      { x: 0, y: CANVAS_H },
    ];
    const rightWall = [
      { x: CANVAS_W, y: 0 },
      { x: ARCH_RIGHT, y: ARCH_TOP },
      { x: ARCH_RIGHT, y: ARCH_BOTTOM },
      { x: CANVAS_W, y: CANVAS_H },
    ];
    const ceiling = [
      { x: 0, y: 0 },
      { x: CANVAS_W, y: 0 },
      { x: ARCH_RIGHT, y: ARCH_TOP },
      { x: ARCH_LEFT, y: ARCH_TOP },
    ];
    const floor = [
      { x: 0, y: CANVAS_H },
      { x: CANVAS_W, y: CANVAS_H },
      { x: ARCH_RIGHT, y: ARCH_BOTTOM },
      { x: ARCH_LEFT, y: ARCH_BOTTOM },
    ];

    this.drawStoneSection(ctx, leftWall, { hue: 220, lightness: 26, grain: 4, cracks: 0.2 });
    this.drawStoneSection(ctx, rightWall, { hue: 220, lightness: 26, grain: 4, cracks: 0.2 });
    this.drawStoneSection(ctx, ceiling, { hue: 220, lightness: 22, grain: 3, cracks: 0.18, tileW: 18, tileH: 9 });
    this.drawStoneSection(ctx, floor, { hue: 215, lightness: 32, grain: 6, cracks: 0.28, tileW: 18, tileH: 10 });

    ctx.fillStyle = '#0b0a0f';
    ctx.beginPath();
    ctx.moveTo(ARCH_LEFT, ARCH_TOP);
    ctx.lineTo(ARCH_RIGHT, ARCH_TOP);
    ctx.lineTo(ARCH_RIGHT, ARCH_BOTTOM);
    ctx.lineTo(ARCH_LEFT, ARCH_BOTTOM);
    ctx.closePath();
    ctx.fill();

    const floorGlow = ctx.createLinearGradient(CANVAS_W / 2, ARCH_BOTTOM - 20, CANVAS_W / 2, CANVAS_H);
    floorGlow.addColorStop(0, 'rgba(255,255,255,0.05)');
    floorGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floorGlow;
    ctx.beginPath();
    ctx.moveTo(ARCH_LEFT, ARCH_BOTTOM);
    ctx.lineTo(ARCH_RIGHT, ARCH_BOTTOM);
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    this.drawTorchSconces(ctx);
  }

  private startTorchLoop(): void {
    const loop = (): void => {
      this.phase += 0.07;
      if (Math.random() < 0.3) this.spawnSpark();
      this.updateSparks();
      this.drawTorches();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private drawTorches(): void {
    if (!this.fireCtx) return;
    const ctx = this.fireCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this.torchPositions.forEach(({ x, y }, idx) => {
      this.drawTorchFlame(ctx, x, y, idx);
    });
    ctx.fillStyle = 'rgba(255,180,90,0.25)';
    this.sparks.forEach((spark) => {
      ctx.globalAlpha = spark.life;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
    });
    ctx.globalAlpha = 1;
  }

  private drawTorchFlame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    idx: number,
  ): void {
    const wobble = Math.sin(this.phase * 1.4 + idx * 0.8);
    const flameColors = ['#fff2c1', '#ffd27a', '#ff9f3b', '#cc5018'];
    let offsetY = y - 6;
    flameColors.forEach((color, i) => {
      const height = 8 - i;
      const width = 18 - i * 3 + wobble * (1.2 - i * 0.2);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - width / 2), Math.round(offsetY), Math.round(width), height);
      offsetY -= height - 2;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - 1, offsetY - 2, 2, 3);
  }

  private spawnSpark(): void {
    const torch = this.torchPositions[Math.floor(Math.random() * this.torchPositions.length)];
    const spark: TorchSpark = {
      x: torch.x + (Math.random() - 0.5) * 10,
      y: torch.y - 4,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(Math.random() * 0.7 + 0.2),
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
    };
    this.sparks.push(spark);
  }

  private updateSparks(): void {
    this.sparks = this.sparks.filter((spark) => {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life -= spark.decay;
      return spark.life > 0;
    });
  }
  private drawStoneSection(
    ctx: CanvasRenderingContext2D,
    poly: Array<{ x: number; y: number }>,
    opts: { hue: number; lightness: number; grain: number; cracks: number; tileW?: number; tileH?: number },
  ): void {
    const { hue, lightness, grain, cracks, tileW = TILE_W, tileH = TILE_H } = opts;

    ctx.fillStyle = `hsl(${hue}, 8%, ${lightness}%)`;
    this.fillPolygon(ctx, poly);

    const bounds = this.polygonBounds(poly);
    for (let y = bounds.minY - tileH; y <= bounds.maxY + tileH; y += tileH) {
      for (let x = bounds.minX - tileW; x <= bounds.maxX + tileW; x += tileW) {
        const cx = x + tileW / 2;
        const cy = y + tileH / 2;
        if (!this.pointInPolygon(cx, cy, poly)) continue;
        const noise = this.seededNoise(cx * 12 + cy * 7);
        const shade = lightness + (noise - 0.5) * grain;
        ctx.fillStyle = `hsl(${hue}, 7%, ${Math.max(12, shade)}%)`;
        ctx.fillRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);

        if (noise > 0.8 && this.seededNoise(cx + cy * 3) < cracks) {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.moveTo(x + tileW * this.seededNoise(cx + 3), y + tileH * this.seededNoise(cy + 7));
          ctx.lineTo(x + tileW * this.seededNoise(cx + 11), y + tileH * this.seededNoise(cy + 5));
          ctx.stroke();
        }
      }
    }
  }

  private fillPolygon(ctx: CanvasRenderingContext2D, poly: Array<{ x: number; y: number }>): void {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i += 1) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private pointInPolygon(x: number, y: number, poly: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private polygonBounds(poly: Array<{ x: number; y: number }>): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    poly.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
    return { minX, maxX, minY, maxY };
  }

  private seededNoise(seed: number): number {
    const x = Math.sin(seed * 0.001 + seed * 0.0031) * 43758.5453;
    return x - Math.floor(x);
  }

  private drawTorchSconces(ctx: CanvasRenderingContext2D): void {
    this.torchPositions.forEach(({ x, y }) => {
      ctx.fillStyle = '#1f1711';
      ctx.fillRect(x - 3, y - 10, 6, 60);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 12, 8, 64);
      ctx.fillStyle = '#120b07';
      ctx.fillRect(x - 6, y + 48, 12, 6);
    });
  }

}
